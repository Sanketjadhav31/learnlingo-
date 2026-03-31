/**
 * Context Validator Module
 * 
 * Validates compressed learner context structure and token budgets.
 * Ensures context is well-formed before use in generation.
 */

const { estimateTokens } = require('./contextBuilder');
const { validateTokenBudget } = require('./tokenBudget');

// Token budget limits per layer
const TOKEN_BUDGETS = {
  learnerIdentity: 80,
  curriculumTrajectory: 200,
  diagnosticProfile: 300,
  vocabularyMemory: 100,
  total: 830,
};

// Valid enum values
const VALID_LEARNING_VELOCITIES = ['fast', 'steady', 'struggling'];
const VALID_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const VALID_CONFIDENCE_SIGNALS = ['strong', 'medium', 'weak', 'unknown'];

/**
 * Validate compressed learner context
 * @param {Object} context - Compressed learner context to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
function validateCompressedContext(context) {
  const errors = [];
  
  try {
    // Check if context exists
    if (!context || typeof context !== 'object') {
      errors.push('Context is null or not an object');
      return { valid: false, errors };
    }
    
    // Validate required layers are present
    if (!context.learnerIdentity) {
      errors.push('Missing required layer: learnerIdentity');
    }
    if (!context.curriculumTrajectory) {
      errors.push('Missing required layer: curriculumTrajectory');
    }
    if (!context.diagnosticProfile) {
      errors.push('Missing required layer: diagnosticProfile');
    }
    if (!context.vocabularyMemory) {
      errors.push('Missing required layer: vocabularyMemory');
    }
    
    // If any required layer is missing, return early
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    // Validate learnerIdentity structure
    validateLearnerIdentity(context.learnerIdentity, errors);
    
    // Validate curriculumTrajectory structure
    validateCurriculumTrajectory(context.curriculumTrajectory, errors);
    
    // Validate diagnosticProfile structure
    validateDiagnosticProfile(context.diagnosticProfile, errors);
    
    // Validate vocabularyMemory structure
    validateVocabularyMemory(context.vocabularyMemory, errors);
    
    // Validate token budgets
    validateTokenBudgets(context, errors);
    
    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
    return { valid: false, errors };
  }
}

/**
 * Validate learner identity layer
 * @param {Object} identity - Learner identity
 * @param {Array<string>} errors - Errors array to populate
 */
function validateLearnerIdentity(identity, errors) {
  if (!identity || typeof identity !== 'object') {
    errors.push('learnerIdentity is not an object');
    return;
  }
  
  // Check required fields
  const requiredFields = ['currentDay', 'level', 'streakDays', 'totalDaysCompleted', 'averageScore', 'learningVelocity'];
  for (const field of requiredFields) {
    if (!(field in identity)) {
      errors.push(`learnerIdentity missing required field: ${field}`);
    }
  }
  
  // Validate enum values
  if (identity.learningVelocity && !VALID_LEARNING_VELOCITIES.includes(identity.learningVelocity)) {
    errors.push(`learnerIdentity.learningVelocity has invalid value: ${identity.learningVelocity}. Must be one of: ${VALID_LEARNING_VELOCITIES.join(', ')}`);
  }
  
  if (identity.level && !VALID_LEVELS.includes(identity.level)) {
    errors.push(`learnerIdentity.level has invalid value: ${identity.level}. Must be one of: ${VALID_LEVELS.join(', ')}`);
  }
  
  // Validate numeric fields
  if (typeof identity.currentDay !== 'number' || identity.currentDay < 1) {
    errors.push('learnerIdentity.currentDay must be a positive number');
  }
  if (typeof identity.averageScore !== 'number' || identity.averageScore < 0 || identity.averageScore > 100) {
    errors.push('learnerIdentity.averageScore must be a number between 0 and 100');
  }
}

/**
 * Validate curriculum trajectory layer
 * @param {Object} trajectory - Curriculum trajectory object with recentDays and olderSummary
 * @param {Array<string>} errors - Errors array to populate
 */
function validateCurriculumTrajectory(trajectory, errors) {
  if (!trajectory || typeof trajectory !== 'object') {
    errors.push('curriculumTrajectory is not an object');
    return;
  }
  
  // Check for recentDays array
  if (!Array.isArray(trajectory.recentDays)) {
    errors.push('curriculumTrajectory.recentDays is not an array');
    return;
  }
  
  // Validate each recent day entry
  for (let i = 0; i < trajectory.recentDays.length; i++) {
    const entry = trajectory.recentDays[i];
    if (!entry || typeof entry !== 'object') {
      errors.push(`curriculumTrajectory.recentDays[${i}] is not an object`);
      continue;
    }
    
    // Check required fields
    if (!('day' in entry)) {
      errors.push(`curriculumTrajectory.recentDays[${i}] missing required field: day`);
    }
    if (!('topic' in entry)) {
      errors.push(`curriculumTrajectory.recentDays[${i}] missing required field: topic`);
    }
    if (!('confidence' in entry)) {
      errors.push(`curriculumTrajectory.recentDays[${i}] missing required field: confidence`);
    }
    
    // Validate confidence signal
    if (entry.confidence && !VALID_CONFIDENCE_SIGNALS.includes(entry.confidence)) {
      errors.push(`curriculumTrajectory.recentDays[${i}].confidence has invalid value: ${entry.confidence}`);
    }
  }
  
  // olderSummary is optional, but if present should be an object
  if (trajectory.olderSummary !== null && trajectory.olderSummary !== undefined) {
    if (typeof trajectory.olderSummary !== 'object') {
      errors.push('curriculumTrajectory.olderSummary is not an object');
    }
  }
}

/**
 * Validate diagnostic profile layer
 * @param {Object} profile - Diagnostic profile
 * @param {Array<string>} errors - Errors array to populate
 */
function validateDiagnosticProfile(profile, errors) {
  if (!profile || typeof profile !== 'object') {
    errors.push('diagnosticProfile is not an object');
    return;
  }
  
  // Check required fields
  const requiredFields = ['persistentWeakAreas', 'resolvedAreas', 'strongAreas', 'recurringMistakePatterns'];
  for (const field of requiredFields) {
    if (!(field in profile)) {
      errors.push(`diagnosticProfile missing required field: ${field}`);
    }
  }
  
  // Validate arrays
  if (!Array.isArray(profile.persistentWeakAreas)) {
    errors.push('diagnosticProfile.persistentWeakAreas is not an array');
  }
  if (!Array.isArray(profile.resolvedAreas)) {
    errors.push('diagnosticProfile.resolvedAreas is not an array');
  }
  if (!Array.isArray(profile.strongAreas)) {
    errors.push('diagnosticProfile.strongAreas is not an array');
  }
  if (!Array.isArray(profile.recurringMistakePatterns)) {
    errors.push('diagnosticProfile.recurringMistakePatterns is not an array');
  }
  
  // Validate persistent weak areas structure
  if (Array.isArray(profile.persistentWeakAreas)) {
    for (let i = 0; i < profile.persistentWeakAreas.length; i++) {
      const weakArea = profile.persistentWeakAreas[i];
      if (!weakArea || typeof weakArea !== 'object') {
        errors.push(`diagnosticProfile.persistentWeakAreas[${i}] is not an object`);
        continue;
      }
      if (!weakArea.area) {
        errors.push(`diagnosticProfile.persistentWeakAreas[${i}] missing required field: area`);
      }
      if (typeof weakArea.frequency !== 'number') {
        errors.push(`diagnosticProfile.persistentWeakAreas[${i}].frequency must be a number`);
      }
    }
  }
}

/**
 * Validate vocabulary memory layer
 * @param {Object} memory - Vocabulary memory
 * @param {Array<string>} errors - Errors array to populate
 */
function validateVocabularyMemory(memory, errors) {
  if (!memory || typeof memory !== 'object') {
    errors.push('vocabularyMemory is not an object');
    return;
  }
  
  // Check required fields
  const requiredFields = ['totalWordsLearned', 'recentWords', 'wordsToAvoid'];
  for (const field of requiredFields) {
    if (!(field in memory)) {
      errors.push(`vocabularyMemory missing required field: ${field}`);
    }
  }
  
  // Validate arrays
  if (!Array.isArray(memory.recentWords)) {
    errors.push('vocabularyMemory.recentWords is not an array');
  }
  if (!Array.isArray(memory.wordsToAvoid)) {
    errors.push('vocabularyMemory.wordsToAvoid is not an array');
  }
  
  // Validate numeric field
  if (typeof memory.totalWordsLearned !== 'number' || memory.totalWordsLearned < 0) {
    errors.push('vocabularyMemory.totalWordsLearned must be a non-negative number');
  }
}

/**
 * Validate token budgets for all layers
 * @param {Object} context - Compressed learner context
 * @param {Array<string>} errors - Errors array to populate
 */
function validateTokenBudgets(context, errors) {
  // Validate individual layer budgets
  const identityTokens = estimateTokens(context.learnerIdentity);
  if (identityTokens > TOKEN_BUDGETS.learnerIdentity) {
    errors.push(`learnerIdentity exceeds token budget: ${identityTokens} > ${TOKEN_BUDGETS.learnerIdentity}`);
  }
  
  const trajectoryTokens = estimateTokens(context.curriculumTrajectory);
  if (trajectoryTokens > TOKEN_BUDGETS.curriculumTrajectory) {
    errors.push(`curriculumTrajectory exceeds token budget: ${trajectoryTokens} > ${TOKEN_BUDGETS.curriculumTrajectory}`);
  }
  
  const profileTokens = estimateTokens(context.diagnosticProfile);
  if (profileTokens > TOKEN_BUDGETS.diagnosticProfile) {
    errors.push(`diagnosticProfile exceeds token budget: ${profileTokens} > ${TOKEN_BUDGETS.diagnosticProfile}`);
  }
  
  const memoryTokens = estimateTokens(context.vocabularyMemory);
  if (memoryTokens > TOKEN_BUDGETS.vocabularyMemory) {
    errors.push(`vocabularyMemory exceeds token budget: ${memoryTokens} > ${TOKEN_BUDGETS.vocabularyMemory}`);
  }
  
  // Validate total budget
  const totalTokens = estimateTokens(context);
  if (totalTokens > TOKEN_BUDGETS.total) {
    errors.push(`Total context exceeds token budget: ${totalTokens} > ${TOKEN_BUDGETS.total}`);
  }
}

module.exports = {
  validateCompressedContext,
  TOKEN_BUDGETS,
  VALID_LEARNING_VELOCITIES,
  VALID_LEVELS,
  VALID_CONFIDENCE_SIGNALS,
};
