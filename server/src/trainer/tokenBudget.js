/**
 * Token Budget Enforcement Module
 * 
 * Enforces strict token budgets for compressed learner context.
 * Prevents token overflow by trimming context layers when needed.
 */

const { estimateTokens } = require('./contextBuilder');

// Token budget limits (in tokens)
const BUDGET = {
  identity: 100,
  recentDays: 200,       // 6 days × ~33 tokens each
  olderAggregate: 80,
  diagnostic: 80,
  vocab: 120,
  todaysBrief: 200,
  TOTAL_MAX: 780,        // hard ceiling
};

/**
 * Enforce token budget on compressed context
 * Trims context layers if they exceed budget
 * @param {Object} context - Compressed learner context
 * @returns {Object} Context with enforced budget
 */
function enforceTokenBudget(context) {
  if (!context || typeof context !== 'object') {
    return context;
  }
  
  // Estimate current token usage
  const estimate = estimateTokens(context);
  
  // If under budget, return as-is
  if (estimate <= BUDGET.TOTAL_MAX) {
    return context;
  }
  
  console.warn(`⚠ Context exceeds token budget: ${estimate} > ${BUDGET.TOTAL_MAX}. Trimming...`);
  
  // Create a copy to modify
  const trimmed = JSON.parse(JSON.stringify(context));
  
  // Trim in order of least important first
  
  // 1. Trim vocabulary (least critical for generation)
  if (trimmed.vocabularyMemory) {
    trimmed.vocabularyMemory.wordsToAvoid = (trimmed.vocabularyMemory.wordsToAvoid || []).slice(-30);
    trimmed.vocabularyMemory.recentWords = (trimmed.vocabularyMemory.recentWords || []).slice(-5);
  }
  
  // Check if we're under budget now
  let currentEstimate = estimateTokens(trimmed);
  if (currentEstimate <= BUDGET.TOTAL_MAX) {
    console.log(`✓ Budget enforced after vocabulary trim: ${currentEstimate} tokens`);
    return trimmed;
  }
  
  // 2. Trim recent days (keep last 4 instead of 6)
  if (trimmed.curriculumTrajectory && trimmed.curriculumTrajectory.recentDays) {
    trimmed.curriculumTrajectory.recentDays = trimmed.curriculumTrajectory.recentDays.slice(-4);
  }
  
  currentEstimate = estimateTokens(trimmed);
  if (currentEstimate <= BUDGET.TOTAL_MAX) {
    console.log(`✓ Budget enforced after trajectory trim: ${currentEstimate} tokens`);
    return trimmed;
  }
  
  // 3. Trim diagnostic profile (keep top 2 weak areas only)
  if (trimmed.diagnosticProfile) {
    trimmed.diagnosticProfile.persistentWeakAreas = (trimmed.diagnosticProfile.persistentWeakAreas || []).slice(0, 2);
    trimmed.diagnosticProfile.recurringMistakePatterns = (trimmed.diagnosticProfile.recurringMistakePatterns || []).slice(0, 5);
  }
  
  currentEstimate = estimateTokens(trimmed);
  if (currentEstimate <= BUDGET.TOTAL_MAX) {
    console.log(`✓ Budget enforced after diagnostic trim: ${currentEstimate} tokens`);
    return trimmed;
  }
  
  // 4. Last resort: trim recent days to 3
  if (trimmed.curriculumTrajectory && trimmed.curriculumTrajectory.recentDays) {
    trimmed.curriculumTrajectory.recentDays = trimmed.curriculumTrajectory.recentDays.slice(-3);
  }
  
  currentEstimate = estimateTokens(trimmed);
  console.log(`✓ Budget enforced after aggressive trim: ${currentEstimate} tokens`);
  
  return trimmed;
}

/**
 * Validate that context is within token budget
 * @param {Object} context - Compressed learner context
 * @returns {{valid: boolean, estimate: number, budget: number}} Validation result
 */
function validateTokenBudget(context) {
  const estimate = estimateTokens(context);
  const valid = estimate <= BUDGET.TOTAL_MAX;
  
  return {
    valid,
    estimate,
    budget: BUDGET.TOTAL_MAX,
    message: valid 
      ? `Token budget OK: ${estimate}/${BUDGET.TOTAL_MAX}` 
      : `Token budget exceeded: ${estimate}/${BUDGET.TOTAL_MAX}`,
  };
}

module.exports = {
  enforceTokenBudget,
  validateTokenBudget,
  BUDGET,
};
