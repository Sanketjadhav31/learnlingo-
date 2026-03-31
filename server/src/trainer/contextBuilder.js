/**
 * Context Builder Module
 * 
 * Builds compressed learner context from evaluation results and state.
 * Transforms raw evaluation data into a 5-layer compressed structure:
 * 1. Learner Identity - Static learner metrics
 * 2. Curriculum Trajectory - Historical topic performance
 * 3. Diagnostic Profile - Persistent weak/strong areas
 * 4. Vocabulary Memory - Recent vocabulary tracking
 * 5. Today's Brief - Computed fresh at generation time (not stored)
 */

/**
 * Estimate token count for a data structure
 * @param {any} data - Data to estimate tokens for
 * @returns {number} Estimated token count
 */
function estimateTokens(data) {
  if (!data) return 0;
  const jsonStr = JSON.stringify(data);
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(jsonStr.length / 4);
}

/**
 * Derive learner level from day number
 * @param {number} dayNumber - Current day number
 * @returns {string} Level: "Beginner", "Intermediate", or "Advanced"
 */
function deriveLevel(dayNumber) {
  if (dayNumber <= 30) return "Beginner";
  if (dayNumber <= 70) return "Intermediate";
  return "Advanced";
}

/**
 * Compute learning velocity from score history
 * @param {Array<{overallPercent: number}>} scoreHistory - Recent score history
 * @returns {string} Velocity: "fast", "steady", or "struggling"
 */
function computeLearningVelocity(scoreHistory) {
  if (!scoreHistory || scoreHistory.length === 0) return "steady";
  
  // Calculate average score
  const scores = scoreHistory.map(s => s.overallPercent || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  if (avgScore >= 85) return "fast";
  if (avgScore >= 70) return "steady";
  return "struggling";
}

/**
 * Build Learner Identity layer
 * @param {Object} state - Current user state
 * @returns {Object} Learner identity layer
 */
function buildLearnerIdentity(state) {
  const scoreHistory = state.scoreHistory || [];
  const avgScore = scoreHistory.length > 0
    ? Math.round(scoreHistory.reduce((sum, s) => sum + (s.overallPercent || 0), 0) / scoreHistory.length)
    : 0;
  
  const identity = {
    currentDay: state.currentDay || 1,
    level: deriveLevel(state.currentDay || 1),
    streakDays: state.tracker?.streak || 0,
    totalDaysCompleted: state.tracker?.totalDaysCompleted || 0,
    averageScore: avgScore,
    learningVelocity: computeLearningVelocity(scoreHistory),
  };
  
  // Enforce token budget (max 80 tokens)
  const tokens = estimateTokens(identity);
  if (tokens > 80) {
    console.warn(`⚠ LearnerIdentity exceeds token budget: ${tokens} > 80`);
  }
  
  return identity;
}

/**
 * Compute confidence signal from score
 * @param {number} score - Score percentage
 * @returns {string} Confidence: "strong", "medium", or "weak"
 */
function computeConfidenceSignal(score) {
  if (score >= 80) return "strong";
  if (score >= 60) return "medium";
  return "weak";
}

/**
 * Build Curriculum Trajectory layer with rolling window
 * ONLY keeps last 6 days in detail, older days compressed to summary stats
 * @param {Object} state - Current user state
 * @returns {Object} Curriculum trajectory with rolling window
 */
function buildCurriculumTrajectory(state) {
  const grammarCoveredByDay = state.grammarCoveredByDay || {};
  const scoreHistory = state.scoreHistory || [];
  const currentDay = state.currentDay || 1;
  
  // Rolling window: keep last 6 days only
  const windowStart = Math.max(1, currentDay - 6);
  
  // Recent days (last 6 days) - full detail
  const recentDays = [];
  for (let day = windowStart; day < currentDay; day++) {
    const topic = grammarCoveredByDay[String(day)];
    const dayScore = scoreHistory.find(s => s.dayNumber === day);
    
    if (topic) {
      recentDays.push({
        day,
        topic,
        score: dayScore?.overallPercent || null,
        confidence: dayScore ? computeConfidenceSignal(dayScore.overallPercent) : "unknown",
      });
    }
  }
  
  // Older days (before window) - compressed summary only
  const olderDays = scoreHistory.filter(s => s.dayNumber < windowStart);
  const olderSummary = olderDays.length > 0 ? {
    daysCompleted: olderDays.length,
    averageScore: Math.round(olderDays.reduce((sum, s) => sum + (s.overallPercent || 0), 0) / olderDays.length),
    topicsCount: Object.keys(grammarCoveredByDay).filter(d => parseInt(d) < windowStart).length,
  } : null;
  
  const trajectory = {
    recentDays, // Last 6 days only
    olderSummary, // Compressed stats for days before window
  };
  
  // Enforce token budget (max 200 tokens)
  const tokens = estimateTokens(trajectory);
  if (tokens > 200) {
    console.warn(`⚠ CurriculumTrajectory exceeds token budget: ${tokens} > 200`);
    // Further prune if needed (keep last 4 days instead of 6)
    trajectory.recentDays = recentDays.slice(-4);
  }
  
  console.log(`    📊 Trajectory: ${recentDays.length} recent days, ${olderSummary?.daysCompleted || 0} older days compressed`);
  
  return trajectory;
}

/**
 * Merge weak areas into diagnostic profile
 * @param {Array<Object>} existingWeak - Existing persistent weak areas
 * @param {Array<string>} newWeakAreas - New weak areas from evaluation
 * @param {number} currentDay - Current day number
 * @returns {Array<Object>} Merged persistent weak areas
 */
function mergeWeakAreas(existingWeak, newWeakAreas, currentDay) {
  const merged = [];
  const processedAreas = new Set();
  
  // Process new weak areas
  for (const area of newWeakAreas) {
    if (!area || processedAreas.has(area)) continue;
    processedAreas.add(area);
    
    const existing = existingWeak.find(w => w.area === area);
    if (existing) {
      // Increment frequency for existing weak area
      merged.push({
        area,
        frequency: existing.frequency + 1,
        lastSeen: `Day ${currentDay}`,
        severity: existing.frequency >= 2 ? "high" : "medium",
      });
    } else {
      // Add new weak area
      merged.push({
        area,
        frequency: 1,
        lastSeen: `Day ${currentDay}`,
        severity: "medium",
      });
    }
  }
  
  // Keep existing weak areas that weren't seen today (but mark them)
  for (const existing of existingWeak) {
    if (!processedAreas.has(existing.area)) {
      // This area didn't appear today - keep it but don't increment
      merged.push({
        ...existing,
        // Don't update lastSeen since it didn't appear
      });
    }
  }
  
  // Sort by frequency (highest first)
  merged.sort((a, b) => b.frequency - a.frequency);
  
  return merged;
}

/**
 * Detect resolved areas (weak areas that no longer appear)
 * @param {Array<Object>} existingWeak - Existing persistent weak areas
 * @param {Array<string>} newWeakAreas - New weak areas from evaluation
 * @param {number} currentDay - Current day number
 * @returns {Array<Object>} Newly resolved areas
 */
function detectResolvedAreas(existingWeak, newWeakAreas, currentDay) {
  const resolved = [];
  
  for (const existing of existingWeak) {
    // If an area appeared before but not in the last 2 evaluations, consider it resolved
    if (!newWeakAreas.includes(existing.area) && existing.frequency >= 1) {
      resolved.push({
        area: existing.area,
        resolvedOnDay: currentDay,
      });
    }
  }
  
  return resolved;
}

/**
 * Build Diagnostic Profile layer
 * @param {Object} state - Current user state
 * @param {Object} evaluation - Current evaluation result
 * @returns {Object} Diagnostic profile layer
 */
function buildDiagnosticProfile(state, evaluation) {
  const existingContext = state.compressedLearnerContext;
  const existingWeak = existingContext?.diagnosticProfile?.persistentWeakAreas || [];
  const existingResolved = existingContext?.diagnosticProfile?.resolvedAreas || [];
  
  const newWeakAreas = evaluation.weakAreas || [];
  const strongAreas = evaluation.strongAreas || [];
  const recurringMistakePatterns = evaluation.recurringMistakePatterns || [];
  
  // Merge weak areas with frequency tracking
  const mergedWeakAreas = mergeWeakAreas(existingWeak, newWeakAreas, state.currentDay);
  
  // Detect newly resolved areas
  const newlyResolved = detectResolvedAreas(existingWeak, newWeakAreas, state.currentDay);
  
  // Combine and prune resolved areas (keep last 5)
  const allResolved = [...existingResolved, ...newlyResolved].slice(-5);
  
  const profile = {
    persistentWeakAreas: mergedWeakAreas,
    resolvedAreas: allResolved,
    strongAreas: strongAreas.slice(0, 5), // Limit to 5
    recurringMistakePatterns: recurringMistakePatterns.slice(0, 10), // Limit to 10
  };
  
  // Enforce token budget (max 300 tokens)
  const tokens = estimateTokens(profile);
  if (tokens > 300) {
    console.warn(`⚠ DiagnosticProfile exceeds token budget: ${tokens} > 300`);
    // Prune lowest-frequency weak areas
    profile.persistentWeakAreas = profile.persistentWeakAreas.slice(0, 5);
    profile.recurringMistakePatterns = profile.recurringMistakePatterns.slice(0, 5);
  }
  
  return profile;
}

/**
 * Build Vocabulary Memory layer
 * @param {Object} state - Current user state
 * @param {Object} dayContent - Current day content (if available)
 * @returns {Object} Vocabulary memory layer
 */
function buildVocabularyMemory(state, dayContent) {
  const vocabByDay = state.vocabByDay || {};
  const currentDay = state.currentDay || 1;
  
  // Get recent words from last 2 days
  const recentDays = [currentDay - 1, currentDay];
  const recentWords = recentDays
    .flatMap(d => vocabByDay[String(d)] || [])
    .filter(Boolean);
  
  // Get words to avoid from last 7 days
  const avoidDays = Array.from({ length: 7 }, (_, i) => currentDay - i);
  const wordsToAvoid = avoidDays
    .flatMap(d => vocabByDay[String(d)] || [])
    .filter(Boolean);
  
  // Count total words learned
  const totalWordsLearned = Object.values(vocabByDay).flat().length;
  
  const memory = {
    totalWordsLearned,
    recentWords: recentWords.slice(0, 10), // Limit to 10 most recent
    wordsToAvoid: [...new Set(wordsToAvoid)].slice(0, 20), // Unique, limit to 20
  };
  
  // Enforce token budget (max 100 tokens)
  const tokens = estimateTokens(memory);
  if (tokens > 100) {
    console.warn(`⚠ VocabularyMemory exceeds token budget: ${tokens} > 100`);
    memory.recentWords = memory.recentWords.slice(0, 5);
    memory.wordsToAvoid = memory.wordsToAvoid.slice(0, 10);
  }
  
  return memory;
}

/**
 * Build compressed learner context from state and evaluation
 * @param {Object} state - Current user state
 * @param {Object} evaluation - Evaluation result
 * @param {Object} dayContent - Day content (optional)
 * @returns {Object} Compressed learner context with 4 layers
 */
function buildCompressedContext(state, evaluation, dayContent = null) {
  try {
    console.log(`    🔧 Building compressed learner context for Day ${state.currentDay}...`);
    
    const context = {
      builtOnDay: state.currentDay,
      builtAt: new Date().toISOString(),
      learnerIdentity: buildLearnerIdentity(state),
      curriculumTrajectory: buildCurriculumTrajectory(state),
      diagnosticProfile: buildDiagnosticProfile(state, evaluation),
      vocabularyMemory: buildVocabularyMemory(state, dayContent),
    };
    
    // Validate total token budget (max 830 tokens)
    const totalTokens = estimateTokens(context);
    console.log(`    📊 Compressed context token estimate: ${totalTokens} tokens`);
    
    if (totalTokens > 830) {
      console.warn(`⚠ Total compressed context exceeds budget: ${totalTokens} > 830`);
    }
    
    return context;
  } catch (error) {
    console.error(`❌ Error building compressed context:`, error);
    // Return minimal valid context on error
    return {
      builtOnDay: state.currentDay,
      builtAt: new Date().toISOString(),
      learnerIdentity: {
        currentDay: state.currentDay || 1,
        level: deriveLevel(state.currentDay || 1),
        streakDays: 0,
        totalDaysCompleted: 0,
        averageScore: 0,
        learningVelocity: "steady",
      },
      curriculumTrajectory: [],
      diagnosticProfile: {
        persistentWeakAreas: [],
        resolvedAreas: [],
        strongAreas: [],
        recurringMistakePatterns: [],
      },
      vocabularyMemory: {
        totalWordsLearned: 0,
        recentWords: [],
        wordsToAvoid: [],
      },
    };
  }
}

/**
 * Migrate from legacy state to compressed context
 * @param {Object} state - Legacy state
 * @returns {Object} Initialized compressed context
 */
function migrateFromLegacyState(state) {
  console.log(`    🔄 Migrating legacy state to compressed context...`);
  
  try {
    // Build initial context from legacy fields
    const lastEvaluation = state.lastEvaluation || {};
    const weakAreas = state.weakAreas || [];
    
    // Create a minimal evaluation object for migration
    const migrationEvaluation = {
      weakAreas: weakAreas,
      strongAreas: [], // Will be empty for migration
      recurringMistakePatterns: [], // Will be empty for migration
    };
    
    const context = buildCompressedContext(state, migrationEvaluation);
    
    console.log(`    ✓ Migration complete`);
    return context;
  } catch (error) {
    console.error(`❌ Error during migration:`, error);
    // Return minimal valid context
    return buildCompressedContext(state, {
      weakAreas: [],
      strongAreas: [],
      recurringMistakePatterns: [],
    });
  }
}

module.exports = {
  buildCompressedContext,
  migrateFromLegacyState,
  // Export helpers for testing
  buildLearnerIdentity,
  buildCurriculumTrajectory,
  buildDiagnosticProfile,
  buildVocabularyMemory,
  estimateTokens,
  deriveLevel,
  computeLearningVelocity,
  computeConfidenceSignal,
};
