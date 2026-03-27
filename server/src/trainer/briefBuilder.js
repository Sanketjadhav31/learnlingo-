/**
 * Brief Builder Module
 * 
 * Builds today's strategic brief from compressed learner context.
 * This layer is computed fresh at generation time and never stored.
 * It provides strategic directives for content generation.
 */

const { estimateTokens } = require('./contextBuilder');

/**
 * Build today's strategic brief from compressed context
 * @param {Object} compressedContext - Compressed learner context
 * @param {number} dayNumber - Current day number
 * @returns {Object} Today's brief with strategic directives
 */
function buildTodaysBrief(compressedContext, dayNumber) {
  try {
    if (!compressedContext) {
      console.warn(`⚠ No compressed context provided for buildTodaysBrief`);
      return getDefaultBrief(dayNumber);
    }
    
    const { learnerIdentity, curriculumTrajectory, diagnosticProfile, vocabularyMemory } = compressedContext;
    
    // Compute primary goal from highest-frequency persistent weak area
    const primaryGoal = computePrimaryGoal(diagnosticProfile);
    
    // Compute reinforcement goal from recently resolved areas
    const reinforcementGoal = computeReinforcementGoal(diagnosticProfile);
    
    // Extract avoid topics from last 3 days
    const avoidTopics = extractAvoidTopics(curriculumTrajectory, dayNumber);
    
    // Compute difficulty target based on learning velocity
    const difficultyTarget = computeDifficultyTarget(learnerIdentity);
    
    // Generate sentence design instruction
    const sentenceDesignInstruction = generateSentenceDesignInstruction(diagnosticProfile);
    
    // Generate vocabulary instruction
    const vocabularyInstruction = generateVocabularyInstruction(vocabularyMemory);
    
    const brief = {
      primaryGoal,
      reinforcementGoal,
      avoidTopics,
      difficultyTarget,
      sentenceDesignInstruction,
      vocabularyInstruction,
    };
    
    // Enforce token budget (max 150 tokens)
    const tokens = estimateTokens(brief);
    if (tokens > 150) {
      console.warn(`⚠ TodaysBrief exceeds token budget: ${tokens} > 150`);
      // Truncate instructions if needed
      brief.sentenceDesignInstruction = brief.sentenceDesignInstruction.slice(0, 100);
      brief.vocabularyInstruction = brief.vocabularyInstruction.slice(0, 80);
    }
    
    return brief;
  } catch (error) {
    console.error(`❌ Error building today's brief:`, error);
    return getDefaultBrief(dayNumber);
  }
}

/**
 * Compute primary goal from diagnostic profile
 * @param {Object} diagnosticProfile - Diagnostic profile
 * @returns {string} Primary goal
 */
function computePrimaryGoal(diagnosticProfile) {
  if (!diagnosticProfile || !diagnosticProfile.persistentWeakAreas) {
    return "Build foundational English skills";
  }
  
  const weakAreas = diagnosticProfile.persistentWeakAreas;
  if (weakAreas.length === 0) {
    return "Continue strengthening overall English proficiency";
  }
  
  // Target the highest-frequency weak area
  const topWeakArea = weakAreas[0];
  return `Focus on improving ${topWeakArea.area}`;
}

/**
 * Compute reinforcement goal from diagnostic profile
 * @param {Object} diagnosticProfile - Diagnostic profile
 * @returns {string} Reinforcement goal
 */
function computeReinforcementGoal(diagnosticProfile) {
  if (!diagnosticProfile || !diagnosticProfile.resolvedAreas) {
    return "No specific reinforcement needed";
  }
  
  const resolvedAreas = diagnosticProfile.resolvedAreas;
  if (resolvedAreas.length === 0) {
    return "No specific reinforcement needed";
  }
  
  // Target the most recently resolved area
  const recentResolved = resolvedAreas[resolvedAreas.length - 1];
  return `Reinforce ${recentResolved.area} to ensure retention`;
}

/**
 * Extract topics to avoid from curriculum trajectory
 * @param {Array} curriculumTrajectory - Curriculum trajectory
 * @param {number} dayNumber - Current day number
 * @returns {Array<string>} Topics to avoid
 */
function extractAvoidTopics(curriculumTrajectory, dayNumber) {
  if (!curriculumTrajectory || curriculumTrajectory.length === 0) {
    return [];
  }
  
  // Get topics from last 3 days
  const recentTopics = curriculumTrajectory
    .filter(entry => entry.day >= dayNumber - 3 && entry.day < dayNumber)
    .map(entry => entry.topic)
    .filter(Boolean);
  
  return [...new Set(recentTopics)]; // Remove duplicates
}

/**
 * Compute difficulty target based on learning velocity
 * @param {Object} learnerIdentity - Learner identity
 * @returns {string} Difficulty target
 */
function computeDifficultyTarget(learnerIdentity) {
  if (!learnerIdentity || !learnerIdentity.learningVelocity) {
    return "Standard difficulty - maintain steady progression";
  }
  
  const velocity = learnerIdentity.learningVelocity;
  
  switch (velocity) {
    case "fast":
      return "Slightly increase complexity - learner is gaining confidence quickly";
    case "struggling":
      return "Maintain current difficulty - do not introduce new complexity";
    case "steady":
    default:
      return "Standard difficulty - maintain steady progression";
  }
}

/**
 * Generate sentence design instruction from diagnostic profile
 * @param {Object} diagnosticProfile - Diagnostic profile
 * @returns {string} Sentence design instruction
 */
function generateSentenceDesignInstruction(diagnosticProfile) {
  if (!diagnosticProfile || !diagnosticProfile.persistentWeakAreas) {
    return "Design sentences with varied grammar structures for comprehensive practice";
  }
  
  const highSeverityAreas = diagnosticProfile.persistentWeakAreas
    .filter(w => w.severity === "high")
    .slice(0, 2); // Top 2 high-severity areas
  
  if (highSeverityAreas.length === 0) {
    return "Design sentences with varied grammar structures for comprehensive practice";
  }
  
  const area = highSeverityAreas[0].area;
  return `At least 7 of 20 sentences must include ${area} practice so the learner gets implicit reinforcement while learning the new topic`;
}

/**
 * Generate vocabulary instruction from vocabulary memory
 * @param {Object} vocabularyMemory - Vocabulary memory
 * @returns {string} Vocabulary instruction
 */
function generateVocabularyInstruction(vocabularyMemory) {
  if (!vocabularyMemory || !vocabularyMemory.recentWords) {
    return "Introduce 10 new words appropriate for the learner's level";
  }
  
  const recentWords = vocabularyMemory.recentWords.slice(0, 4);
  
  if (recentWords.length === 0) {
    return "Introduce 10 new words appropriate for the learner's level";
  }
  
  return `Introduce 10 new words. You may reuse these recent words in new contexts: ${recentWords.join(", ")}`;
}

/**
 * Get default brief when context is unavailable
 * @param {number} dayNumber - Current day number
 * @returns {Object} Default brief
 */
function getDefaultBrief(dayNumber) {
  const level = dayNumber <= 30 ? "Beginner" : dayNumber <= 70 ? "Intermediate" : "Advanced";
  
  return {
    primaryGoal: `Build foundational ${level} English skills`,
    reinforcementGoal: "No specific reinforcement needed",
    avoidTopics: [],
    difficultyTarget: "Standard difficulty - maintain steady progression",
    sentenceDesignInstruction: "Design sentences with varied grammar structures for comprehensive practice",
    vocabularyInstruction: "Introduce 10 new words appropriate for the learner's level",
  };
}

module.exports = {
  buildTodaysBrief,
  // Export helpers for testing
  computePrimaryGoal,
  computeReinforcementGoal,
  extractAvoidTopics,
  computeDifficultyTarget,
  generateSentenceDesignInstruction,
  generateVocabularyInstruction,
  getDefaultBrief,
};
