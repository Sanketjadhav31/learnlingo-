/**
 * Quick test script for context compression modules
 */

const { buildCompressedContext, migrateFromLegacyState } = require('./src/trainer/contextBuilder');
const { buildTodaysBrief } = require('./src/trainer/briefBuilder');
const { validateCompressedContext } = require('./src/trainer/contextValidator');

// Mock state for testing
const mockState = {
  currentDay: 5,
  level: "Beginner",
  tracker: {
    streak: 4,
    totalDaysCompleted: 4,
    averageScore: 76,
  },
  scoreHistory: [
    { dayNumber: 1, overallPercent: 70 },
    { dayNumber: 2, overallPercent: 75 },
    { dayNumber: 3, overallPercent: 80 },
    { dayNumber: 4, overallPercent: 79 },
  ],
  grammarCoveredByDay: {
    "1": "Simple Present Tense",
    "2": "Articles (a, an, the)",
    "3": "Present Continuous",
    "4": "Prepositions of Time",
  },
  vocabByDay: {
    "3": ["routine", "activity", "daily"],
    "4": ["article", "noun", "vowel"],
  },
};

// Mock evaluation
const mockEvaluation = {
  weakAreas: ["Article usage", "Verb agreement"],
  strongAreas: ["Sentence structure", "Vocabulary retention"],
  recurringMistakePatterns: [
    "Omits article before vowel-starting nouns",
    "Uses 'is' instead of 'are' for plural subjects",
  ],
};

console.log('🧪 Testing Context Compression Modules\n');

// Test 1: Build compressed context
console.log('Test 1: Building compressed context...');
try {
  const context = buildCompressedContext(mockState, mockEvaluation);
  console.log('✓ Context built successfully');
  console.log('  - Learner Identity:', JSON.stringify(context.learnerIdentity, null, 2));
  console.log('  - Curriculum Trajectory entries:', context.curriculumTrajectory.length);
  console.log('  - Persistent Weak Areas:', context.diagnosticProfile.persistentWeakAreas.length);
  console.log('  - Vocabulary total words:', context.vocabularyMemory.totalWordsLearned);
} catch (error) {
  console.error('✗ Failed:', error.message);
}

// Test 2: Validate compressed context
console.log('\nTest 2: Validating compressed context...');
try {
  const context = buildCompressedContext(mockState, mockEvaluation);
  const validation = validateCompressedContext(context);
  if (validation.valid) {
    console.log('✓ Context validation passed');
  } else {
    console.error('✗ Validation failed:', validation.errors);
  }
} catch (error) {
  console.error('✗ Failed:', error.message);
}

// Test 3: Build today's brief
console.log('\nTest 3: Building today\'s brief...');
try {
  const context = buildCompressedContext(mockState, mockEvaluation);
  const brief = buildTodaysBrief(context, 5);
  console.log('✓ Brief built successfully');
  console.log('  - Primary Goal:', brief.primaryGoal);
  console.log('  - Difficulty Target:', brief.difficultyTarget);
  console.log('  - Avoid Topics:', brief.avoidTopics);
} catch (error) {
  console.error('✗ Failed:', error.message);
}

// Test 4: Migration from legacy state
console.log('\nTest 4: Testing migration from legacy state...');
try {
  const legacyState = {
    ...mockState,
    lastEvaluation: mockEvaluation,
    weakAreas: ["Article usage", "Verb agreement"],
  };
  const migratedContext = migrateFromLegacyState(legacyState);
  console.log('✓ Migration successful');
  console.log('  - Built on Day:', migratedContext.builtOnDay);
  const validation = validateCompressedContext(migratedContext);
  console.log('  - Validation:', validation.valid ? 'PASS' : 'FAIL');
} catch (error) {
  console.error('✗ Failed:', error.message);
}

console.log('\n✅ All tests completed!');
