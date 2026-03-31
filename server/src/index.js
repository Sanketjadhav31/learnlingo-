const express = require("express");
const cors = require("cors");
// Load environment variables from server/.env explicitly.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { connectMongo } = require("./mongo/connect");
const { stateStoreFactory } = require("./state/stateStore");
const { getUserAuthModel } = require("./mongo/models/UserAuth");
const { parseAndValidateSubmission } = require("./trainer/validator");
const { generateDayContentGemini } = require("./trainer/dayGenerator");
const { evaluateSubmissionGemini, updateStateAfterEvaluation } = require("./trainer/evaluationService");
const { authRequired, signAuthToken } = require("./auth");
const bcrypt = require("bcryptjs");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const dayGenerationLocks = new Map();
const REQUIRED_SECTION_COUNT = 5;
const DAY_SECTIONS = ["warmup", "grammar", "pronunciation", "vocabulary", "listening", "coreTasks", "sentences", "questions"];

function nowIso() {
  return new Date().toISOString();
}

function createEmptySectionsRead() {
  return {
    warmup: false,
    grammar: false,
    pronunciation: false,
    vocabulary: false,
    listening: false,
    coreTasks: false,
    sentences: false,
    questions: false,
  };
}

function getOrCreateDayProgress(state, dayNumber) {
  state.dayProgress = state.dayProgress || {};
  const key = String(dayNumber);
  if (!state.dayProgress[key]) {
    state.dayProgress[key] = {
      dayNumber,
      sectionsRead: createEmptySectionsRead(),
      sectionsReadCount: 0,
      totalSections: DAY_SECTIONS.length,
      readPercentage: 0,
      submissionStatus: "not_started",
      evaluationResult: null,
      dayCompleted: false,
      dayAdvanced: false,
    };
  }
  return state.dayProgress[key];
}

function summarizeDayProgress(dayProgress) {
  return {
    ...dayProgress,
    canSubmit: dayProgress.sectionsReadCount >= REQUIRED_SECTION_COUNT,
    requiredSections: REQUIRED_SECTION_COUNT,
  };
}

function elapsedMs(start) {
  return Date.now() - start;
}

async function getOrGenerateDayContent({ stateStore, userId, state }) {
  // Helper function to get current IST date
  const getISTDate = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  const todayIST = getISTDate();

  console.log(`  🔍 Checking day content: dayNumber=${state.dayContent?.dayNumber}, currentDay=${state.currentDay}, generatedDate=${state.dayContentGeneratedDate}, todayIST=${todayIST}`);

  // Check if we already have today's content in DB
  if (state.dayContent && 
      state.dayContent.dayNumber === state.currentDay &&
      state.dayContentGeneratedDate === todayIST) {
    console.log(`  ✓ Using cached day content from DB (generated today: ${todayIST})`);
    return state;
  }

  // If content exists for current day but was generated on a different date, still use it
  // (Don't regenerate content just because the date changed - only regenerate when day advances)
  if (state.dayContent && state.dayContent.dayNumber === state.currentDay) {
    console.log(`  ✓ Using existing day content from DB (Day ${state.currentDay}, generated: ${state.dayContentGeneratedDate || 'unknown'})`);
    // Update the generated date to today so we don't regenerate
    state.dayContentGeneratedDate = todayIST;
    await stateStore.save(userId, state);
    return state;
  }

  const lockKey = `${userId}:${state.currentDay}`;
  if (dayGenerationLocks.has(lockKey)) {
    await dayGenerationLocks.get(lockKey);
    return stateStore.getOrCreate(userId);
  }

  const run = (async () => {
    const latest = await stateStore.getOrCreate(userId);
    
    // Double-check after acquiring lock
    if (latest.dayContent && latest.dayContent.dayNumber === latest.currentDay) {
      console.log(`  ✓ Another request already generated content for Day ${latest.currentDay}`);
      // Update the generated date
      latest.dayContentGeneratedDate = todayIST;
      await stateStore.save(userId, latest);
      return;
    }

    console.log(`  🔄 Generating new day content via Gemini API (Day ${latest.currentDay})`);
    const previousDaySummary = latest.lastEvaluation || null;
    const newDay = await generateDayContentGemini({
      state: latest,
      dayNumber: latest.currentDay,
      userId,
      previousDaySummary,
    });

    const introduced = newDay?.vocabAndTracks?.wordOfDay?.map((w) => w.word) || [];
    latest.vocabByDay = latest.vocabByDay || {};
    latest.vocabByDay[String(latest.currentDay)] = introduced;
    latest.dayContent = newDay;
    latest.dayType = newDay.dayType;
    latest.dayContentGeneratedDate = todayIST; // Track when content was generated
    latest.dailyAnalytics = latest.dailyAnalytics || {};
    latest.dailyAnalytics[String(latest.currentDay)] = {
      dayStartTime: latest.dailyAnalytics[String(latest.currentDay)]?.dayStartTime || nowIso(),
      firstSectionReadTime: latest.dailyAnalytics[String(latest.currentDay)]?.firstSectionReadTime || null,
      submissionTime: latest.dailyAnalytics[String(latest.currentDay)]?.submissionTime || null,
      timeToCompleteMinutes: latest.dailyAnalytics[String(latest.currentDay)]?.timeToCompleteMinutes || null,
      attemptNumber: Number(latest.attemptsByDay?.[String(latest.currentDay)] || 0),
    };
    latest.tracker.finalStatus = "Waiting for Submission";
    for (const k of Object.keys(latest.tracker.todayWorkStatus || {})) {
      latest.tracker.todayWorkStatus[k] = "Pending";
    }
    // New day starts with fresh section progress.
    getOrCreateDayProgress(latest, latest.currentDay);
    await stateStore.save(userId, latest);
    console.log(`  ✓ New day content saved to DB (generated: ${todayIST})`);
  })();

  dayGenerationLocks.set(lockKey, run);
  try {
    await run;
  } finally {
    dayGenerationLocks.delete(lockKey);
  }
  return stateStore.getOrCreate(userId);
}

async function main() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "2mb" }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    req.requestId = requestId;
    console.log(`\n→ [${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path}`);
    console.log(`  Query:`, req.query);
    if (req.method === "POST" && req.body) {
      console.log(`  Body:`, JSON.stringify(req.body).slice(0, 200));
    }
    
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(`← [${new Date().toISOString()}] [${requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  console.log("\n🔌 Connecting to MongoDB...");
  const mongoConn = await connectMongo(process.env.MONGODB_URI);
  console.log("✓ MongoDB connection established\n");
  
  const stateStore = stateStoreFactory({ mongoConn });
  const UserAuth = getUserAuthModel();

  app.get("/api/health", (req, res) => {
    console.log("  ✓ Health check passed");
    res.json({ ok: true });
  });

  app.post("/api/auth/signup", async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!name) return res.status(400).json({ ok: false, reject: { message: "Name is required." } });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, reject: { message: "Invalid email format." } });
    if (password.length < 8) return res.status(400).json({ ok: false, reject: { message: "Password must be at least 8 characters." } });

    const existing = await UserAuth.findOne({ email }).lean();
    if (existing) return res.status(409).json({ ok: false, reject: { message: "Email already registered." } });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserAuth.create({ name, email, passwordHash, isActive: true });
    const userId = String(user._id);
    await stateStore.getOrCreate(userId);
    const token = signAuthToken({ userId, email: user.email, name: user.name });
    return res.json({ ok: true, token, user: { userId, name: user.name, email: user.email } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await UserAuth.findOne({ email });
    if (!user) return res.status(404).json({ ok: false, reject: { message: "Email not registered." } });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, reject: { message: "Incorrect password." } });
    user.lastLoginAt = new Date();
    await user.save();
    const userId = String(user._id);
    const token = signAuthToken({ userId, email: user.email, name: user.name });
    return res.json({ ok: true, token, user: { userId, name: user.name, email: user.email } });
  });

  app.get("/api/auth/verify", authRequired, async (req, res) => {
    const user = await UserAuth.findById(req.userId).lean();
    if (!user || !user.isActive) return res.status(401).json({ ok: false, reject: { message: "Session user is inactive." } });
    return res.json({ ok: true, user: { userId: String(user._id), name: user.name, email: user.email } });
  });

  app.get("/api/status", authRequired, async (req, res) => {
    const userId = req.userId;
    console.log(`  📊 Fetching status for user: ${userId}`);
    
    const state = await stateStore.getOrCreate(userId);
    console.log(`  ✓ User state retrieved - Day ${state.currentDay}`);
    
    res.json({
      tracker: state.tracker,
      currentDay: state.currentDay,
      scoreHistory: state.scoreHistory || [],
      weakAreas: state.weakAreas || [],
    });
  });

  app.get("/api/day", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    console.log(`  📅 Loading day content for user: ${userId}`);
    
    let state = await stateStore.getOrCreate(userId);
    console.log(`  ✓ User state loaded - Current day: ${state.currentDay}`);

    try {
      state = await getOrGenerateDayContent({ stateStore, userId, state });
      if (state.dayContent?.dayNumber === state.currentDay) {
        console.log(`  ✓ Using day content from MongoDB cache (day ${state.dayContent.dayNumber})`);
      }
    } catch (e) {
      console.error(`  ❌ Day generation failed:`, e instanceof Error ? e.message : e);
      return res.status(500).json({
        ok: false,
        reject: { message: e instanceof Error ? e.message : "Day generation failed" },
      });
    }

    let analyticsCreated = false;
    try {
      if (!state.dailyAnalytics?.[String(state.currentDay)]) {
        state.dailyAnalytics = state.dailyAnalytics || {};
        state.dailyAnalytics[String(state.currentDay)] = {
          dayStartTime: nowIso(),
          firstSectionReadTime: null,
          submissionTime: null,
          timeToCompleteMinutes: null,
          attemptNumber: Number(state.attemptsByDay?.[String(state.currentDay)] || 0),
        };
        analyticsCreated = true;
      }
    } catch (e) {
      console.error(`  ❌ Analytics save failed:`, e instanceof Error ? e.message : e);
      return res.status(500).json({
        ok: false,
        reject: { message: "Failed to initialize daily analytics." },
      });
    }

    const dayKey = String(state.currentDay);
    const hadProgress = !!state.dayProgress?.[dayKey];
    const todayProgress = getOrCreateDayProgress(state, state.currentDay);
    if (analyticsCreated || !hadProgress) {
      await stateStore.save(userId, state);
    }
    
    // Debug vocabulary data
    const vocabCount = state.dayContent?.vocabAndTracks?.wordOfDay?.length || 0;
    const vocabSample = state.dayContent?.vocabAndTracks?.wordOfDay?.[0];
    console.log(`  📚 Vocabulary in response: ${vocabCount} words, sample:`, vocabSample ? `${vocabSample.word}:${vocabSample.definition}` : 'none');
    
    console.log(`  📊 Checking draft - currentDay: ${state.currentDay}`);
    console.log(`  📊 submissionDraft object:`, state.submissionDraft);
    console.log(`  📊 submissionDraft keys:`, state.submissionDraft ? Object.keys(state.submissionDraft) : 'null');
    
    const draftText = state.submissionDraft?.[state.currentDay]?.text || "";
    console.log(`  💾 Draft in response: ${draftText.length} chars`);
    if (draftText.length > 0) {
      console.log(`  💾 Draft preview: ${draftText.substring(0, 100)}...`);
    }
    
    console.log(`  ⏱ /api/day total time: ${elapsedMs(routeStart)}ms`);

    // Prevent caching since draft data changes frequently
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      tracker: state.tracker,
      dayContent: state.dayContent,
      todayAnalytics: state.dailyAnalytics?.[String(state.currentDay)] || null,
      dayProgress: summarizeDayProgress(todayProgress),
      // Keep last AI evaluation so frontend can show results even after reload/day advance.
      lastEvaluation: state.lastEvaluation || null,
      submissionDraft: draftText,
    });
  });

  app.patch("/api/day/progress", authRequired, async (req, res) => {
    const userId = req.userId;
    const sectionId = String(req.body?.sectionId || "");
    const done = Boolean(req.body?.done);
    if (!DAY_SECTIONS.includes(sectionId)) {
      return res.status(400).json({ ok: false, reject: { message: "Invalid section id." } });
    }
    const state = await stateStore.getOrCreate(userId);
    const progress = getOrCreateDayProgress(state, state.currentDay);
    progress.sectionsRead[sectionId] = done;
    progress.sectionsReadCount = DAY_SECTIONS.reduce((acc, id) => acc + (progress.sectionsRead[id] ? 1 : 0), 0);
    progress.readPercentage = Math.round((progress.sectionsReadCount / progress.totalSections) * 100);

    const todayAnalytics = state.dailyAnalytics?.[String(state.currentDay)];
    if (done && todayAnalytics && !todayAnalytics.firstSectionReadTime) {
      todayAnalytics.firstSectionReadTime = nowIso();
    }

    await stateStore.save(userId, state);
    return res.json({ ok: true, dayProgress: summarizeDayProgress(progress) });
  });

  app.patch("/api/day/draft", authRequired, async (req, res) => {
    const userId = req.userId;
    const draftText = String(req.body?.draftText || "");
    
    console.log(`  💾 Saving draft - User: ${userId}, Day: ?, Length: ${draftText.length} chars`);
    
    const state = await stateStore.getOrCreate(userId);
    console.log(`  📊 Current day: ${state.currentDay}`);
    console.log(`  📊 Existing submissionDraft:`, state.submissionDraft);
    
    if (!state.submissionDraft) state.submissionDraft = {};
    state.submissionDraft[state.currentDay] = {
      text: draftText,
      savedAt: nowIso(),
    };
    
    console.log(`  ✅ Draft set for day ${state.currentDay}:`, {
      length: state.submissionDraft[state.currentDay].text.length,
      savedAt: state.submissionDraft[state.currentDay].savedAt
    });
    
    await stateStore.save(userId, state);
    
    console.log(`  ✓ Draft saved to database for day ${state.currentDay}`);
    return res.json({ ok: true });
  });

  app.post("/api/submit", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    const submissionText = String(req.body?.submissionText || "");
    const timeSpentMinutes = Number(req.body?.timeSpentMinutes || 0);
    console.log(`  📝 Processing submission for user: ${userId}`);
    console.log(`  📏 Submission length: ${submissionText.length} characters`);
    const submitPreview = submissionText.slice(0, 80).replace(/\s+/g, " ");
    console.log(`  🔎 Submission preview: "${submitPreview}${submissionText.length > 80 ? "..." : ""}"`);
    
    if (!submissionText.trim()) {
      console.log(`  ❌ Submission rejected: empty text`);
      return res.status(400).json({ ok: false, reject: { message: "Submission text is empty." } });
    }

    let state = await stateStore.getOrCreate(userId);
    const loadStateMs = elapsedMs(routeStart);
    console.log(`  ✓ User state loaded - Day ${state.currentDay}`);
    console.log(`  ⏱ Load state time: ${loadStateMs}ms`);
    try {
      state = await getOrGenerateDayContent({ stateStore, userId, state });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        reject: { message: e instanceof Error ? e.message : "Day generation failed" },
      });
    }

    const dayContent = state.dayContent;
    console.log(`  📚 Day meta: day=${dayContent?.dayNumber}, type=${dayContent?.dayType}, sentenceCount=${dayContent?.submissionTemplate?.sentenceCount}, questionCount=${dayContent?.submissionTemplate?.questionCount}`);

    console.log(`  🔍 Validating submission format...`);
    const validateStart = Date.now();
    const validation = parseAndValidateSubmission({ submissionText, dayContent });
    if (!validation.ok) {
      console.log(`  ❌ Validation failed: ${validation.reason}`);
      return res.status(400).json({
        ok: false,
        reject: { message: validation.reason, details: validation.details || [] },
      });
    }
    console.log(`  ✓ Submission format validated`);
    console.log(`  ⏱ Validation time: ${elapsedMs(validateStart)}ms`);
      console.log(`  🧠 Parsed submission: sentences=${validation.parsed?.sentencePractice?.length || 0}, questions=${validation.parsed?.questions?.length || 0}`);

    const evalStart = Date.now();
    let evaluation;
    try {
      console.log(`  🤖 Evaluating submission with AI...`);
      evaluation = await evaluateSubmissionGemini({
        dayContent,
        submissionParsed: validation.parsed,
        state,
      });
      console.log(
        `  ✓ Evaluation completed - Score: ${evaluation.overallPercent}% (${evaluation.tier}, ${evaluation.passFail}). ` +
          `counts: sentences=${evaluation.sentenceEvaluations?.length || 0}, questions=${evaluation.questions?.answers?.length || 0}, listening=${evaluation.listening?.answers?.length || 0}`
      );
      // Compact breakdown distribution for easy debug.
      const sent = Array.isArray(evaluation.sentenceEvaluations) ? evaluation.sentenceEvaluations : [];
      const sentCorrect = sent.filter((s) => s?.correctness === "Correct").length;
      const sentIncorrect = sent.length - sentCorrect;
      console.log(
        `  📊 scoreBreakdown: grammar(sentences)=${evaluation.scoreBreakdown?.sentencesPercent ?? "?"} writing=${evaluation.scoreBreakdown?.writingPercent ?? "?"} speaking=${evaluation.scoreBreakdown?.speakingPercent ?? "?"} conversation=${evaluation.scoreBreakdown?.conversationPercent ?? "?"} q=${evaluation.scoreBreakdown?.questionsPercent ?? "?"} listening=${evaluation.scoreBreakdown?.listeningPercent ?? "?"}`
      );
      console.log(`  🔢 sentences correctness: Correct=${sentCorrect} Incorrect=${sentIncorrect}`);
    } catch (e) {
      console.error(`  ❌ Evaluation failed:`, e instanceof Error ? e.message : e);
      return res.status(500).json({
        ok: false,
        reject: {
          message: e instanceof Error ? e.message : "Evaluation failed",
        },
      });
    }
    console.log(`  ⏱ AI evaluation time: ${elapsedMs(evalStart)}ms`);

    const progress = getOrCreateDayProgress(state, state.currentDay);
    if (progress.sectionsReadCount < REQUIRED_SECTION_COUNT) {
      return res.status(400).json({
        ok: false,
        reject: { message: `Complete at least ${REQUIRED_SECTION_COUNT} sections before submitting.` },
      });
    }
    progress.submissionStatus = "submitted";

    console.log(`  📊 Updating user state after evaluation...`);
    const updatedState = updateStateAfterEvaluation({
      state,
      dayContent,
      evaluation,
    });
    const dayKey = String(dayContent.dayNumber);
    updatedState.dailyAnalytics = updatedState.dailyAnalytics || {};
    const existingAnalytics = updatedState.dailyAnalytics[dayKey] || {};
    updatedState.dailyAnalytics[dayKey] = {
      ...existingAnalytics,
      dayStartTime: existingAnalytics.dayStartTime || nowIso(),
      submissionTime: nowIso(),
      timeToCompleteMinutes: timeSpentMinutes > 0 ? timeSpentMinutes : existingAnalytics.timeToCompleteMinutes || null,
      attemptNumber: Number(updatedState.attemptsByDay?.[dayKey] || 1),
    };
    updatedState.lastSubmissionParsed = validation.parsed;
    updatedState.tracker.totalTimeSpentMinutes =
      (updatedState.tracker.totalTimeSpentMinutes || 0) +
      (updatedState.dailyAnalytics[dayKey].timeToCompleteMinutes || 0);

    const nextAction = updatedState.currentDay !== state.currentDay ? "advance" : "retry";
    const updatedDayProgress = getOrCreateDayProgress(updatedState, dayContent.dayNumber);
    updatedDayProgress.submissionStatus = "evaluated";
    updatedDayProgress.evaluationResult = {
      overallPercent: evaluation.overallPercent,
      tier: evaluation.tier,
      passFail: evaluation.passFail,
    };
    updatedDayProgress.dayCompleted = nextAction === "advance";
    updatedDayProgress.dayAdvanced = nextAction === "advance";
    await stateStore.save(userId, updatedState);
    console.log(`  ✓ State saved - New day: ${updatedState.currentDay}`);
    console.log(`  ✓ Submission processed - Action: ${nextAction}`);
    console.log(`  ⏱ /api/submit total time: ${elapsedMs(routeStart)}ms`);

    res.json({
      ok: true,
      evaluation,
      tracker: updatedState.tracker,
      updatedTracker: updatedState.tracker,
      dayProgress: summarizeDayProgress(updatedDayProgress),
      nextDayPreview:
        updatedState.currentDay !== state.currentDay
          ? {
              dayNumber: updatedState.currentDay,
              theme: "Generated on load",
              grammarFocus: "AI selected",
              whatToExpect: "Personalized lesson based on your weak areas.",
            }
          : null,
      next: updatedState.currentDay !== state.currentDay ? { action: "advance", day: updatedState.currentDay } : { action: "retry", day: updatedState.currentDay },
    });
  });

  app.post("/api/retry-submit", authRequired, async (req, res) => {
    const userId = req.userId;
    const dayNumber = Number(req.body?.dayNumber || 0);
    const onlySections = Array.isArray(req.body?.onlyThesesections) ? req.body.onlyThesesections : [];
    const previousResults = req.body?.previousResults || null;
    const submissionText = String(req.body?.submissionText || "");
    const timeSpentMinutes = Number(req.body?.timeSpentMinutes || 0);
    const state = await stateStore.getOrCreate(userId);

    if (!state.dayContent || state.currentDay !== dayNumber) {
      return res.status(400).json({
        ok: false,
        reject: { message: `Retry is allowed only for current day (${state.currentDay}).` },
      });
    }

    const attempt = Number(state.attemptsByDay?.[String(dayNumber)] || 0) + 1;
    if (attempt > 3) {
      state.currentDay = dayNumber + 1;
      state.dayContent = null;
      state.tracker.finalStatus = "Completed";
      await stateStore.save(userId, state);
      return res.json({
        ok: true,
        movedOn: true,
        tracker: state.tracker,
        next: { action: "advance", day: state.currentDay },
        note: "Max retry reached. Move On applied.",
      });
    }

    const validation = parseAndValidateSubmission({ submissionText, dayContent: state.dayContent });
    if (!validation.ok) {
      return res.status(400).json({
        ok: false,
        reject: { message: validation.reason, details: validation.details || [] },
      });
    }

    let evaluation;
    try {
      evaluation = await evaluateSubmissionGemini({
        dayContent: state.dayContent,
        submissionParsed: validation.parsed,
        state,
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        reject: { message: e instanceof Error ? e.message : "Retry evaluation failed" },
      });
    }

    const updatedState = updateStateAfterEvaluation({
      state,
      dayContent: state.dayContent,
      evaluation,
    });
    const dayKey = String(dayNumber);
    updatedState.dailyAnalytics = updatedState.dailyAnalytics || {};
    updatedState.dailyAnalytics[dayKey] = {
      ...(updatedState.dailyAnalytics[dayKey] || {}),
      submissionTime: nowIso(),
      timeToCompleteMinutes: timeSpentMinutes || updatedState.dailyAnalytics[dayKey]?.timeToCompleteMinutes || null,
      attemptNumber: Number(updatedState.attemptsByDay?.[dayKey] || attempt),
    };

    await stateStore.save(userId, updatedState);

    return res.json({
      ok: true,
      evaluation,
      retryMeta: {
        onlySections,
        reusedPreviousResults: !!previousResults,
      },
      updatedTracker: updatedState.tracker,
      tracker: updatedState.tracker,
      next: updatedState.currentDay !== state.currentDay ? { action: "advance", day: updatedState.currentDay } : { action: "retry", day: updatedState.currentDay },
    });
  });

  // POST /api/reset - Full reset (all progress)
  app.post("/api/reset", authRequired, async (req, res) => {
    const userId = req.userId;
    console.log(`  🔄 Full reset: ${userId}`);
    await stateStore.reset(userId);
    console.log(`  ✓ Full reset completed`);
    res.json({ ok: true });
  });

  // POST /api/reset/today - Reset only today's work
  app.post("/api/reset/today", authRequired, async (req, res) => {
    const userId = req.userId;
    const forceRegenerate = req.body?.forceRegenerate === true;
    console.log(`  🔄 Reset today only: ${userId}${forceRegenerate ? ' (force regenerate)' : ''}`);
    
    try {
      const state = await stateStore.getOrCreate(userId);
      const currentDay = state.currentDay;
      
      // Clear today's submission and evaluation
      state.lastSubmissionParsed = null;
      state.lastEvaluation = null;
      state.submissionDraft = state.submissionDraft || {};
      delete state.submissionDraft[currentDay];
      
      // Force regenerate day content if requested
      if (forceRegenerate) {
        console.log(`  🔄 Force regenerating day ${currentDay} content...`);
        state.dayContent = null;
        state.dayContentGeneratedDate = null;
      }
      
      // Reset day progress
      state.dayProgress = {
        dayNumber: currentDay,
        sectionsRead: {},
        sectionsReadCount: 0,
        totalSections: 8,
        readPercentage: 0,
        submissionStatus: "not_started",
        evaluationResult: null,
        dayCompleted: false,
        dayAdvanced: false,
        canSubmit: false,
        requiredSections: 6,
      };
      
      // Reset consecutive fails for current day
      state.consecutiveFailsOnCurrentDay = 0;
      
      // Update tracker status
      state.tracker.todayWorkStatus = {
        "Warm-up": "Pending",
        "Grammar": "Pending",
        "Pronunciation": "Pending",
        "Vocabulary": "Pending",
        "Listening": "Pending",
        "Core Tasks": "Pending",
        "Sentences": "Pending",
        "Questions": "Pending",
      };
      state.tracker.finalStatus = "Waiting for Submission";
      
      await stateStore.save(userId, state);
      console.log(`  ✓ Today's work reset completed for day ${currentDay}`);
      res.json({ ok: true, message: `Day ${currentDay} reset successfully` });
    } catch (error) {
      console.error(`  ❌ Reset today failed:`, error);
      res.status(500).json({ ok: false, reject: { message: "Failed to reset today" } });
    }
  });

  // GET /api/history - Get all past days' work and results
  app.get("/api/history", authRequired, async (req, res) => {
    const userId = req.userId;
    console.log(`  📚 GET /api/history - User: ${userId}`);
    
    try {
      const state = await stateStore.getOrCreate(userId);
      
      // Build history from scoreHistory with full evaluation data
      const history = (state.scoreHistory || []).map((entry) => ({
        dayNumber: entry.dayNumber,
        date: entry.date || entry.createdAt,
        overallPercent: entry.overallPercent,
        tier: entry.tier,
        passFail: entry.passFail,
        scoreBreakdown: entry.scoreBreakdown,
        theme: entry.theme || "Unknown",
        grammarFocus: entry.grammarFocus || "Unknown",
        fullEvaluation: entry.fullEvaluation || null,
      }));
      
      console.log(`  ✓ History retrieved - ${history.length} days`);
      res.json({ 
        ok: true, 
        history,
        currentDay: state.currentDay,
        totalDaysCompleted: state.tracker.totalDaysCompleted,
        streak: state.tracker.streak,
      });
    } catch (error) {
      console.error(`  ❌ Error retrieving history:`, error);
      res.status(500).json({ ok: false, reject: { message: "Failed to retrieve history" } });
    }
  });

  // ============================================================================
  // TEST ROUTES - Cumulative Test System
  // ============================================================================
  
  const { generateTestGemini } = require("./trainer/testGenerator");
  const { evaluateTestGemini } = require("./trainer/testEvaluator");
  const { stripCorrectAnswers, validateTestSubmission, sendError, createAutoSaveResponse } = require("./trainer/testUtils");

  // GET /api/test - Retrieve current test state
  app.get("/api/test", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    console.log(`  📝 GET /api/test - User: ${userId}`);
    
    try {
      const state = await stateStore.getOrCreate(userId);
      
      // Check if currentTest exists and is for current day
      if (!state.currentTest || state.currentTest.forDay !== state.currentDay) {
        console.log(`  ℹ No valid test for current day`);
        console.log(`  ⏱ GET /api/test completed in ${Date.now() - routeStart}ms`);
        return res.json({ ok: true, test: null, status: "no_test" });
      }
      
      // Strip correct answers if status is "pending"
      const test = stripCorrectAnswers(state.currentTest);
      
      console.log(`  ✓ Test retrieved - Status: ${state.currentTest.status}, Questions: ${state.currentTest.questions.length}, Answered: ${Object.keys(state.currentTest.userAnswers).length}`);
      console.log(`  ⏱ GET /api/test completed in ${Date.now() - routeStart}ms`);
      return res.json({ ok: true, test, status: state.currentTest.status });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error retrieving test:`, {
        userId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - routeStart
      });
      return sendError(res, 500, "Failed to retrieve test");
    }
  });

  // POST /api/test/generate - Generate new test
  app.post("/api/test/generate", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    console.log(`  📝 POST /api/test/generate - User: ${userId}`);
    
    try {
      const state = await stateStore.getOrCreate(userId);
      
      // Verify eligibility (passed today's evaluation)
      if (!state.lastEvaluation || state.lastEvaluation.overallPercent < 76) {
        console.log(`  ⚠ User not eligible - No evaluation or score < 76%`);
        console.log(`  ⏱ POST /api/test/generate completed in ${Date.now() - routeStart}ms`);
        return sendError(res, 403, "Complete daily evaluation with ≥76% to access test");
      }
      
      console.log(`  ✓ User eligible - Generating test for Day ${state.currentDay}`);
      
      // Generate test
      const genStart = Date.now();
      const testResult = await generateTestGemini({
        state,
        forDay: state.currentDay,
        userId
      });
      const genDuration = Date.now() - genStart;
      
      // Create currentTest object
      state.currentTest = {
        testId: `test_day${state.currentDay}_v${testResult.version}`,
        forDay: state.currentDay,
        generatedAt: new Date().toISOString(),
        version: testResult.version,
        status: "pending",
        questions: testResult.questions,
        userAnswers: {},
        result: null
      };
      
      await stateStore.save(userId, state);
      
      console.log(`  ✓ Test generated successfully - ${testResult.questions.length} questions`);
      console.log(`  ⏱ Test generation: ${genDuration}ms, Total: ${Date.now() - routeStart}ms`);
      
      // Strip correct answers before returning
      const test = stripCorrectAnswers(state.currentTest);
      return res.json({ ok: true, test });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error generating test:`, {
        userId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - routeStart,
        isQuotaError: errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota"),
        isTimeoutError: errorMsg.toLowerCase().includes("timeout")
      });
      
      // Return specific error messages
      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")) {
        return sendError(res, 503, "AI service is temporarily busy. Please try again in a moment.");
      } else if (errorMsg.toLowerCase().includes("timeout")) {
        return sendError(res, 504, "Test generation timed out. Please try again.");
      } else {
        return sendError(res, 500, "Failed to generate test");
      }
    }
  });

  // PATCH /api/test/answer - Auto-save answer
  app.patch("/api/test/answer", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    const { questionId, answer } = req.body;
    
    try {
      const state = await stateStore.getOrCreate(userId);
      
      if (!state.currentTest || state.currentTest.status !== "pending") {
        console.log(`  ⚠ Auto-save rejected - No active test (userId: ${userId})`);
        return sendError(res, 400, "No active test");
      }
      
      // Validate that questionId exists in test
      const questionExists = state.currentTest.questions.some(
        q => q.questionId === questionId
      );
      
      if (!questionExists) {
        console.log(`  ⚠ Auto-save rejected - Invalid question ID: ${questionId} (userId: ${userId})`);
        return sendError(res, 400, "Invalid question ID");
      }
      
      // Update answer
      state.currentTest.userAnswers[questionId] = answer;
      await stateStore.save(userId, state);
      
      const totalAnswered = Object.keys(state.currentTest.userAnswers).length;
      console.log(`  ✓ Auto-save successful - Question: ${questionId}, Progress: ${totalAnswered}/20, Duration: ${Date.now() - routeStart}ms`);
      
      return res.json({ ok: true });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error saving answer:`, {
        userId,
        questionId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - routeStart
      });
      return sendError(res, 500, "Failed to save answer");
    }
  });

  // POST /api/test/submit - Submit test for evaluation
  app.post("/api/test/submit", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    console.log(`  📝 POST /api/test/submit - User: ${userId}`);
    
    try {
      const state = await stateStore.getOrCreate(userId);
      
      if (!state.currentTest || state.currentTest.status !== "pending") {
        console.log(`  ⚠ Submission rejected - No active test (userId: ${userId})`);
        return sendError(res, 400, "No active test");
      }
      
      // Validate submission completeness
      const validation = validateTestSubmission(state.currentTest);
      if (!validation.ok) {
        console.log(`  ⚠ Validation failed:`, validation.details);
        return sendError(res, 400, validation.message, validation.details);
      }
      
      console.log(`  ✓ Validation passed - Evaluating test`);
      
      // Evaluate test
      const evalStart = Date.now();
      const evaluation = await evaluateTestGemini({
        test: state.currentTest,
        userAnswers: state.currentTest.userAnswers,
        state
      });
      const evalDuration = Date.now() - evalStart;
      
      // Update test status and result
      state.currentTest.status = "evaluated";
      state.currentTest.result = evaluation;
      await stateStore.save(userId, state);
      
      console.log(`  ✓ Test evaluated - Score: ${evaluation.overallScore}%, Passed: ${evaluation.passed}, Correct: ${evaluation.correctCount}/20`);
      console.log(`  ⏱ Evaluation: ${evalDuration}ms, Total: ${Date.now() - routeStart}ms`);
      
      // Return evaluation and full test (with correct answers)
      return res.json({ ok: true, evaluation, test: state.currentTest });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error submitting test:`, {
        userId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - routeStart,
        isQuotaError: errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota"),
        isTimeoutError: errorMsg.toLowerCase().includes("timeout")
      });
      
      // Check for specific error types
      if (errorMsg.includes("quota") || errorMsg.includes("429")) {
        return sendError(res, 503, "AI evaluation service temporarily unavailable");
      } else if (errorMsg.includes("timeout")) {
        return sendError(res, 504, "Evaluation timeout - please try again");
      } else {
        return sendError(res, 500, "Evaluation failed - please retry");
      }
    }
  });

  // POST /api/test/retake - Reset test for retake
  app.post("/api/test/retake", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    console.log(`  📝 POST /api/test/retake - User: ${userId}`);
    
    try {
      const state = await stateStore.getOrCreate(userId);
      
      if (!state.currentTest || state.currentTest.status !== "evaluated") {
        console.log(`  ⚠ Retake rejected - No evaluated test (userId: ${userId})`);
        return sendError(res, 400, "No evaluated test to retake");
      }
      
      // Reset answers and status
      state.currentTest.userAnswers = {};
      state.currentTest.status = "pending";
      state.currentTest.result = null;
      await stateStore.save(userId, state);
      
      console.log(`  ✓ Test reset for retake - TestId: ${state.currentTest.testId}`);
      console.log(`  ⏱ POST /api/test/retake completed in ${Date.now() - routeStart}ms`);
      
      // Return test with stripped correct answers
      const test = stripCorrectAnswers(state.currentTest);
      return res.json({ ok: true, test });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error retaking test:`, {
        userId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - routeStart
      });
      return sendError(res, 500, "Failed to reset test");
    }
  });

  // POST /api/test/new - Generate new test version
  app.post("/api/test/new", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    console.log(`  📝 POST /api/test/new - User: ${userId}`);
    
    try {
      const state = await stateStore.getOrCreate(userId);
      
      if (!state.currentTest || state.currentTest.status !== "evaluated") {
        console.log(`  ⚠ New test rejected - Can only generate after evaluation (userId: ${userId})`);
        return sendError(res, 400, "Can only generate new test after evaluation");
      }
      
      // Increment version number
      const newVersion = state.currentTest.version + 1;
      
      console.log(`  ✓ Generating new test version ${newVersion} for Day ${state.currentDay}`);
      
      // Generate new test
      const genStart = Date.now();
      const testResult = await generateTestGemini({
        state,
        forDay: state.currentDay,
        userId,
        version: newVersion
      });
      const genDuration = Date.now() - genStart;
      
      // Replace entire currentTest object
      state.currentTest = {
        testId: `test_day${state.currentDay}_v${newVersion}`,
        forDay: state.currentDay,
        generatedAt: new Date().toISOString(),
        version: newVersion,
        status: "pending",
        questions: testResult.questions,
        userAnswers: {},
        result: null
      };
      
      await stateStore.save(userId, state);
      
      console.log(`  ✓ New test generated - Version ${newVersion}, ${testResult.questions.length} questions`);
      console.log(`  ⏱ Test generation: ${genDuration}ms, Total: ${Date.now() - routeStart}ms`);
      
      // Return new test with stripped correct answers
      const test = stripCorrectAnswers(state.currentTest);
      return res.json({ ok: true, test });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ Error generating new test:`, {
        userId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - routeStart,
        isQuotaError: errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota"),
        isTimeoutError: errorMsg.toLowerCase().includes("timeout")
      });
      
      // Return specific error messages
      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")) {
        return sendError(res, 503, "AI service is temporarily busy. Please try again in a moment.");
      } else if (errorMsg.toLowerCase().includes("timeout")) {
        return sendError(res, 504, "Test generation timed out. Please try again.");
      } else {
        return sendError(res, 500, "Failed to generate new test");
      }
    }
  });

  app.listen(PORT, () => {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Logging enabled for all routes and processes`);
    console.log(`${"=".repeat(50)}\n`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

