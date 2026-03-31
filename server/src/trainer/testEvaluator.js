const { callGeminiJsonWithFallback } = require("./geminiClient");
const { SYSTEM_TEST_EVALUATOR_PROMPT } = require("./prompts");

/**
 * Build evaluation prompt for Gemini
 */
function buildEvaluationPrompt({ test, userAnswers }) {
  return {
    task: "Strictly evaluate a cumulative test submission",
    
    test: {
      testId: test.testId,
      forDay: test.forDay,
      version: test.version,
      questions: test.questions.map(q => ({
        questionId: q.questionId,
        type: q.type,
        prompt: q.prompt,
        ...(q.type === "mcq" && {
          options: q.options,
          correctAnswer: q.correctAnswer
        }),
        ...(q.type === "multi_correct" && {
          options: q.options,
          correctAnswers: q.correctAnswers
        }),
        ...(q.type === "fill_blank" && {
          correctFillBlank: q.correctFillBlank
        }),
        ...(q.type === "writing" && {
          modelAnswer: q.modelAnswer,
          criteria: q.criteria
        })
      }))
    },
    
    userAnswers,
    
    evaluationRules: {
      mcq: "Exact letter match (case-insensitive). Correct only if user answer matches correctAnswer exactly.",
      multiCorrect: "ALL correct options selected AND no wrong options selected. Partial credit not allowed.",
      fillBlank: "Grammatically and semantically correct. Allow minor spelling variations but wrong grammar is incorrect.",
      writing: "Evaluate against modelAnswer and criteria. Check: grammar correctness, required concept demonstrated, sentence completeness, no major errors. Strict but not pedantic - a correct idea with minor errors can pass.",
      passThreshold: 70,
      partialCredit: "Only for writing questions (0-1 scale based on criteria met)"
    },
    
    outputExpectations: {
      overallScore: "Percentage (0-100)",
      passed: "Boolean based on 70% threshold",
      totalQuestions: 20,
      correctCount: "Number of correct answers",
      questionResults: "Array of 20 results with questionId, correct, userAnswer, correctAnswer, feedback",
      overallFeedback: "2-3 sentences summarizing performance",
      weakTopics: "Array of topics to review",
      strongTopics: "Array of topics mastered"
    },
    
    strictInstructions: [
      "Evaluate all 20 questions",
      "Provide specific feedback for each question",
      "Be strict but fair",
      "For MCQ: only exact match is correct",
      "For multi-correct: must have ALL correct and NO wrong options",
      "For fill-blank: check grammar and meaning, allow minor spelling errors",
      "For writing: evaluate against criteria, be strict but not pedantic",
      "Identify patterns in mistakes",
      "Suggest specific topics to review"
    ]
  };
}

/**
 * Normalize test evaluation from Gemini response
 * Handles various response shapes and calculates final scores
 * 
 * This function processes Gemini's evaluation response, which may come in different
 * formats, and normalizes it into a consistent structure. It also calculates the
 * overall score and determines pass/fail based on the 70% threshold.
 * 
 * @param {Object} raw - Raw evaluation response from Gemini API
 * @returns {Object} Normalized evaluation with scores, results, and feedback
 * @throws {Error} If question results not found or count != 20
 */
function normalizeTestEvaluation(raw) {
  // Extract question results from various possible response shapes
  // Gemini may use different field names for the results array
  let questionResults = [];
  
  if (Array.isArray(raw.questionResults)) {
    questionResults = raw.questionResults;
  } else if (Array.isArray(raw.results)) {
    questionResults = raw.results;
  } else if (Array.isArray(raw.questions)) {
    questionResults = raw.questions;
  } else if (raw.perQuestion && Array.isArray(raw.perQuestion)) {
    questionResults = raw.perQuestion;
  } else if (raw.evaluation && Array.isArray(raw.evaluation.questionResults)) {
    questionResults = raw.evaluation.questionResults;
  } else if (raw.evaluation && Array.isArray(raw.evaluation.results)) {
    questionResults = raw.evaluation.results;
  } else if (raw.questions && Array.isArray(raw.questions.answers)) {
    // Handle daily evaluation format: questions.answers array
    questionResults = raw.questions.answers;
  } else if (raw.listening && Array.isArray(raw.listening.answers)) {
    // Fallback: try listening.answers if questions not found
    questionResults = raw.listening.answers;
  } else {
    // Better error message showing what we actually got
    const availableKeys = Object.keys(raw).join(', ');
    const arrayKeys = Object.keys(raw).filter(k => Array.isArray(raw[k])).join(', ');
    const nestedInfo = raw.questions ? `questions type: ${typeof raw.questions}, keys: ${Object.keys(raw.questions).join(', ')}` : 'no questions key';
    throw new Error(
      `Cannot find question results in Gemini response. ` +
      `Available keys: [${availableKeys}]. ` +
      `Array keys: [${arrayKeys || 'none'}]. ` +
      `${nestedInfo}`
    );
  }
  
  // Validate count - must have results for all 20 questions
  if (questionResults.length !== 20) {
    throw new Error(`Expected 20 question results, got ${questionResults.length}`);
  }
  
  // Normalize each result with consistent field names
  const normalized = questionResults.map(r => {
    // Handle both test format and daily evaluation format
    const questionId = r.questionId || r.id || (r.k ? `q${r.k}` : "");
    const correct = r.correct !== undefined 
      ? Boolean(r.correct) 
      : r.isCorrect !== undefined
        ? Boolean(r.isCorrect)
        : r.correctness === "Correct";
    
    return {
      questionId,
      correct,
      userAnswer: r.userAnswer || r.answer || "",
      correctAnswer: r.correctAnswer || r.correctVersion || r.expected || "",
      feedback: String(r.feedback || r.errorReason || r.explanation || ""),
      // Partial credit only applies to writing questions (0-1 scale)
      ...(r.partialCredit !== undefined && { partialCredit: Number(r.partialCredit) })
    };
  });
  
  // Calculate overall score: count correct answers and convert to percentage
  const correctCount = normalized.filter(r => r.correct).length;
  const overallScore = Math.round((correctCount / 20) * 100);
  
  return {
    overallScore,
    passed: overallScore >= 70, // 70% is the passing threshold
    totalQuestions: 20,
    correctCount,
    questionResults: normalized,
    overallFeedback: String(raw.overallFeedback || raw.summary || raw.feedback || ""),
    weakTopics: ensureStringArray(raw.weakTopics || raw.areasToReview || []),
    strongTopics: ensureStringArray(raw.strongTopics || raw.masteredTopics || [])
  };
}

/**
 * Ensure array contains only strings
 */
function ensureStringArray(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }
  return arr.map(item => String(item)).filter(s => s.length > 0);
}

/**
 * Evaluate test using Gemini API with retry logic
 */
async function evaluateTestGemini({ test, userAnswers, state }) {

  const maxAttempts = 2;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {

      // Build evaluation prompt
      const prompt = buildEvaluationPrompt({ test, userAnswers });
      
      // Call Gemini with test-specific prompt
      const rawJson = await callGeminiJsonWithFallback({
        systemPrompt: SYSTEM_TEST_EVALUATOR_PROMPT,
        userPrompt: JSON.stringify(prompt, null, 2),
        timeoutMs: 120000
      });
      
      
      
      const parsed = JSON.parse(rawJson);
      
      // Debug: Log the actual response structure
      
      
      
      // Normalize response
      const normalized = normalizeTestEvaluation(parsed);
      
      // Validate that all 20 questions have results
      if (normalized.questionResults.length !== 20) {
        throw new Error(`Expected 20 question results, got ${normalized.questionResults.length}`);
      }

      return normalized;
      
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
    `Test evaluation failed after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

module.exports = {
  evaluateTestGemini,
  normalizeTestEvaluation,
  buildEvaluationPrompt
};
