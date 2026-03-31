const { DayContentSchema } = require("./schemas");
const { callGeminiJsonWithFallback, getGeminiModel } = require("./geminiClient");
const { SYSTEM_TRAINER_PROMPT } = require("./prompts");
const { normalizeDayContent } = require("./dayNormalize");
const { buildTodaysBrief } = require("./briefBuilder");
const { validateCompressedContext } = require("./contextValidator");
const { getTopicForDay, isRevisionDay, getRevisionScope } = require("./curriculum");
const logger = require("../logger");

function determineDayType(dayNumber) {
  return isRevisionDay(dayNumber) ? "weekly_review" : "normal";
}

function levelFromDay(dayNumber) {
  if (dayNumber <= 30) return "Beginner";
  if (dayNumber <= 70) return "Intermediate";
  return "Advanced";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function schemaStr() {
  return { type: "string" };
}

function schemaNum() {
  return { type: "number" };
}

function schemaInt() {
  return { type: "integer" };
}

function schemaObj(properties, required) {
  return { type: "object", properties, required };
}

function schemaArr(items, minItems, maxItems) {
  const out = { type: "array", items };
  if (minItems != null) out.minItems = minItems;
  if (maxItems != null) out.maxItems = maxItems;
  return out;
}

function buildDayResponseSchema({ dayType, sentenceCount, questionCount, vocabQuizCount }) {
  const wordOfDayItem = schemaObj(
    {
      word: schemaStr(),
      pos: schemaStr(),
      definition: schemaStr(),
      hindiMeaning: schemaStr(),
      examples: schemaArr(schemaStr(), 3, 3),
      example: schemaStr(),
      collocations: schemaArr(schemaStr(), 2, 4),
      synonym: schemaStr(),
      antonym: schemaStr(),
    },
    ["word", "pos", "definition", "hindiMeaning", "examples"]
  );

  const pronWordItem = schemaObj(
    {
      word: schemaStr(),
      ipa: schemaStr(),
      stress: schemaStr(),
      hindiMeaning: schemaStr(),
      examples: schemaArr(schemaStr(), 3, 3),
      exampleSentence: schemaStr(),
      mis: schemaStr(),
      correct: schemaStr(),
    },
    ["word", "ipa", "stress", "hindiMeaning", "examples", "correct"]
  );

  const warmUpItem = schemaObj(
    { wrong: schemaStr(), correct: schemaStr() },
    ["wrong", "correct"]
  );

  const sentenceItem = schemaObj(
    { k: schemaInt(), prompt: schemaStr() },
    ["k", "prompt"]
  );

  const hindiItem = schemaObj(
    { k: schemaInt(), hindiSentence: schemaStr() },
    ["k", "hindiSentence"]
  );

  const qItem = schemaObj({ idx: schemaInt(), prompt: schemaStr() }, ["idx", "prompt"]);

  const listeningQItem = schemaObj({ idx: schemaInt(), prompt: schemaStr() }, ["idx", "prompt"]);

  const response = schemaObj(
    {
      dayNumber: schemaInt(),
      dayType: schemaStr(),
      submissionTemplate: schemaObj(
        {
          type: schemaStr(),
          sentenceCount: schemaInt(),
          hindiTranslationCount: schemaInt(),
          questionCount: schemaInt(),
          listeningCount: schemaInt(),
          reflectionCount: schemaInt(),
          conversationMinTurns: schemaInt(),
          vocabQuizCount: schemaInt(),
        },
        ["type", "sentenceCount", "hindiTranslationCount", "questionCount", "listeningCount", "reflectionCount", "conversationMinTurns", "vocabQuizCount"]
      ),
      dayTheme: schemaStr(),
      grammarFocus: schemaStr(),
      warmUpCorrections: schemaArr(warmUpItem, 3, 3),
      grammarExplanationText: schemaStr(),
      sentenceFormationText: schemaStr(),
      pronunciation: schemaObj(
        {
          title: schemaStr(),
          words: schemaArr(pronWordItem, 5, 5),
          tongueTwister: schemaStr(),
        },
        ["title", "words", "tongueTwister"]
      ),
      vocabAndTracks: schemaObj(
        {
          wordOfDay: schemaArr(wordOfDayItem, 10, 10),
          idiom: schemaStr(),
          phrasal: schemaStr(),
        },
        ["wordOfDay", "idiom", "phrasal"]
      ),
      listening: schemaObj(
        {
          title: schemaStr(),
          transcript: schemaStr(),
          questions: schemaArr(listeningQItem, 6, 6),
        },
        ["title", "transcript", "questions"]
      ),
      speakingTask: schemaObj({ prompt: schemaStr() }, ["prompt"]),
      writingTask: schemaObj(
        { prompt: schemaStr(), requiredIdiom: schemaStr(), requiredPhrasal: schemaStr() },
        ["prompt", "requiredIdiom", "requiredPhrasal"]
      ),
      conversationTask: schemaObj({ prompt: schemaStr() }, ["prompt"]),
      sentencePractice: schemaObj({ items: schemaArr(sentenceItem, sentenceCount, sentenceCount) }, ["items"]),
      hindiTranslation: schemaObj({ items: schemaArr(hindiItem, 20, 20) }, ["items"]),
      questions: schemaObj({ items: schemaArr(qItem, questionCount, questionCount) }, ["items"]),
      ...(dayType === "weekly_review"
        ? {
            vocabQuiz: schemaObj({ items: schemaArr(qItem, vocabQuizCount, vocabQuizCount) }, ["items"]),
          }
        : {}),
    },
    [
      "dayNumber",
      "dayType",
      "submissionTemplate",
      "dayTheme",
      "grammarFocus",
      "warmUpCorrections",
      "grammarExplanationText",
      "sentenceFormationText",
      "pronunciation",
      "vocabAndTracks",
      "listening",
      "speakingTask",
      "writingTask",
      "conversationTask",
      "sentencePractice",
      "hindiTranslation",
      "questions",
      ...(dayType === "weekly_review" ? ["vocabQuiz"] : []),
    ]
  );

  return response;
}

async function generateDayContentGemini({ state, dayNumber, userId, previousDaySummary }) {

  const model = getGeminiModel();
  
  if (!model) {
    throw new Error("Gemini API key missing. Set GOOGLE_API_KEY in server/.env");
  }

  const dayType = determineDayType(dayNumber);
  const curriculumEntry = getTopicForDay(dayNumber);
  
  if (!curriculumEntry) {
    throw new Error(`No curriculum entry found for day ${dayNumber}`);
  }
  
  const level = curriculumEntry.level;
  const todaysTopic = curriculumEntry.topic;
  const isReview = isRevisionDay(dayNumber);
  const weekTopics = isReview ? getRevisionScope(dayNumber) : null;

  if (isReview) {

  }

  const vocabWeekWords = (() => {
    if (!state || !state.vocabByDay) return [];
    // For weekly review day, quiz on the new words from the week (last 7 days including today).
    const start = dayNumber - 6;
    const words = [];
    for (let d = start; d <= dayNumber; d++) {
      const arr = state.vocabByDay[String(d)];
      if (Array.isArray(arr)) words.push(...arr);
    }
    return words;
  })();

  const sentenceCount = dayType === "weekly_review" ? 30 : 20;
  const questionCount = dayType === "weekly_review" ? 10 : 6; // strict count for validator/UI
  const vocabQuizCount = dayType === "weekly_review" ? vocabWeekWords.length : 0;
  const listeningCount = 6; // Changed from 3 to 6
  const reflectionCount = 2;
  const conversationMinTurns = 8;

  // Build compressed learner context if available
  let learnerContext = null;
  if (state.compressedLearnerContext) {

    // Validate compressed context
    const validation = validateCompressedContext(state.compressedLearnerContext);
    if (validation.valid) {
      // Build today's brief
      const todaysBrief = buildTodaysBrief(state.compressedLearnerContext, dayNumber);
      
      // Assemble 5-layer context
      learnerContext = {
        ...state.compressedLearnerContext.learnerIdentity,
        curriculumHistory: state.compressedLearnerContext.curriculumTrajectory,
        diagnosticProfile: state.compressedLearnerContext.diagnosticProfile,
        vocabularyContext: state.compressedLearnerContext.vocabularyMemory,
        todaysBrief: todaysBrief,
      };

    } else {


      // Fall back to legacy context
      learnerContext = null;
    }
  } else if (dayNumber > 1) {

  }

  const userPrompt = {
    task: "Generate a personalized day plan",
    dayNumber,
    dayType,
    level,
    todaysTopic, // From curriculum spine
    isReviewDay: isReview,
    weekTopicsToReview: weekTopics, // For review days
    submissionTemplateExactValues: {
      type: dayType,
      sentenceCount,
      hindiTranslationCount: 20,
      questionCount,
      listeningCount,
      reflectionCount,
      conversationMinTurns,
      vocabQuizCount,
    },
    curriculumRules: {
      strictTopicAdherence: "You MUST teach the exact topic specified in todaysTopic. Do not deviate or improvise.",
      oneDayAtATime: true,
      warmUpCorrectionsCount: 3,
      requiredVocabularyWordCount: 10,
      requiredIdiomCount: 1,
      requiredPhrasalCount: 1,
      hindiTranslationCount: 20,
      listeningCount,
      reflectionCount,
      conversationMinTurns,
      sentenceCount,
      questionCount,
      vocabQuizCount,
    },
    // Use compressed context if available, otherwise fall back to legacy
    learner: learnerContext,
    // Legacy fields for backward compatibility (only if no compressed context)
    previousDay: learnerContext ? null : (previousDaySummary || null),
    errorLog: learnerContext ? null : (state?.errorPatternLog || null),
    weakAreas: learnerContext ? null : (state?.weakAreas || []),
    vocabWeekWords: dayType === "weekly_review" ? vocabWeekWords : [],
    outputExpectations: {
      sentenceCount,
      hindiTranslationCount: 20,
      questionCount,
      listeningCount,
      reflectionCount,
      conversationMinTurns,
      vocabQuizCount,
    },
    strictInstructionForSubmissionTemplate:
      "submissionTemplate.type MUST equal dayType, and submissionTemplate MUST include the exact numeric values for sentenceCount/hindiTranslationCount/questionCount/listeningCount/reflectionCount/conversationMinTurns/vocabQuizCount. hindiTranslation MUST contain exactly 20 simple Hindi sentences (in Devanagari script) that the learner will translate to English. These should be everyday sentences appropriate for the learner's level.",
    strictInstructionForGrammarFocus:
      `grammarFocus MUST be set to: "${todaysTopic}". This is the ONLY topic you should teach today. ${isReview ? 'Since this is a review day, create content that tests all topics from this week.' : 'Do not mix in other grammar topics.'}`,
    // Strong hint to prevent schema-missing output.
    requiredOutputKeys: [
      "dayNumber",
      "dayType",
      "submissionTemplate",
      "dayTheme",
      "grammarFocus",
      "warmUpCorrections",
      "grammarExplanationText",
      "sentenceFormationText",
      "pronunciation",
      "vocabAndTracks",
      "listening",
      "speakingTask",
      "writingTask",
      "conversationTask",
      "sentencePractice",
      "hindiTranslation",
      "questions",
    ].concat(dayType === "weekly_review" ? ["vocabQuiz"] : []),
  };

  // Response schema enforcement can sometimes fail fast with strict JSON schema requirements.
  // We keep Zod validation + retries instead.
  const responseSchema = null;

  const retries = 2;
  let lastErr = null;
  let lastRawJsonText = null;
  let lastErrMessage = null;
  
  logger.dayGenStart(dayNumber, userId);
  
  for (let attempt = 1; attempt <= retries; attempt++) {

    try {
      // eslint-disable-next-line no-console
      const timeoutMs = attempt === 1 ? 120000 : 120000;

      const userPromptAttempt =
        attempt === 1
          ? userPrompt
          : {
              ...userPrompt,
              strictFixForPreviousAttempt: {
                previousError: lastErrMessage,
                previousJson: lastRawJsonText ? String(lastRawJsonText).slice(0, 600) : null,
                requirement: "Return corrected JSON that passes DayContentSchema. Ensure submissionTemplate contains all required numeric keys.",
              },
            };
      const rawJsonText = await callGeminiJsonWithFallback({
        systemPrompt: SYSTEM_TRAINER_PROMPT,
        userPrompt: JSON.stringify(userPromptAttempt, null, 2),
        timeoutMs,
        responseSchema,
      });
      lastRawJsonText = rawJsonText;

      if (attempt === 1) {
        // eslint-disable-next-line no-console
        
      }

      const parsed = JSON.parse(rawJsonText);

      // Log the structure to understand what Gemini is returning

      
      if (parsed.sentencePractice) {
        

      }
      if (parsed.questions) {
        

      }

      // Normalize Gemini output into the required shape (fills missing nested fields safely).
      const normalized = normalizeDayContent(parsed, {
        dayNumber,
        dayType,
        sentenceCount,
        questionCount,
        vocabQuizCount,
      });

      // Log what we got for debugging



      const validSentences = normalized.sentencePractice.items.filter(
        s => s.prompt && s.prompt.length > 10 && !s.prompt.toLowerCase().includes("write sentence")
      );

      
      
      const validQuestions = normalized.questions.items.filter(
        q => q.prompt && q.prompt.length > 5 && q.prompt !== "—"
      );

      // Validate that critical content is not empty/placeholder
      const hasValidGrammar = normalized.grammarExplanationText && 
        normalized.grammarExplanationText.length > 50 && 
        !normalized.grammarExplanationText.includes("—");
      
      const hasValidSentences = validSentences.length >= Math.ceil(sentenceCount * 0.5); // Lowered to 50%
      const hasValidQuestions = validQuestions.length >= Math.ceil(questionCount * 0.5); // Lowered to 50%

      if (!hasValidGrammar) {
        throw new Error("AI returned incomplete grammar content. Retry.");
      }
      if (!hasValidSentences) {
        throw new Error(`AI returned incomplete sentence prompts (got ${validSentences.length}, need ${Math.ceil(sentenceCount * 0.5)}+). Retry.`);
      }
      if (!hasValidQuestions) {
        throw new Error(`AI returned incomplete question prompts (got ${validQuestions.length}, need ${Math.ceil(questionCount * 0.5)}+). Retry.`);
      }

      const validated = DayContentSchema.parse(normalized);

      // Hard enforcement for counts (submissionTemplate must match UI/validator expectations)
      if (validated.submissionTemplate.type !== dayType) {
        throw new Error("AI returned wrong submissionTemplate.type");
      }
      if (validated.submissionTemplate.sentenceCount !== sentenceCount) {
        throw new Error("AI returned wrong sentenceCount");
      }
      if (validated.submissionTemplate.questionCount !== questionCount) {
        throw new Error("AI returned wrong questionCount");
      }
      if (validated.listening.questions.length !== 6) {
        throw new Error("AI returned wrong listening questions count");
      }

      if (validated.sentencePractice.items.length !== sentenceCount) {
        throw new Error("AI returned wrong sentencePractice.items length");
      }
      if (validated.questions.items.length !== questionCount) {
        throw new Error("AI returned wrong questions.items length");
      }

      if (dayType === "weekly_review") {
        if (!validated.vocabQuiz || !Array.isArray(validated.vocabQuiz.items)) {
          throw new Error("Weekly review missing vocabQuiz");
        }
        if (validated.submissionTemplate.vocabQuizCount !== vocabQuizCount) {
          throw new Error("AI returned wrong vocabQuizCount in submissionTemplate");
        }
        if (validated.vocabQuiz.items.length !== vocabQuizCount) {
          throw new Error("AI returned wrong vocabQuizCount");
        }
      }

      logger.dayGenComplete(dayNumber, {
        sentences: validated.sentencePractice.items.length,
        questions: validated.questions.items.length,
        vocab: validated.vocabAndTracks?.wordOfDay?.length || 0,
        listening: validated.listening?.items?.length || 0
      });
      
      return validated;
    } catch (e) {
      lastErr = e;
      lastErrMessage = e instanceof Error ? e.message : String(e);

      // Backoff on transient quota/rate-limit errors, otherwise let the repair loop try.
      if (lastErrMessage && (lastErrMessage.includes("429") || lastErrMessage.toLowerCase().includes("quota"))) {
        if (attempt < retries) {
          const waitTime = Math.min(1500 * attempt, 6000);

          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  throw new Error(lastErrMessage || "Gemini day generation failed after retries.");
}

module.exports = { generateDayContentGemini };

