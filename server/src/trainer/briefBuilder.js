/**
 * Brief Builder Module
 * 
 * Builds today's strategic brief from compressed learner context.
 * This layer is computed fresh at generation time and never stored.
 * It provides strategic directives for content generation.
 */

const { estimateTokens } = require('./contextBuilder');
const { getTopicForDay, isRevisionDay, getRevisionScope } = require('./curriculum');

/**
 * Build today's strategic brief from compressed context
 * @param {Object} compressedContext - Compressed learner context
 * @param {number} dayNumber - Current day number
 * @returns {Object} Today's brief with strategic directives
 */
function buildTodaysBrief(compressedContext, dayNumber) {
  try {
    if (!compressedContext) {

      return getDefaultBrief(dayNumber);
    }
    
    const { learnerIdentity, curriculumTrajectory, diagnosticProfile, vocabularyMemory } = compressedContext;
    
    // Get curriculum topic for today (from fixed spine)
    const curriculumEntry = getTopicForDay(dayNumber);
    const isReview = isRevisionDay(dayNumber);
    
    // Compute primary goal from curriculum + weak areas
    const primaryGoal = computePrimaryGoal(diagnosticProfile, curriculumEntry, isReview);
    
    // Compute reinforcement goal from recently resolved areas
    const reinforcementGoal = computeReinforcementGoal(diagnosticProfile);
    
    // Extract avoid topics from last 3 days (only for normal days)
    const avoidTopics = isReview ? [] : extractAvoidTopics(curriculumTrajectory, dayNumber);
    
    // Get week topics for review days
    const weekTopics = isReview ? getRevisionScope(dayNumber) : null;
    
    // Compute difficulty target based on learning velocity
    const difficultyTarget = computeDifficultyTarget(learnerIdentity);
    
    // Generate sentence design instruction
    const sentenceDesignInstruction = generateSentenceDesignInstruction(diagnosticProfile, isReview);
    
    // Generate vocabulary instruction
    const vocabularyInstruction = generateVocabularyInstruction(vocabularyMemory);
    
    const brief = {
      todaysTopic: curriculumEntry.topic,
      grammarFocus: curriculumEntry.grammarFocus || curriculumEntry.topic,
      subTopics: curriculumEntry.subTopics || [],
      skillFocus: curriculumEntry.skillFocus || "mixed",
      category: curriculumEntry.category,
      weekNumber: curriculumEntry.weekNumber,
      dayInWeek: curriculumEntry.dayInWeek,
      isReviewDay: isReview,
      weekTopicsToReview: weekTopics,
      primaryGoal,
      reinforcementGoal,
      avoidTopics,
      difficultyTarget,
      sentenceDesignInstruction,
      vocabularyInstruction,
    };
    
    // Enforce token budget (max 350 tokens for normal days, 400 for review days with more metadata)
    const tokens = estimateTokens(brief);
    const maxTokens = isReview ? 400 : 350;
    if (tokens > maxTokens) {

      // Truncate instructions if needed
      brief.sentenceDesignInstruction = brief.sentenceDesignInstruction.slice(0, 100);
      brief.vocabularyInstruction = brief.vocabularyInstruction.slice(0, 80);
    }

    return brief;
  } catch (error) {

    return getDefaultBrief(dayNumber);
  }
}

/**
 * Compute primary goal from curriculum + diagnostic profile
 * @param {Object} diagnosticProfile - Diagnostic profile
 * @param {Object} curriculumEntry - Curriculum entry for today
 * @param {boolean} isReview - Whether today is a review day
 * @returns {string} Primary goal
 */
function computePrimaryGoal(diagnosticProfile, curriculumEntry, isReview) {
  if (isReview) {
    return `Review and consolidate all topics from this week`;
  }
  
  // Primary goal is always the curriculum topic
  let goal = `Teach: ${curriculumEntry.topic}`;
  
  // Add weak area weaving if applicable
  if (diagnosticProfile && diagnosticProfile.persistentWeakAreas && diagnosticProfile.persistentWeakAreas.length > 0) {
    const topWeakArea = diagnosticProfile.persistentWeakAreas[0];
    if (topWeakArea.severity === "high") {
      goal += ` (weave in ${topWeakArea.area} practice implicitly)`;
    }
  }
  
  return goal;
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
 * @param {Object} curriculumTrajectory - Curriculum trajectory with rolling window
 * @param {number} dayNumber - Current day number
 * @returns {Array<string>} Topics to avoid
 */
function extractAvoidTopics(curriculumTrajectory, dayNumber) {
  if (!curriculumTrajectory || !curriculumTrajectory.recentDays) {
    return [];
  }
  
  // Get topics from last 3 days from rolling window
  const recentTopics = curriculumTrajectory.recentDays
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
 * @param {boolean} isReview - Whether today is a review day
 * @returns {string} Sentence design instruction
 */
function generateSentenceDesignInstruction(diagnosticProfile, isReview) {
  if (isReview) {
    return "Design sentences that test all grammar topics from this week - mix them evenly";
  }
  
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
  const curriculumEntry = getTopicForDay(dayNumber);
  const isReview = isRevisionDay(dayNumber);
  const weekTopics = isReview ? getRevisionScope(dayNumber) : null;
  
  return {
    todaysTopic: curriculumEntry.topic,
    grammarFocus: curriculumEntry.grammarFocus || curriculumEntry.topic,
    subTopics: curriculumEntry.subTopics || [],
    skillFocus: curriculumEntry.skillFocus || "mixed",
    isReviewDay: isReview,
    weekTopicsToReview: weekTopics,
    primaryGoal: isReview ? "Review and consolidate all topics from this week" : `Teach: ${curriculumEntry.topic}`,
    reinforcementGoal: "No specific reinforcement needed",
    avoidTopics: [],
    difficultyTarget: "Standard difficulty - maintain steady progression",
    sentenceDesignInstruction: isReview 
      ? "Design sentences that test all grammar topics from this week - mix them evenly"
      : "Design sentences with varied grammar structures for comprehensive practice",
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
