/**
 * Strip correct answers from test questions based on test status
 * 
 * SECURITY MEASURE: This function prevents cheating by removing correct answers
 * from pending tests. Only evaluated tests include correct answers so users can
 * review their mistakes.
 * 
 * OPTIMIZATION: Also reduces payload size by removing evaluation-only fields
 * like criteria for writing questions.
 * 
 * @param {Object} test - Test object with questions and status
 * @returns {Object|null} Test with correct answers stripped (if pending) or full test (if evaluated)
 */
function stripCorrectAnswers(test) {
  if (!test) {
    return null;
  }
  
  // If test is evaluated, include correct answers for review
  // Users need to see what they got wrong
  if (test.status === "evaluated") {
    return test;
  }
  
  // For pending tests, strip all correct answer fields and optimize payload
  return {
    ...test,
    questions: test.questions.map(q => {
      const stripped = { ...q };
      
      // Remove correct answer fields based on question type
      // These fields would allow users to cheat
      delete stripped.correctAnswer;        // MCQ correct answer
      delete stripped.correctAnswers;       // Multi-correct answers
      delete stripped.correctFillBlank;     // Fill-blank answer
      delete stripped.modelAnswer;          // Writing model answer
      
      // Remove criteria for writing questions (only needed during evaluation)
      delete stripped.criteria;
      
      return stripped;
    })
  };
}

/**
 * Minimize test payload for auto-save responses
 * Returns only essential confirmation data
 */
function createAutoSaveResponse() {
  return { ok: true };
}

/**
 * Validate test submission completeness
 * 
 * This function ensures all 20 questions have valid answers before allowing
 * submission. It performs type-specific validation:
 * - MCQ/Fill-blank: Answer must exist and not be empty
 * - Writing: Answer must be at least 10 characters (prevents trivial responses)
 * - Multi-correct: Must select at least one option
 * 
 * @param {Object} test - Test object with questions and userAnswers
 * @returns {Object} Validation result with ok, message, and details array
 */
function validateTestSubmission(test) {
  const errors = [];
  
  // Check all 20 questions have answers
  test.questions.forEach(q => {
    const answer = test.userAnswers[q.questionId];
    
    // Check if answer exists and is not empty
    if (answer === undefined || answer === null || answer === "") {
      errors.push({
        questionId: q.questionId,
        message: "Answer required"
      });
      return;
    }
    
    // Type-specific validation
    if (q.type === "writing") {
      // Writing questions require meaningful responses (min 10 chars)
      const answerStr = String(answer).trim();
      if (answerStr.length < 10) {
        errors.push({
          questionId: q.questionId,
          message: "Writing answer must be at least 10 characters"
        });
      }
    }
    
    if (q.type === "multi_correct") {
      // Multi-correct questions require at least one selection
      if (!Array.isArray(answer) || answer.length === 0) {
        errors.push({
          questionId: q.questionId,
          message: "Select at least one option"
        });
      }
    }
  });
  
  return {
    ok: errors.length === 0,
    message: errors.length > 0 ? "Incomplete submission" : "Valid",
    details: errors
  };
}

/**
 * Send consistent error response
 */
function sendError(res, statusCode, message, details = null) {
  return res.status(statusCode).json({
    ok: false,
    reject: {
      message,
      ...(details && { details })
    }
  });
}

module.exports = {
  stripCorrectAnswers,
  validateTestSubmission,
  sendError,
  createAutoSaveResponse
};
