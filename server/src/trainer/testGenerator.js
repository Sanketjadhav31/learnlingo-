const { callGeminiJsonWithFallback } = require("./geminiClient");
const { SYSTEM_TRAINER_PROMPT } = require("./prompts");

/**
 * Build question distribution context from user state
 * Extracts today's topic, recent topics, and weak areas
 * 
 * This function analyzes the user's learning history to create a balanced test
 * that covers current material (40%), recent topics (40%), and persistent weak areas (20%).
 * 
 * @param {Object} state - User's complete learning state
 * @param {number} forDay - Day number for which test is being generated
 * @returns {Object} Distribution context with topics, vocabulary, and learner level
 */
function buildQuestionDistribution(state, forDay) {
  // Extract today's grammar focus from current day content
  const todaysTopic = state.dayContent?.grammarFocus || "General English";
  const todaysVocabulary = state.dayContent?.vocabAndTracks?.wordOfDay || [];
  
  // Extract last 4 days' topics for cumulative testing
  // This ensures learners retain knowledge from recent lessons
  const recentTopics = [];
  for (let d = forDay - 4; d < forDay; d++) {
    if (d > 0 && state.grammarCoveredByDay && state.grammarCoveredByDay[String(d)]) {
      recentTopics.push({
        day: d,
        topic: state.grammarCoveredByDay[String(d)],
        userConfidence: "medium" // Default, could be enhanced with actual confidence data
      });
    }
  }
  
  // Extract persistent weak areas from user's historical performance
  // These are topics where the user consistently struggles
  const persistentWeakAreas = state.weakAreas || [];
  
  // Determine learner level based on progression
  // Days 1-30: Beginner, 31-70: Intermediate, 71+: Advanced
  const level = forDay <= 30 ? "Beginner" : forDay <= 70 ? "Intermediate" : "Advanced";
  
  return {
    todaysTopic,
    todaysVocabulary: todaysVocabulary.slice(0, 10), // Limit to 10 most relevant words
    recentTopics,
    persistentWeakAreas: persistentWeakAreas.slice(0, 5), // Focus on top 5 weak areas
    level
  };
}

/**
 * Build the test generation prompt for Gemini
 */
function buildTestPrompt({ todaysTopic, todaysVocabulary, recentTopics, persistentWeakAreas, level, forDay, version }) {
  return {
    task: "Generate a cumulative English test",
    forDay,
    version,
    level,
    
    context: {
      todaysTopic,
      todaysVocabulary,
      recentTopics,
      persistentWeakAreas
    },
    
    requirements: {
      totalQuestions: 20,
      questionTypes: {
        mcq: 8,              // Multiple choice (single correct)
        multiCorrect: 4,     // Multiple choice (exactly 2 correct out of 4)
        fillBlank: 5,        // Fill in the blank
        writing: 3           // Short writing (2-3 sentences)
      },
      topicDistribution: {
        todaysTopic: 8,      // 8 questions from today's topic
        recentTopics: 8,     // 2 questions per day from last 4 days
        weakAreas: 4         // 4 questions from persistent weak areas
      },
      difficultyDistribution: {
        easy: 7,
        medium: 9,
        hard: 4
      }
    },
    
    outputSchema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionId: { type: "string" },
              type: { type: "string", enum: ["mcq", "multi_correct", "fill_blank", "writing"] },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              topic: { type: "string" },
              prompt: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              correctAnswer: { type: "string" },
              correctAnswers: { type: "array", items: { type: "string" } },
              correctFillBlank: { type: "string" },
              modelAnswer: { type: "string" },
              criteria: { type: "array", items: { type: "string" } }
            },
            required: ["questionId", "type", "difficulty", "topic", "prompt"]
          },
          minItems: 20,
          maxItems: 20
        }
      },
      required: ["questions"]
    },
    
    instructions: [
      "Generate exactly 20 unique questions",
      "Each question must have a unique questionId (q1 through q20)",
      "MCQ questions must have exactly 4 options (A, B, C, D) and one correctAnswer",
      "Multi-correct questions must have exactly 4 options and exactly 2 correctAnswers",
      "Fill-blank questions should have the sentence with ___ marking the blank and correctFillBlank",
      "Writing questions should require 2-3 sentences and include modelAnswer and criteria",
      "Distribute topics as specified: 8 today, 8 recent (2 per day), 4 weak areas",
      "Distribute difficulty as specified: 7 easy, 9 medium, 4 hard",
      "Distribute question types as specified: 8 MCQ, 4 multi-correct, 5 fill-blank, 3 writing",
      "Make wrong options plausible but clearly incorrect",
      "Ensure questions test understanding, not just memorization"
    ]
  };
}

/**
 * Normalize test content from Gemini response
 * Handles various response shapes and ensures all required fields
 * 
 * This function is critical for robustness - it handles different JSON structures
 * that Gemini might return and normalizes them into a consistent format.
 * It also validates question counts and adds type-specific fields.
 * 
 * @param {Object|Array} raw - Raw response from Gemini API
 * @param {Object} options - Metadata (forDay, version)
 * @returns {Array} Array of 20 normalized question objects
 * @throws {Error} If questions array not found or count != 20
 */
function normalizeTestContent(raw, { forDay, version }) {
  // Extract questions array from various possible shapes
  // Gemini may return: direct array, {questions: []}, or {test: {questions: []}}
  let questions = [];
  
  if (Array.isArray(raw)) {
    questions = raw;
  } else if (raw.questions && Array.isArray(raw.questions)) {
    questions = raw.questions;
  } else if (raw.test && Array.isArray(raw.test.questions)) {
    questions = raw.test.questions;
  } else {
    throw new Error("Cannot find questions array in Gemini response");
  }
  
  // Validate count - must be exactly 20 questions
  if (questions.length !== 20) {
    throw new Error(`Expected exactly 20 questions, got ${questions.length}`);
  }
  
  // Normalize each question to consistent structure
  return questions.map((q, i) => {
    // Extract common fields with fallbacks for various naming conventions
    const questionId = q.questionId || q.id || `q${i + 1}`;
    const type = normalizeQuestionType(q.type);
    const difficulty = normalizeDifficulty(q.difficulty);
    const topic = String(q.topic || "General");
    const prompt = String(q.prompt || q.question || q.questionText || "");
    
    const normalized = {
      questionId,
      type,
      difficulty,
      topic,
      prompt
    };
    
    // Add type-specific fields based on question type
    // Each type has different required fields for answers and evaluation
    if (type === "mcq") {
      // Multiple choice: 4 options, 1 correct answer (A/B/C/D)
      normalized.options = ensureArray(q.options, 4);
      normalized.correctAnswer = String(q.correctAnswer || q.answer || "A").toUpperCase();
    } else if (type === "multi_correct") {
      // Multiple correct: 4 options, exactly 2 correct answers
      normalized.options = ensureArray(q.options, 4);
      normalized.correctAnswers = ensureArray(q.correctAnswers || q.answers, 2).map(a => String(a).toUpperCase());
    } else if (type === "fill_blank") {
      // Fill in the blank: correct word/phrase to fill the blank
      normalized.correctFillBlank = String(q.correctFillBlank || q.answer || q.correctAnswer || "");
    } else if (type === "writing") {
      // Writing: model answer and evaluation criteria
      normalized.modelAnswer = String(q.modelAnswer || q.answer || "");
      normalized.criteria = ensureArray(q.criteria || q.evaluationCriteria, 3);
    }
    
    return normalized;
  });
}

/**
 * Normalize question type from various formats
 */
function normalizeQuestionType(type) {
  const t = String(type || "").toLowerCase().replace(/[_\s-]/g, "");
  
  if (t.includes("multicorrect") || t.includes("multiselect") || t.includes("multiple")) {
    return "multi_correct";
  }
  if (t.includes("fillblank") || t.includes("fill") || t.includes("blank")) {
    return "fill_blank";
  }
  if (t.includes("writing") || t.includes("essay") || t.includes("short")) {
    return "writing";
  }
  return "mcq"; // Default
}

/**
 * Normalize difficulty from various formats
 */
function normalizeDifficulty(difficulty) {
  const d = String(difficulty || "").toLowerCase();
  
  if (d.includes("hard") || d.includes("difficult")) return "hard";
  if (d.includes("medium") || d.includes("moderate")) return "medium";
  return "easy"; // Default
}

/**
 * Ensure array has expected length, filling with defaults if needed
 */
function ensureArray(arr, expectedLength) {
  if (!Array.isArray(arr)) {
    arr = [];
  }
  
  // Trim or pad to expected length
  if (arr.length > expectedLength) {
    return arr.slice(0, expectedLength);
  }
  
  while (arr.length < expectedLength) {
    arr.push(`Option ${String.fromCharCode(65 + arr.length)}`);
  }
  
  return arr.map(item => String(item));
}

/**
 * Generate test using Gemini API with retry logic
 */
async function generateTestGemini({ state, forDay, userId, version = 1 }) {

  const maxAttempts = 2;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {

      // Build question distribution
      const distribution = buildQuestionDistribution(state, forDay);
      
      // Build prompt
      const prompt = buildTestPrompt({
        ...distribution,
        forDay,
        version
      });
      
      // Call Gemini
      const rawJson = await callGeminiJsonWithFallback({
        systemPrompt: SYSTEM_TRAINER_PROMPT,
        userPrompt: JSON.stringify(prompt, null, 2),
        timeoutMs: 120000
      });
      
      const parsed = JSON.parse(rawJson);
      
      // Normalize response
      const normalized = normalizeTestContent(parsed, { forDay, version });
      
      // Validate question count
      if (normalized.length !== 20) {
        throw new Error(`Expected 20 questions, got ${normalized.length}`);
      }

      return {
        questions: normalized,
        version
      };
      
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);

      // Check for quota/rate limit errors
      if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
        if (attempt < maxAttempts) {
          const waitTime = 1500 * attempt;

          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  }
  
  throw new Error(
    `Test generation failed after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

module.exports = {
  generateTestGemini,
  normalizeTestContent,
  buildQuestionDistribution,
  buildTestPrompt
};
