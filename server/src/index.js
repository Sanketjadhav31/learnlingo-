const express = require("express");
const cors = require("cors");
// Load environment variables from server/.env explicitly.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const logger = require("./logger");
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

  // Check if we already have today's content in DB
  if (state.dayContent && 
      state.dayContent.dayNumber === state.currentDay &&
      state.dayContentGeneratedDate === todayIST) {
    
    return state;
  }

  // If content exists for current day but was generated on a different date, still use it
  // (Don't regenerate content just because the date changed - only regenerate when day advances)
  if (state.dayContent && state.dayContent.dayNumber === state.currentDay) {
    
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

      // Update the generated date
      latest.dayContentGeneratedDate = todayIST;
      await stateStore.save(userId, latest);
      return;
    }

    
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
    
    // Log incoming request
    logger.apiRequest(req.method, req.path, req.query, req.body);

    res.on("finish", () => {
      const duration = Date.now() - start;
      // Create summary based on endpoint
      let summary = '';
      if (req.path.includes('/submit')) summary = res.statusCode === 200 ? 'submitted' : 'failed';
      else if (req.path.includes('/day')) summary = res.statusCode === 200 ? 'loaded' : 'error';
      else if (req.path.includes('/reset')) summary = 'reset';
      
      logger.apiResponse(req.method, req.path, res.statusCode, duration, summary);
    });
    next();
  });

  const mongoConn = await connectMongo(process.env.MONGODB_URI);
  logger.storage(mongoConn.enabled ? 'MongoDB' : 'File-based');
  
  const stateStore = stateStoreFactory({ mongoConn });
  const UserAuth = getUserAuthModel();

  app.get("/api/health", (req, res) => {

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
    logger.authSignup(email);
    return res.json({ ok: true, token, user: { userId, name: user.name, email: user.email } });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await UserAuth.findOne({ email });
    if (!user) {
      logger.authFailed(email, 'email not found');
      return res.status(404).json({ ok: false, reject: { message: "Email not registered." } });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      logger.authFailed(email, 'incorrect password');
      return res.status(401).json({ ok: false, reject: { message: "Incorrect password." } });
    }
    user.lastLoginAt = new Date();
    await user.save();
    const userId = String(user._id);
    const token = signAuthToken({ userId, email: user.email, name: user.name });
    logger.authLogin(email);
    return res.json({ ok: true, token, user: { userId, name: user.name, email: user.email } });
  });

  app.get("/api/auth/verify", authRequired, async (req, res) => {
    const user = await UserAuth.findById(req.userId).lean();
    if (!user || !user.isActive) return res.status(401).json({ ok: false, reject: { message: "Session user is inactive." } });
    return res.json({ ok: true, user: { userId: String(user._id), name: user.name, email: user.email } });
  });

  app.get("/api/status", authRequired, async (req, res) => {
    const userId = req.userId;

    const state = await stateStore.getOrCreate(userId);

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

    let state = await stateStore.getOrCreate(userId);

    try {
      state = await getOrGenerateDayContent({ stateStore, userId, state });
      if (state.dayContent?.dayNumber === state.currentDay) {
        
      }
    } catch (e) {

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
    
    console.log(`📤 Sending day content to frontend:`);
    console.log(`   Vocabulary count: ${vocabCount}`);
    if (vocabSample) {
      console.log(`   Vocabulary[0]: ${vocabSample.word}`);
      console.log(`   Vocabulary[0].hindiMeaning: "${vocabSample.hindiMeaning}"`);
      console.log(`   Vocabulary[0].examples: ${vocabSample.examples?.length || 0} items`);
      if (vocabSample.examples && vocabSample.examples.length > 0) {
        console.log(`   Vocabulary[0].examples[0]: "${vocabSample.examples[0]?.substring(0, 50)}..."`);
      }
    }
    const pronSample = state.dayContent?.pronunciation?.words?.[0];
    if (pronSample) {
      console.log(`   Pronunciation[0]: ${pronSample.word}`);
      console.log(`   Pronunciation[0].hindiMeaning: "${pronSample.hindiMeaning}"`);
      console.log(`   Pronunciation[0].examples: ${pronSample.examples?.length || 0} items`);
    }



    
    
    const draftText = state.submissionDraft?.[state.currentDay]?.text || "";

    if (draftText.length > 0) {
      
    }
    
    

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

    const state = await stateStore.getOrCreate(userId);


    if (!state.submissionDraft) state.submissionDraft = {};
    state.submissionDraft[state.currentDay] = {
      text: draftText,
      savedAt: nowIso(),
    };

    await stateStore.save(userId, state);

    return res.json({ ok: true });
  });

  app.post("/api/submit", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;
    const submissionText = String(req.body?.submissionText || "");
    const timeSpentMinutes = Number(req.body?.timeSpentMinutes || 0);
    logger.submitStart(userId, submissionText.length, timeSpentMinutes);

    const submitPreview = submissionText.slice(0, 80).replace(/\s+/g, " ");

    if (!submissionText.trim()) {
      return res.status(400).json({ ok: false, reject: { message: "Submission text is empty." } });
    }

    let state = await stateStore.getOrCreate(userId);
    const loadStateMs = elapsedMs(routeStart);

    try {
      state = await getOrGenerateDayContent({ stateStore, userId, state });
    } catch (e) {
      logger.error('Day generation', e instanceof Error ? e.message : e);
      return res.status(500).json({
        ok: false,
        reject: { message: e instanceof Error ? e.message : "Day generation failed" },
      });
    }

    const dayContent = state.dayContent;

    const validateStart = Date.now();
    const validation = parseAndValidateSubmission({ submissionText, dayContent });
    if (!validation.ok) {
      logger.validation(false, validation.reason);
      return res.status(400).json({
        ok: false,
        reject: { message: validation.reason, details: validation.details || [] },
      });
    }
    logger.validation(true);

    

    const evalStart = Date.now();
    let evaluation;
    try {
      logger.evalStart();
      evaluation = await evaluateSubmissionGemini({
        dayContent,
        submissionParsed: validation.parsed,
        state,
      });
      const passThreshold = dayContent.dayType === "weekly_review" ? 75 : 70;
      const passed = evaluation.overallPercent >= passThreshold;
      logger.evalComplete(evaluation.overallPercent, evaluation.tier, passed, elapsedMs(evalStart));
      
      // Log score breakdown
      if (evaluation.scoreBreakdown) {
        logger.scoreBreakdown(evaluation.scoreBreakdown);
      }
      
      // Compact breakdown distribution for easy debug.
      const sent = Array.isArray(evaluation.sentenceEvaluations) ? evaluation.sentenceEvaluations : [];
      const sentCorrect = sent.filter((s) => s?.correctness === "Correct").length;
      const sentIncorrect = sent.length - sentCorrect;
    } catch (e) {
      logger.error('Evaluation', e instanceof Error ? e.message : e);
      return res.status(500).json({
        ok: false,
        reject: {
          message: e instanceof Error ? e.message : "Evaluation failed",
        },
      });
    }
    

    const progress = getOrCreateDayProgress(state, state.currentDay);
    if (progress.sectionsReadCount < REQUIRED_SECTION_COUNT) {
      return res.status(400).json({
        ok: false,
        reject: { message: `Complete at least ${REQUIRED_SECTION_COUNT} sections before submitting.` },
      });
    }
    progress.submissionStatus = "submitted";

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
    
    // Log day advancement or retry
    if (nextAction === "advance") {
      logger.dayAdvance(state.currentDay, updatedState.currentDay);
    } else {
      const attempt = Number(updatedState.attemptsByDay?.[String(state.currentDay)] || 1);
      logger.dayRetry(state.currentDay, attempt);
    }
    
    logger.info(`Submit complete: ${nextAction}, total time ${elapsedMs(routeStart)}ms`);

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

    await stateStore.reset(userId);

    res.json({ ok: true });
  });

  // POST /api/reset/today - Reset only today's work
  app.post("/api/reset/today", authRequired, async (req, res) => {
    const userId = req.userId;
    const forceRegenerate = req.body?.forceRegenerate === true;
    
    
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

      res.json({ ok: true, message: `Day ${currentDay} reset successfully` });
    } catch (error) {

      res.status(500).json({ ok: false, reject: { message: "Failed to reset today" } });
    }
  });

  // GET /api/history - Get all past days' work and results
  app.get("/api/history", authRequired, async (req, res) => {
    const userId = req.userId;

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

      res.json({ 
        ok: true, 
        history,
        currentDay: state.currentDay,
        totalDaysCompleted: state.tracker.totalDaysCompleted,
        streak: state.tracker.streak,
      });
    } catch (error) {

      res.status(500).json({ ok: false, reject: { message: "Failed to retrieve history" } });
    }
  });

  // GET /api/progress - Get user progress dashboard
  app.get("/api/progress", authRequired, async (req, res) => {
    const userId = req.userId;

    try {
      const { getUserProgress } = require("./trainer/progressService");
      const state = await stateStore.getOrCreate(userId);
      
      const progress = getUserProgress(state);
      
      
      res.json({ 
        ok: true, 
        progress,
      });
    } catch (error) {

      res.status(500).json({ ok: false, reject: { message: "Failed to retrieve progress" } });
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

    try {
      const state = await stateStore.getOrCreate(userId);
      
      // Check if currentTest exists and is for current day
      if (!state.currentTest || state.currentTest.forDay !== state.currentDay) {

        
        return res.json({ ok: true, test: null, status: "no_test" });
      }
      
      // Strip correct answers if status is "pending"
      const test = stripCorrectAnswers(state.currentTest);
      
      
      
      return res.json({ ok: true, test, status: state.currentTest.status });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      return sendError(res, 500, "Failed to retrieve test");
    }
  });

  // POST /api/test/generate - Generate new test
  app.post("/api/test/generate", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;

    try {
      const state = await stateStore.getOrCreate(userId);
      
      // Verify eligibility (passed today's evaluation)
      if (!state.lastEvaluation || state.lastEvaluation.overallPercent < 76) {

        
        return sendError(res, 403, "Complete daily evaluation with ≥76% to access test");
      }

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

      
      
      // Strip correct answers before returning
      const test = stripCorrectAnswers(state.currentTest);
      return res.json({ ok: true, test });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      
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
        
        return sendError(res, 400, "No active test");
      }
      
      // Validate that questionId exists in test
      const questionExists = state.currentTest.questions.some(
        q => q.questionId === questionId
      );
      
      if (!questionExists) {
        
        return sendError(res, 400, "Invalid question ID");
      }
      
      // Update answer
      state.currentTest.userAnswers[questionId] = answer;
      await stateStore.save(userId, state);
      
      const totalAnswered = Object.keys(state.currentTest.userAnswers).length;
      
      
      return res.json({ ok: true });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      return sendError(res, 500, "Failed to save answer");
    }
  });

  // POST /api/test/submit - Submit test for evaluation
  app.post("/api/test/submit", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;

    try {
      const state = await stateStore.getOrCreate(userId);
      
      if (!state.currentTest || state.currentTest.status !== "pending") {
        
        return sendError(res, 400, "No active test");
      }
      
      // Validate submission completeness
      const validation = validateTestSubmission(state.currentTest);
      if (!validation.ok) {

        return sendError(res, 400, validation.message, validation.details);
      }

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

      
      
      // Return evaluation and full test (with correct answers)
      return res.json({ ok: true, evaluation, test: state.currentTest });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      
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

    try {
      const state = await stateStore.getOrCreate(userId);
      
      if (!state.currentTest || state.currentTest.status !== "evaluated") {
        
        return sendError(res, 400, "No evaluated test to retake");
      }
      
      // Reset answers and status
      state.currentTest.userAnswers = {};
      state.currentTest.status = "pending";
      state.currentTest.result = null;
      await stateStore.save(userId, state);

      
      
      // Return test with stripped correct answers
      const test = stripCorrectAnswers(state.currentTest);
      return res.json({ ok: true, test });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      return sendError(res, 500, "Failed to reset test");
    }
  });

  // POST /api/test/new - Generate new test version
  app.post("/api/test/new", authRequired, async (req, res) => {
    const routeStart = Date.now();
    const userId = req.userId;

    try {
      const state = await stateStore.getOrCreate(userId);
      
      if (!state.currentTest || state.currentTest.status !== "evaluated") {
        
        return sendError(res, 400, "Can only generate new test after evaluation");
      }
      
      // Increment version number
      const newVersion = state.currentTest.version + 1;

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

      
      
      // Return new test with stripped correct answers
      const test = stripCorrectAnswers(state.currentTest);
      return res.json({ ok: true, test });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      
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
    


    
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console

  process.exit(1);
});

