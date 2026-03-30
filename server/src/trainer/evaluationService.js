const { EvaluationSchema } = require("./schemas");
const { callGeminiJsonWithFallback } = require("./geminiClient");
const { SYSTEM_TRAINER_PROMPT } = require("./prompts");
const { buildCompressedContext, migrateFromLegacyState } = require("./contextBuilder");
const { validateCompressedContext } = require("./contextValidator");

/**
 * Extract strong areas from evaluation data
 * @param {Object} src - Source evaluation data
 * @param {Object} scoreBreakdown - Score breakdown percentages
 * @returns {Array<string>} Strong areas (max 5)
 */
function extractStrongAreas(src, scoreBreakdown) {
  const strongAreas = [];
  
  // Check if strongAreas is already provided
  if (src.strongAreas && Array.isArray(src.strongAreas)) {
    return src.strongAreas.slice(0, 5);
  }
  
  // Extract from score breakdown (areas with >= 80%)
  if (scoreBreakdown.sentencesPercent >= 80) {
    strongAreas.push("Grammar and sentence structure");
  }
  if (scoreBreakdown.writingPercent >= 80) {
    strongAreas.push("Writing task completion");
  }
  if (scoreBreakdown.speakingPercent >= 80) {
    strongAreas.push("Speaking fluency");
  }
  if (scoreBreakdown.conversationPercent >= 80) {
    strongAreas.push("Conversational skills");
  }
  if (scoreBreakdown.questionsPercent >= 80) {
    strongAreas.push("Comprehension questions");
  }
  if (scoreBreakdown.listeningPercent >= 80) {
    strongAreas.push("Listening comprehension");
  }
  if (scoreBreakdown.hindiTranslationPercent >= 80) {
    strongAreas.push("Translation skills");
  }
  
  // Also check for explicit strengths in the source
  if (src.strengths && Array.isArray(src.strengths)) {
    strongAreas.push(...src.strengths.map(s => String(s).trim()).filter(Boolean));
  }
  
  // Remove duplicates and limit to 5
  return [...new Set(strongAreas)].slice(0, 5);
}

/**
 * Extract recurring mistake patterns from sentence evaluations
 * @param {Array} sentenceEvaluations - Sentence evaluation array
 * @returns {Array<string>} Recurring mistake patterns (max 10)
 */
function extractRecurringMistakePatterns(sentenceEvaluations) {
  if (!Array.isArray(sentenceEvaluations) || sentenceEvaluations.length === 0) {
    return [];
  }
  
  // Count error types and reasons
  const errorCounts = {};
  const errorReasons = {};
  
  for (const sentence of sentenceEvaluations) {
    if (sentence.correctness === "Incorrect") {
      // Count error types
      if (sentence.errorType && sentence.errorType !== "N/A") {
        const errorType = String(sentence.errorType).trim();
        errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
      }
      
      // Collect error reasons
      if (sentence.errorReason && sentence.errorReason !== "N/A") {
        const errorReason = String(sentence.errorReason).trim();
        if (errorReason.length > 10) { // Only meaningful reasons
          errorReasons[errorReason] = (errorReasons[errorReason] || 0) + 1;
        }
      }
    }
  }
  
  // Find patterns that appear 2+ times
  const patterns = [];
  
  // Add error types that appear multiple times
  for (const [errorType, count] of Object.entries(errorCounts)) {
    if (count >= 2) {
      patterns.push(`${errorType} (appeared ${count} times)`);
    }
  }
  
  // Add specific error reasons that appear multiple times
  for (const [errorReason, count] of Object.entries(errorReasons)) {
    if (count >= 2) {
      patterns.push(errorReason);
    }
  }
  
  // If no recurring patterns, add the most common single errors
  if (patterns.length === 0) {
    const sortedErrors = Object.entries(errorReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    for (const [errorReason] of sortedErrors) {
      patterns.push(errorReason);
    }
  }
  
  // Remove duplicates and limit to 10
  return [...new Set(patterns)].slice(0, 10);
}

function pickEvaluationPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  // Gemini output sometimes "echoes" back parts of the request (like submissionTemplate)
  // inside a nested key (e.g. { submissionEvaluation: { submissionTemplate: ... } }).
  // So we only unwrap if the candidate looks like a real EvaluationSchema payload.
  const looksLikeEvaluation = (o) => {
    if (!o || typeof o !== "object") return false;
    const hasCoreScalars = "overallPercent" in o || "tier" in o || "passFail" in o;
    const hasSentenceArray = Array.isArray(o.sentenceEvaluations) || Array.isArray(o.sentences) || Array.isArray(o.sentenceFeedback);
    const hasQuestionAnswers = Array.isArray(o?.questions?.answers) || Array.isArray(o?.questions?.items) || Array.isArray(o?.questionAnswers);
    const hasListeningAnswers = Array.isArray(o?.listening?.answers) || Array.isArray(o?.listening?.items) || Array.isArray(o?.listeningAnswers);
    const hasMistakes = Array.isArray(o.commonMistakesTop3) || Array.isArray(o.weakAreas);
    return hasCoreScalars || hasSentenceArray || hasQuestionAnswers || hasListeningAnswers || hasMistakes;
  };

  const candidates = [
    parsed,
    parsed.evaluation,
    parsed.submissionEvaluation,
    parsed.evaluationResult,
    parsed.result,
    parsed.data,
  ].filter((x) => x && typeof x === "object");

  const best = candidates.find((c) => looksLikeEvaluation(c));
  return best || parsed;
}

function normalizeEvaluationShape(input) {
  if (!input || typeof input !== "object") return input;
  
  // First, try to unwrap nested evaluation structures
  const looksLikeEvaluation = (o) => {
    if (!o || typeof o !== "object") return false;
    return (
      "overallPercent" in o ||
      "tier" in o ||
      "passFail" in o ||
      Array.isArray(o.sentenceEvaluations) ||
      Array.isArray(o?.questions?.answers) ||
      Array.isArray(o?.listening?.answers) ||
      Array.isArray(o.commonMistakesTop3) ||
      Array.isArray(o.weakAreas)
    );
  };

  // Try multiple unwrapping paths
  let src = input;
  if (input.evaluation && looksLikeEvaluation(input.evaluation)) {
    src = input.evaluation;
  } else if (input.submissionEvaluation && looksLikeEvaluation(input.submissionEvaluation)) {
    src = input.submissionEvaluation;
  } else if (input.evaluationResult && looksLikeEvaluation(input.evaluationResult)) {
    src = input.evaluationResult;
  }
  const toPercent = (v, fallback = 0) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(100, Math.round(n)));
  };
  const toItemsFromString = (s) => {
    const raw = String(s ?? "").trim();
    if (!raw) return [];
    // Accept formats like:
    // - "1. ... 2. ... 3. ..."
    // - "a, b, c"
    // - newline separated
    const normalized = raw
      .replace(/\r\n/g, "\n")
      .replace(/[\|;]/g, ",")
      .replace(/\n{2,}/g, "\n")
      .replace(/(\s*\d+\s*[\.\)])\s*/g, "• ");
    const parts = normalized
      .split(/\n|,/g)
      .map((x) => String(x).replace(/^•\s*/g, "").trim())
      .filter(Boolean);
    return parts.slice(0, 10);
  };
  const normalizeCorrectness = (value) => {
    if (typeof value === "boolean") return value ? "Correct" : "Incorrect";
    if (typeof value === "number") return value >= 0.5 ? "Correct" : "Incorrect";
    const s = String(value ?? "").trim().toLowerCase();
    if (!s) return "Incorrect";
    if (
      s === "true" ||
      s === "correct" ||
      s === "pass" ||
      s === "ok" ||
      s === "passed" ||
      s === "yes" ||
      s === "y"
    )
      return "Correct";
    if (
      s === "false" ||
      s === "incorrect" ||
      s === "wrong" ||
      s === "error" ||
      s === "fail" ||
      s === "failed" ||
      s === "no" ||
      s === "n"
    )
      return "Incorrect";
    if (s.includes("yes") || s.includes("correct") || s.includes("pass") || s.includes("ok")) return "Correct";
    if (s.includes("no") || s.includes("incorrect") || s.includes("wrong") || s.includes("fail") || s.includes("error")) return "Incorrect";
    if (s.includes("incorrect") || s.includes("wrong") || s.includes("error")) return "Incorrect";
    return "Correct";
  };
  const asArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object" && Array.isArray(v.items)) return v.items;
    if (typeof v === "string") return toItemsFromString(v);
    return [];
  };
  const extractArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      if (Array.isArray(v.items)) return v.items;
      if (Array.isArray(v.answers)) return v.answers;
      if (Array.isArray(v.evaluations)) return v.evaluations;
      if (Array.isArray(v.feedback)) return v.feedback;
    }
    return [];
  };

  const sentenceEvaluations = extractArray(src.sentenceEvaluations ?? src.sentences ?? src.sentenceFeedback ?? src.sentencePractice).map((row, i) => ({
    k: Number(row?.k || row?.idx || i + 1),
    correctness: normalizeCorrectness(
      row?.correctness ??
        row?.verdict ??
        row?.isCorrect ??
        row?.result ??
        row?.status ??
        row?.passed ??
        row?.pass ??
        row?.failed ??
        row?.fail ??
        row?.correct ??
        row?.wrong
    ),
    errorType: String(row?.errorType ?? row?.type ?? row?.category ?? ""),
    errorReason: String(row?.errorReason ?? row?.reason ?? row?.issue ?? row?.mistakeReason ?? ""),
    tip: String(row?.tip ?? row?.learningTip ?? row?.hint ?? ""),
    original: row?.original ?? row?.learnerSentence ?? row?.sentence ?? row?.input ?? row?.given,
    correctVersion: String(
      row?.correctVersion ??
        row?.correction ??
        row?.fixed ??
        row?.suggested ??
        row?.correct ??
        row?.improved ??
        row?.output ??
        row?.original ??
        "No correction provided"
    ),
    naturalVersion: String(
      row?.naturalVersion ??
        row?.natural ??
        row?.improved ??
        row?.naturalRewrite ??
        row?.rephrased ??
        row?.correctVersion ??
        row?.original ??
        "No natural rewrite provided"
    ),
  }));

  const questionSource =
    src?.questions?.answers ??
    src?.questions?.items ??
    src.questions ??
    // Gemini may wrap answers under questionsEvaluation (plural + Evaluation)
    src?.questionsEvaluation?.answers ??
    src?.questionsEvaluation?.items ??
    src.questionsEvaluation ??
    src?.questionsEvaluations ??
    src.questionEvaluations ??
    src.questionEvaluation ??
    src.questionFeedback ??
    src.questionCorrections ??
    src.questionAnswers;

  const questionAnswers = extractArray(questionSource).map((row, i) => ({
    k: Number(row?.k || row?.idx || i + 1),
    correctness: normalizeCorrectness(
      row?.correctness ??
        row?.status ??
        row?.result ??
        row?.passed ??
        row?.pass ??
        row?.failed ??
        row?.fail ??
        row?.verdict
    ),
    original: row?.original ? String(row.original) : undefined,
    correctVersion: row?.correctVersion ? String(row.correctVersion) : undefined,
    errorReason: row?.errorReason ? String(row.errorReason) : undefined,
    feedback: row?.feedback ? String(row.feedback) : undefined,
  }));
  const listeningSource =
    src?.listening?.answers ??
    src?.listening?.items ??
    src.listening ??
    src.listeningEvaluations ??
    src.listeningEvaluation ??
    src.listeningFeedback ??
    src.listeningCorrections ??
    src.listeningAnswers;

  const listeningAnswers = extractArray(listeningSource).map((row, i) => ({
    k: Number(row?.k || row?.idx || i + 1),
    correctness: normalizeCorrectness(
      row?.correctness ??
        row?.status ??
        row?.result ??
        // extra aliases seen in Gemini variants
        row?.passed ??
        row?.pass ??
        row?.failed ??
        row?.fail ??
        row?.verdict
    ),
    correctVersion: row?.correctVersion ? String(row.correctVersion) : undefined,
    errorReason: row?.errorReason ? String(row.errorReason) : undefined,
  }));
  const vocabSource =
    src.vocabQuiz ?? src.vocabQuizEvaluation ?? src.vocabularyQuiz ?? src.vocabularyQuizEvaluation ?? {};

  const vocabAnswers = extractArray(vocabSource.answers ?? vocabSource).map((row, i) => ({
    k: Number(row?.k || row?.idx || i + 1),
    correctness: normalizeCorrectness(row?.correctness || row?.status || row?.result),
    correctVersion: row?.correctVersion ? String(row.correctVersion) : undefined,
    errorReason: row?.errorReason ? String(row.errorReason) : undefined,
  }));

  const writingNode = src.writing ?? src.writingFeedback ?? src.writingTask ?? src.writingTaskEvaluation ?? src.writingEvaluation ?? {};
  const speakingNode = src.speaking ?? src.speakingFeedback ?? src.speakingTask ?? src.speakingTaskEvaluation ?? src.speakingEvaluation ?? {};
  const conversationNode = src.conversation ?? src.conversationFeedback ?? src.conversationTask ?? src.conversationPracticeEvaluation ?? src.conversationEvaluation ?? {};
  const breakdownNode = src.scoreBreakdown ?? src.scores ?? src.breakdown ?? {};

  // Advanced scoring: Correct = 100%, Partially Correct = 60%, Incorrect = 0%
  const calculateWeightedScore = (arr) => {
    if (!arr || arr.length === 0) return 0;
    let totalWeight = 0;
    for (const item of arr) {
      if (item.correctness === "Correct") {
        totalWeight += 1.0;
      } else if (item.correctness === "Partially Correct") {
        totalWeight += 0.6;
      }
      // Incorrect = 0, no addition
    }
    return Math.round((totalWeight / arr.length) * 100);
  };

  const sentencesPercent = sentenceEvaluations.length ? calculateWeightedScore(sentenceEvaluations) : 0;
  const questionsPercent = questionAnswers.length ? calculateWeightedScore(questionAnswers) : 0;
  const listeningPercent = listeningAnswers.length ? calculateWeightedScore(listeningAnswers) : 0;
  
  // Extract Hindi translation answers with multiple fallback paths
  const hindiSource =
    src?.hindiTranslation?.answers ??
    src?.hindiTranslation?.items ??
    src.hindiTranslation ??
    src.hindiTranslationEvaluation?.answers ??
    src.hindiTranslationEvaluation ??
    src.hindiTranslationAnswers;
  
  const hindiAnswers = extractArray(hindiSource).map((row, i) => ({
    k: Number(row?.k || row?.idx || i + 1),
    correctness: normalizeCorrectness(
      row?.correctness ??
        row?.status ??
        row?.result ??
        row?.passed ??
        row?.pass ??
        row?.verdict
    ),
    original: row?.original ? String(row.original) : undefined,
    correctVersion: row?.correctVersion ? String(row.correctVersion) : undefined,
    errorReason: row?.errorReason ? String(row.errorReason) : undefined,
    feedback: row?.feedback ? String(row.feedback) : undefined,
  }));
  
  const hindiTranslationPercent = hindiAnswers.length ? calculateWeightedScore(hindiAnswers) : 0;

  const writingPercent = toPercent(writingNode.scorePercent ?? writingNode.score ?? breakdownNode.writingPercent, sentencesPercent);
  const speakingPercent = toPercent(speakingNode.scorePercent ?? speakingNode.score ?? breakdownNode.speakingPercent, sentencesPercent);
  const conversationPercent = toPercent(conversationNode.scorePercent ?? conversationNode.score ?? breakdownNode.conversationPercent, sentencesPercent);
  
  // Advanced weighted calculation with more balanced distribution
  // Grammar/Sentences are important but shouldn't dominate
  // Writing, Speaking, Conversation are core skills and should have significant weight
  const computedOverall =
    src.overallPercent ??
    src.overallScore ??
    src.overall_score ??
    src.overallPercentage ??
    Math.round((
      sentencesPercent * 0.30 +           // Grammar/Sentences: 30% (increased from 25%)
      hindiTranslationPercent * 0.10 +    // Hindi Translation: 10%
      writingPercent * 0.20 +             // Writing: 20%
      speakingPercent * 0.20 +            // Speaking: 20% (increased from 15%)
      conversationPercent * 0.15 +        // Conversation: 15%
      questionsPercent * 0.03 +           // Questions: 3% (reduced from 8%)
      listeningPercent * 0.02             // Listening: 2% (reduced from 7%)
    ) * 100) / 100;
  const overallPercent = toPercent(computedOverall, 0);
  const passFailRaw = String(src.passFail ?? src.pass_fail ?? src.result ?? (overallPercent >= 70 ? "PASS" : "FAIL")).toUpperCase();
  const passFail = passFailRaw.includes("PASS") ? "PASS" : "FAIL";
  const tierRaw = String((src.tier ?? src.performanceTier ?? src.level) || "");
  const tier =
    /strong/i.test(tierRaw) ? "Strong" :
    /medium/i.test(tierRaw) ? "Medium" :
    /weak/i.test(tierRaw) ? "Weak" :
    overallPercent >= 70 ? "Strong" : overallPercent >= 50 ? "Medium" : "Weak";

  if (overallPercent === 0) {
    const candidateKeys = Object.keys(src).slice(0, 20);
    console.log(`    ⚠ evaluation normalized to 0%. Candidate keys(sample): ${candidateKeys.join(", ")}`);
    console.log(
      `    ⚠ extracted counts: sentences ${sentenceEvaluations.length}, questions ${questionAnswers.length}, listening ${listeningAnswers.length}`
    );
  }

  if (sentencesPercent === 0 && sentenceEvaluations.length) {
    const sample = sentenceEvaluations.slice(0, 3).map((s) => ({
      k: s.k,
      correctness: s.correctness,
      errorReason: s.errorReason ? String(s.errorReason).slice(0, 60) : "",
    }));
    const uniq = [...new Set(sentenceEvaluations.map((s) => s.correctness))].join(",");
    console.log(`    ⚠ Debug: Grammar(sentences) percent is 0%. correctness values in sample: [${uniq}] sample=${JSON.stringify(sample)}`);
  }

  return {
    overallPercent,
    tier,
    passFail,
    motivationalMessage: src.motivationalMessage ? String(src.motivationalMessage) : undefined,
    strengths: asArray(src.strengths ?? src.positives ?? src.goodPoints).map((x) => String(x)).filter(Boolean),
    improvementFocus: src.improvementFocus ? String(src.improvementFocus) : undefined,
    scoreBreakdown: {
      sentencesPercent,
      hindiTranslationPercent,
      writingPercent,
      speakingPercent,
      conversationPercent,
      questionsPercent,
      listeningPercent,
    },
    sentenceEvaluations,
    writing: {
      scorePercent: writingPercent,
      original: String(writingNode.original ?? ""),
      corrected: String(writingNode.corrected ?? writingNode.correctedVersion ?? writingNode.improvedVersion ?? ""),
      issues: asArray(writingNode.issues ?? writingNode.mistakes).map((x) => String(x)),
      improvements: asArray(writingNode.improvements ?? writingNode.suggestions ?? []).map((x) => String(x)),
      feedback: String(
        writingNode.feedback ??
          writingNode.feedbackText ??
          writingNode.comment ??
          writingNode.analysis ??
          src.feedback ??
          src.writingFeedback ??
          ""
      ),
    },
    speaking: {
      scorePercent: speakingPercent,
      original: String(speakingNode.original ?? ""),
      corrected: String(speakingNode.corrected ?? speakingNode.correctedVersion ?? speakingNode.improvedVersion ?? speakingNode.improvedPlan ?? ""),
      issues: asArray(speakingNode.issues ?? speakingNode.mistakes).map((x) => String(x)),
      improvements: asArray(speakingNode.improvements ?? speakingNode.suggestions ?? []).map((x) => String(x)),
      feedback: String(
        speakingNode.feedback ??
          speakingNode.feedbackText ??
          speakingNode.comment ??
          speakingNode.analysis ??
          src.feedback ??
          src.speakingFeedback ??
          ""
      ),
    },
    conversation: {
      scorePercent: conversationPercent,
      original: String(conversationNode.original ?? ""),
      corrected: String(conversationNode.corrected ?? conversationNode.correctedVersion ?? conversationNode.improvedVersion ?? ""),
      issues: asArray(conversationNode.issues ?? conversationNode.mistakes).map((x) => String(x)),
      improvements: asArray(conversationNode.improvements ?? conversationNode.suggestions ?? []).map((x) => String(x)),
      feedback: String(
        conversationNode.feedback ??
          conversationNode.feedbackText ??
          conversationNode.comment ??
          conversationNode.analysis ??
          src.feedback ??
          src.conversationFeedback ??
          ""
      ),
    },
    questions: {
      scorePercent: questionsPercent,
      answers: questionAnswers,
    },
    listening: {
      scorePercent: listeningPercent,
      answers: listeningAnswers,
    },
    hindiTranslation: {
      scorePercent: hindiTranslationPercent,
      answers: hindiAnswers,
    },
    vocabQuiz: vocabAnswers.length
      ? {
          scorePercent: toPercent(
            vocabSource.scorePercent ?? vocabSource.score,
            vocabAnswers.length ? Math.round((correctCount(vocabAnswers) / vocabAnswers.length) * 100) : 0
          ),
          answers: vocabAnswers,
        }
      : undefined,
    commonMistakesTop3: asArray(
      src.commonMistakesTop3 ?? 
      src.commonMistakes ?? 
      src.topMistakes ?? 
      src.summary?.commonMistakes ?? 
      src.summary?.topMistakes ??
      src.summary?.mistakes
    )
      .map((x) => {
        // Handle new object format with mistake, example, correction
        if (typeof x === 'object' && x !== null) {
          return {
            mistake: String(x.mistake || x.error || x.description || '').trim(),
            example: String(x.example || x.wrongExample || x.incorrect || '').trim(),
            correction: String(x.correction || x.fix || x.correct || '').trim()
          };
        }
        // Handle legacy string format
        return {
          mistake: String(x).trim(),
          example: '',
          correction: ''
        };
      })
      .filter((x) => x.mistake && !["-", "–", "—", "•"].includes(x.mistake))
      .slice(0, 3),
    weakAreas: asArray(
      src.weakAreas ?? 
      src.improvementAreas ?? 
      src.areasToImprove ?? 
      src.summary?.weakAreas ?? 
      src.summary?.improvementAreas
    )
      .map((x) => String(x).trim())
      .filter((x) => x && !["-", "–", "—", "•"].includes(x))
      .slice(0, 10),
    strongAreas: extractStrongAreas(src, {
      sentencesPercent,
      writingPercent,
      speakingPercent,
      conversationPercent,
      questionsPercent,
      listeningPercent,
    }),
    recurringMistakePatterns: extractRecurringMistakePatterns(sentenceEvaluations),
    todaySummary: src.todaySummary ? {
      topic: String(src.todaySummary.topic ?? "Today's Lesson"),
      levelLabel: src.todaySummary.levelLabel ?? (overallPercent >= 70 ? "Advanced" : overallPercent >= 45 ? "Intermediate" : "Beginner"),
      dayNumber: Number(src.todaySummary.dayNumber ?? src.dayNumber ?? 1),
      keyGrammarPoints: asArray(src.todaySummary.keyGrammarPoints).map((x) => String(x)),
      keyVocabulary: asArray(src.todaySummary.keyVocabulary).map((v) => ({
        word: String(v?.word ?? ""),
        partOfSpeech: String(v?.partOfSpeech ?? v?.pos ?? "noun"),
        meaning: String(v?.meaning ?? v?.definition ?? ""),
        exampleUse: String(v?.exampleUse ?? v?.example ?? ""),
      })),
      grammarSummary: String(src.todaySummary.grammarSummary ?? ""),
      topicNotes: String(src.todaySummary.topicNotes ?? ""),
      topicUsageTip: String(src.todaySummary.topicUsageTip ?? ""),
      quickRecap: asArray(src.todaySummary.quickRecap).map((x) => String(x)),
      reviewReminder: String(src.todaySummary.reviewReminder ?? ""),
    } : undefined,
  };
}

async function evaluateSubmissionGemini({ dayContent, submissionParsed, state }) {
  console.log(`    🎯 evaluateSubmissionGemini called - Day ${dayContent.dayNumber}`);

  const sentenceCount = dayContent.submissionTemplate.sentenceCount;
  const questionCount = dayContent.submissionTemplate.questionCount;
  console.log(`    📊 Expected counts - Sentences: ${sentenceCount}, Questions: ${questionCount}`);

  const isWeekly = dayContent.dayType === "weekly_review";
  const vocabQuizCount = isWeekly ? dayContent.submissionTemplate.vocabQuizCount || 0 : 0;

  const userPrompt = {
    task: "Strictly evaluate a learner submission",
    dayNumber: dayContent.dayNumber,
    dayType: dayContent.dayType,
    curriculum: {
      levelHint:
        dayContent.dayNumber <= 30 ? "Beginner" : dayContent.dayNumber <= 70 ? "Intermediate" : "Advanced",
    },
    evaluationRules: {
      passTier: "Strong = pass (>= 76% overallPercent).",
      requireExactSentenceIndices: true,
      requireExactArrayLengths: {
        sentenceEvaluations: sentenceCount,
      },
    },
    dayContextForEvaluation: {
      dayTheme: dayContent.dayTheme,
      grammarFocus: dayContent.grammarFocus,
      vocabAndTracks: {
        requiredIdiom: dayContent.writingTask.requiredIdiom,
        requiredPhrasal: dayContent.writingTask.requiredPhrasal,
      },
      sentencePracticePrompts: dayContent.sentencePractice.items.map((x) => ({
        k: x.k,
        prompt: x.prompt,
      })),
      questions: dayContent.questions.items,
      listeningQuestions: dayContent.listening.questions,
      vocabQuiz: isWeekly ? dayContent.vocabQuiz?.items || [] : [],
    },
    learnerSubmission: submissionParsed,
    previousTracker: {
      streak: state?.tracker?.streak ?? 0,
      commonMistakes: state?.tracker?.commonMistakes ?? [],
      weakAreas: state?.weakAreas ?? [],
      scoreHistory: state?.scoreHistory ?? [],
    },
    outputExpectations: {
      overallPercentRange: [0, 100],
      tierEnum: ["Weak", "Medium", "Strong"],
      passFailEnum: ["PASS", "FAIL"],
      commonMistakesTop3Count: 3,
      weakAreasMaxCount: 10,
      sentenceEvaluationsLength: sentenceCount,
      questionsAnswersCount: questionCount,
      listeningAnswersCount: 3,
      vocabQuizCount: isWeekly ? vocabQuizCount : 0,
      requireTodaySummary: {
        topic: "Today's grammar/vocabulary topic name",
        levelLabel: dayContent.dayNumber <= 30 ? "Beginner" : dayContent.dayNumber <= 70 ? "Intermediate" : "Advanced",
        dayNumber: dayContent.dayNumber,
        keyGrammarPoints: "Array of 3-5 concise grammar rules",
        keyVocabulary: "Array of 5-8 words with partOfSpeech, meaning, exampleUse",
        grammarSummary: "MINIMUM 150 WORDS - Full teacher explanation with examples",
        topicNotes: "MINIMUM 150 WORDS - Structured revision card with Watch Out section",
        topicUsageTip: "1 practical tip on when/how to use today's topic",
        quickRecap: "Array of 3-5 flashcard-style one-liners",
        reviewReminder: "Personal reminder referencing today's specific content",
      },
    },
  };

  const evalAttempts = Number(process.env.GEMINI_EVAL_MAX_ATTEMPTS || 2);
  const timeoutMs1 = Number(process.env.GEMINI_EVAL_TIMEOUT_MS || 120000);
  const timeoutMs2 = Number(process.env.GEMINI_EVAL_TIMEOUT_MS_RETRY || 90000);

  let lastErr = null;
  for (let attempt = 1; attempt <= evalAttempts; attempt++) {
    try {
      const timeoutMs = attempt === 1 ? timeoutMs1 : timeoutMs2;
      const userPromptAttempt =
        attempt === 1
          ? userPrompt
          : {
              ...userPrompt,
              strictFixForEvaluation: {
                previousError: lastErr instanceof Error ? lastErr.message : String(lastErr || ""),
                requirements: {
                  sentenceEvaluationsLength: sentenceCount,
                  questionsAnswersLength: questionCount,
                  listeningAnswersLength: 3,
                  commonMistakesTop3Length: 3,
                  weakAreasMin: 1,
                },
                instruction:
                  "Your output MUST include sentenceEvaluations array with EXACT length, questions.answers array with EXACT length, and listening.answers array with length 3. If missing, return an explicit error JSON (so we can retry).",
              },
            };

      const attemptSubmissionSentences =
        Array.isArray(submissionParsed?.sentencePractice) ? submissionParsed.sentencePractice.length : 0;
      const attemptSubmissionQuestions =
        Array.isArray(submissionParsed?.questions) ? submissionParsed.questions.length : 0;
      const attemptSubmissionListening =
        Array.isArray(submissionParsed?.listening) ? submissionParsed.listening.length : 0;
      const passThreshold = dayContent.dayType === "weekly_review" ? 75 : 70;
      console.log(
        `    📤 eval.request (attempt ${attempt}/${evalAttempts}): expected sentences=${sentenceCount}, questions=${questionCount}, listening=3, pass>=${passThreshold}%`
      );
      console.log(
        `    📤 learnerSubmission counts: sentencePractice=${attemptSubmissionSentences}, questions=${attemptSubmissionQuestions}, listeningItems=${attemptSubmissionListening}`
      );

      const rawJsonText = await callGeminiJsonWithFallback({
        systemPrompt: SYSTEM_TRAINER_PROMPT,
        userPrompt: JSON.stringify(userPromptAttempt, null, 2),
        timeoutMs,
      });

      console.log(`    ✓ Parsing and validating evaluation response...`);
      const parsed = JSON.parse(rawJsonText);
      const topKeys = parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 15).join(", ") : "(not-object)";
      const candidate = pickEvaluationPayload(parsed);
      const candKeys = candidate && typeof candidate === "object" ? Object.keys(candidate).slice(0, 15).join(", ") : "(not-object)";
      console.log(`    🔎 eval JSON keys(top): ${topKeys}`);
      console.log(`    🔎 eval picked candidate keys(sample): ${candKeys}`);
      const normalized = normalizeEvaluationShape(candidate);
      console.log(
        `    📦 eval normalized: overall=${normalized.overallPercent}% tier=${normalized.tier} sentences=${normalized.sentenceEvaluations?.length ?? 0} q=${normalized.questions?.answers?.length ?? 0} listen=${normalized.listening?.answers?.length ?? 0}`
      );
      
      // Debug: Check hindiTranslation data
      if (normalized.hindiTranslation) {
        const hindiAnswers = normalized.hindiTranslation.answers || [];
        const sampleAnswer = hindiAnswers[0] || {};
        console.log(`    🔍 DEBUG hindiTranslation: count=${hindiAnswers.length}, sample keys=[${Object.keys(sampleAnswer).join(', ')}]`);
        if (hindiAnswers.length > 0) {
          console.log(`    🔍 DEBUG sample answer:`, JSON.stringify(sampleAnswer, null, 2));
          // Check first 3 answers in detail
          for (let i = 0; i < Math.min(3, hindiAnswers.length); i++) {
            const ans = hindiAnswers[i];
            console.log(`    🔍 DEBUG answer[${i}]: k=${ans.k}, correctness=${ans.correctness}, hasOriginal=${!!ans.original}, hasCorrectVersion=${!!ans.correctVersion}, hasErrorReason=${!!ans.errorReason}, hasFeedback=${!!ans.feedback}`);
          }
        }
      } else {
        console.log(`    ⚠ DEBUG: normalized.hindiTranslation is missing!`);
      }

      // Never fabricate evaluation: if Gemini response is incomplete, require retry.
      if (!Array.isArray(normalized.sentenceEvaluations) || normalized.sentenceEvaluations.length !== sentenceCount) {
        const got = Array.isArray(normalized.sentenceEvaluations) ? normalized.sentenceEvaluations.length : 0;
        const candidateKeys = candidate && typeof candidate === "object" ? Object.keys(candidate).slice(0, 15).join(", ") : "(not-object)";
        throw new Error(`Gemini returned sentenceEvaluations length ${got}, expected ${sentenceCount}. Candidate keys: [${candidateKeys}]. Retry submit.`);
      }
      if (!normalized.questions || !Array.isArray(normalized.questions.answers) || normalized.questions.answers.length !== questionCount) {
        const got = normalized.questions?.answers && Array.isArray(normalized.questions.answers) ? normalized.questions.answers.length : 0;
        const candidateKeys = candidate && typeof candidate === "object" ? Object.keys(candidate).slice(0, 15).join(", ") : "(not-object)";
        const questionKeys =
          normalized.questions && typeof normalized.questions === "object" ? Object.keys(normalized.questions).slice(0, 10).join(", ") : "(none)";
        throw new Error(
          `Gemini returned questions.answers length ${got}, expected ${questionCount}. Candidate keys: [${candidateKeys}]. questions keys: [${questionKeys}]. Retry submit.`
        );
      }
      if (!normalized.listening || !Array.isArray(normalized.listening.answers) || normalized.listening.answers.length !== 3) {
        const got = normalized.listening?.answers && Array.isArray(normalized.listening.answers) ? normalized.listening.answers.length : 0;
        const candidateKeys = candidate && typeof candidate === "object" ? Object.keys(candidate).slice(0, 15).join(", ") : "(not-object)";
        throw new Error(`Gemini returned listening.answers length ${got}, expected 3. Candidate keys: [${candidateKeys}]. Retry submit.`);
      }
      if (!Array.isArray(normalized.commonMistakesTop3) || normalized.commonMistakesTop3.length < 3) {
        // Try to generate from sentence errors if missing
        const mistakesFromSentences = normalized.sentenceEvaluations
          .filter(s => s.correctness === "Incorrect" && s.errorReason && s.errorReason !== "N/A")
          .map(s => ({
            mistake: s.errorReason,
            example: s.sentence || '',
            correction: s.correctedSentence || ''
          }))
          .slice(0, 3);
        
        if (mistakesFromSentences.length >= 3) {
          normalized.commonMistakesTop3 = mistakesFromSentences;
        } else {
          // Fallback to generic mistakes
          normalized.commonMistakesTop3 = [
            {
              mistake: "Grammar structure needs improvement",
              example: "",
              correction: ""
            },
            {
              mistake: "Vocabulary usage could be more natural",
              example: "",
              correction: ""
            },
            {
              mistake: "Sentence formation requires practice",
              example: "",
              correction: ""
            }
          ].slice(0, 3);
        }
      }
      if (!Array.isArray(normalized.weakAreas) || normalized.weakAreas.length < 1) {
        // Generate from low-scoring areas
        const weakAreasGenerated = [];
        if (normalized.scoreBreakdown.sentencesPercent < 70) weakAreasGenerated.push("Grammar and sentence structure");
        if (normalized.scoreBreakdown.writingPercent < 70) weakAreasGenerated.push("Writing task completion");
        if (normalized.scoreBreakdown.speakingPercent < 70) weakAreasGenerated.push("Speaking fluency");
        if (normalized.scoreBreakdown.conversationPercent < 70) weakAreasGenerated.push("Conversational skills");
        
        normalized.weakAreas = weakAreasGenerated.length > 0 ? weakAreasGenerated : ["General English practice needed"];
      }

      // Ensure todaySummary is present with all required fields
      if (!normalized.todaySummary || !normalized.todaySummary.grammarSummary || !normalized.todaySummary.topicNotes) {
        const levelLabel = dayContent.dayNumber <= 30 ? "Beginner" : dayContent.dayNumber <= 70 ? "Intermediate" : "Advanced";
        normalized.todaySummary = {
          topic: dayContent.dayTheme || "Today's Lesson",
          levelLabel: levelLabel,
          dayNumber: dayContent.dayNumber,
          keyGrammarPoints: [dayContent.grammarFocus || "Grammar practice"],
          keyVocabulary: (dayContent.vocabAndTracks?.wordOfDay || []).slice(0, 5).map(w => ({
            word: w.word,
            partOfSpeech: w.pos || "noun",
            meaning: w.definition,
            exampleUse: w.example,
          })),
          grammarSummary: normalized.todaySummary?.grammarSummary || `Today's lesson focused on ${dayContent.grammarFocus}. This is an important concept in English grammar. Practice using this structure in your daily conversations to improve fluency.`,
          topicNotes: normalized.todaySummary?.topicNotes || `Topic: ${dayContent.dayTheme}. Key Rule: ${dayContent.grammarFocus}. Remember to practice this regularly. Watch Out! Common mistakes include incorrect usage and forgetting the proper structure.`,
          topicUsageTip: normalized.todaySummary?.topicUsageTip || "Practice this grammar point in real conversations.",
          quickRecap: normalized.todaySummary?.quickRecap || ["Review today's grammar", "Practice vocabulary", "Complete exercises"],
          reviewReminder: normalized.todaySummary?.reviewReminder || "Review today's lesson before the next session.",
        };
      }

      const validated = EvaluationSchema.parse(normalized);

      // Merge original user sentences back into evaluation
      if (submissionParsed?.sentencePractice && Array.isArray(submissionParsed.sentencePractice)) {
        validated.sentenceEvaluations = validated.sentenceEvaluations.map((evalItem) => {
          const userSentence = submissionParsed.sentencePractice.find((s) => s.k === evalItem.k);
          return {
            ...evalItem,
            original: userSentence?.text || evalItem.original || "",
          };
        });
      }

      // Extra strictness.
      if (validated.sentenceEvaluations.length !== sentenceCount) {
        throw new Error(`Gemini returned sentenceEvaluations length ${validated.sentenceEvaluations.length}, expected ${sentenceCount}`);
      }
      if (validated.questions.answers.length !== questionCount) {
        throw new Error(`Gemini returned questions.answers length ${validated.questions.answers.length}, expected ${questionCount}`);
      }
      if (validated.listening.answers.length !== 3) {
        throw new Error(`Gemini returned listening.answers length ${validated.listening.answers.length}, expected 3`);
      }
      if (isWeekly) {
        if (!validated.vocabQuiz) throw new Error("Weekly review missing vocabQuiz evaluation");
        const expected = vocabQuizCount;
        if (validated.vocabQuiz.answers.length !== expected) {
          throw new Error(`Gemini returned vocabQuiz.answers length ${validated.vocabQuiz.answers.length}, expected ${expected}`);
        }
      }

      console.log(`    ✓ Evaluation validated - Tier: ${validated.tier}, Score: ${validated.overallPercent}%`);
      return validated;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`    ⚠ Gemini eval attempt ${attempt}/${evalAttempts} failed: ${msg}`);
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr || "");
  throw new Error(`AI evaluation failed. Please retry submit. Details: ${msg}`);
}

function updateStateAfterEvaluation({ state, dayContent, evaluation }) {
  console.log(`    📊 Updating state after evaluation...`);
  const passThreshold = dayContent.dayType === "weekly_review" ? 75 : 70;
  const strong = evaluation.overallPercent >= passThreshold;
  console.log(`    ${strong ? "✓" : "❌"} Performance: ${evaluation.tier} (${evaluation.overallPercent}%)`);

  const previousStreak = state.tracker.streak || 0;
  const shieldEligible = previousStreak >= 7 && !state.streakShieldUsed;
  const shieldApplied = !strong && shieldEligible;
  const nextStreak = strong ? previousStreak + 1 : shieldApplied ? previousStreak : 0;
  const totalSubmissions = (state.tracker.totalSubmissions || 0) + 1;
  const averageScore = Math.round(
    (((state.tracker.averageScore || 0) * (totalSubmissions - 1)) + evaluation.overallPercent) / totalSubmissions
  );
  const sentenceKey = `Sentences (${dayContent.submissionTemplate.sentenceCount})`;
  const updatedScoreHistory = [...(state.tracker.scoreHistory || []), evaluation.overallPercent].slice(-30);
  const grammarConfidence = Math.round(((state.tracker.confidenceScore?.Grammar || 0) * 0.7) + (evaluation.scoreBreakdown.sentencesPercent * 0.3));
  const writingConfidence = Math.round(((state.tracker.confidenceScore?.Writing || 0) * 0.7) + (evaluation.scoreBreakdown.writingPercent * 0.3));
  const speakingComposite = (evaluation.scoreBreakdown.speakingPercent + evaluation.scoreBreakdown.conversationPercent) / 2;
  const speakingConfidence = Math.round(((state.tracker.confidenceScore?.Speaking || 0) * 0.7) + (speakingComposite * 0.3));
  const nextConsecutiveFails = strong ? 0 : (state.consecutiveFailsOnCurrentDay || 0) + 1;
  const catchUpMode = !strong && nextConsecutiveFails >= 3;

  const updatedTracker = {
    ...state.tracker,
    day: strong ? dayContent.dayNumber + 1 : dayContent.dayNumber,
    totalDaysCompleted: state.tracker.totalDaysCompleted + (strong ? 1 : 0),
    streak: nextStreak,
    longestStreak: Math.max(state.tracker.longestStreak || 0, nextStreak),
    totalSubmissions,
    averageScore,
    scoreHistory: updatedScoreHistory,
    todayWorkStatus: {
      Grammar: "Checked",
      Speaking: "Checked",
      Writing: "Checked",
      Conversation: "Checked",
      [sentenceKey]: "Checked",
      Questions: "Checked",
      "Listening (3)": "Checked",
      Reflection: "Checked",
    },
    finalStatus: strong ? "Completed" : shieldApplied ? "Completed" : "Failed",
    confidenceScore: {
      Grammar: grammarConfidence,
      Speaking: speakingConfidence,
      Writing: writingConfidence,
    },
    commonMistakes: evaluation.commonMistakesTop3,
  };

  const nextState = {
    ...state,
    tracker: updatedTracker,
    dayType: dayContent.dayType,
    streakShieldUsed: strong ? false : shieldApplied ? true : state.streakShieldUsed,
    consecutiveFailsOnCurrentDay: nextConsecutiveFails,
    catchUpMode,
    lastEvaluation: evaluation,
  };

  nextState.scoreHistory = [
    ...(state.scoreHistory || []),
    {
      dayNumber: dayContent.dayNumber,
      dayType: dayContent.dayType,
      date: new Date().toISOString(),
      theme: dayContent.dayTheme,
      grammarFocus: dayContent.grammarFocus,
      overallPercent: evaluation.overallPercent,
      tier: evaluation.tier,
      passFail: evaluation.passFail,
      scoreBreakdown: evaluation.scoreBreakdown,
      // Store full evaluation for history viewing
      fullEvaluation: evaluation,
    },
  ];

  // Weak areas: used for next day generation.
  nextState.weakAreas = evaluation.weakAreas;
  nextState.weakGrammarAreas = evaluation.weakAreas.slice(0, 5);
  nextState.weakVocabAreas = evaluation.commonMistakesTop3.slice(0, 3);
  nextState.confidentTopics = (nextState.confidentTopics || [])
    .concat(
      evaluation.scoreBreakdown.writingPercent >= 80 ? [`${dayContent.dayTheme}: writing`] : [],
      evaluation.scoreBreakdown.sentencesPercent >= 80 ? [dayContent.grammarFocus] : []
    )
    .slice(-20);
  nextState.grammarCoveredByDay = {
    ...(state.grammarCoveredByDay || {}),
    [String(dayContent.dayNumber)]: dayContent.grammarFocus,
  };
  nextState.attemptsByDay = {
    ...(state.attemptsByDay || {}),
    [String(dayContent.dayNumber)]: Number(state.attemptsByDay?.[String(dayContent.dayNumber)] || 0) + 1,
  };

  // Build compressed learner context
  try {
    // Check if we need to migrate from legacy state
    if (!state.compressedLearnerContext) {
      console.log(`    🔄 No compressed context found - checking for migration...`);
      if (state.lastEvaluation || state.weakAreas) {
        nextState.compressedLearnerContext = migrateFromLegacyState(nextState);
        console.log(`    ✓ Migrated legacy state to compressed context`);
      } else {
        // First evaluation - build fresh context
        nextState.compressedLearnerContext = buildCompressedContext(nextState, evaluation, dayContent);
        console.log(`    ✓ Built initial compressed context`);
      }
    } else {
      // Update existing compressed context
      nextState.compressedLearnerContext = buildCompressedContext(nextState, evaluation, dayContent);
      console.log(`    ✓ Updated compressed context`);
    }
    
    // Validate the compressed context
    const validation = validateCompressedContext(nextState.compressedLearnerContext);
    if (!validation.valid) {
      console.warn(`    ⚠ Compressed context validation failed:`, validation.errors);
      console.warn(`    ⚠ Attempting to rebuild context...`);
      // Try to rebuild
      nextState.compressedLearnerContext = buildCompressedContext(nextState, evaluation, dayContent);
      const revalidation = validateCompressedContext(nextState.compressedLearnerContext);
      if (!revalidation.valid) {
        console.error(`    ❌ Context rebuild failed. Errors:`, revalidation.errors);
      } else {
        console.log(`    ✓ Context rebuild successful`);
      }
    }
  } catch (error) {
    console.error(`    ❌ Error building compressed context:`, error);
    // Don't block evaluation completion - context will be rebuilt next time
  }

  // Day lock: only advance if strong AND it's a new calendar day in IST.
  if (strong) {
    // Check if we should advance based on IST timezone
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Get the last completion date in IST
    const lastCompletionDate = state.lastDayCompletionDate || null;
    const todayIST = istTime.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Only advance if it's a different day in IST or first time completing
    const canAdvanceToday = !lastCompletionDate || lastCompletionDate !== todayIST;
    
    if (canAdvanceToday) {
      nextState.currentDay = dayContent.dayNumber + 1;
      nextState.dayContent = null;
      nextState.dayContentGeneratedDate = null; // Clear so new content will be generated
      nextState.lastEvaluation = evaluation;
      nextState.consecutiveFailsOnCurrentDay = 0;
      nextState.catchUpMode = false;
      nextState.lastDayCompletionDate = todayIST;
      console.log(`    ✓ Advancing to day ${nextState.currentDay} (IST date: ${todayIST})`);
    } else {
      console.log(`    ⚠ Cannot advance - already completed a day today (IST: ${todayIST})`);
      // Keep the evaluation but don't advance
      nextState.lastEvaluation = evaluation;
    }
  } else {
    console.log(`    ⚠ Staying on day ${dayContent.dayNumber} - retry required`);
  }

  return nextState;
}

module.exports = { evaluateSubmissionGemini, updateStateAfterEvaluation };

