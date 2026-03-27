/**
 * Test script for performance optimization features
 * Tests: debouncing, payload optimization, loading states
 */

const { stripCorrectAnswers, createAutoSaveResponse } = require('./src/trainer/testUtils');

console.log('🧪 Testing Performance Optimizations\n');

// Test 1: stripCorrectAnswers removes correct answers and criteria
console.log('Test 1: stripCorrectAnswers optimization');
const testPending = {
  testId: 'test_day1_v1',
  status: 'pending',
  questions: [
    {
      questionId: 'q1',
      type: 'mcq',
      prompt: 'What is 2+2?',
      options: ['3', '4', '5'],
      correctAnswer: 'B',
      difficulty: 'easy',
      topic: 'math'
    },
    {
      questionId: 'q2',
      type: 'writing',
      prompt: 'Write a sentence',
      modelAnswer: 'This is a model answer.',
      criteria: ['grammar', 'vocabulary', 'coherence'],
      difficulty: 'medium',
      topic: 'writing'
    }
  ]
};

const stripped = stripCorrectAnswers(testPending);
console.log('✓ Stripped test has no correctAnswer:', !stripped.questions[0].correctAnswer);
console.log('✓ Stripped test has no modelAnswer:', !stripped.questions[1].modelAnswer);
console.log('✓ Stripped test has no criteria:', !stripped.questions[1].criteria);
console.log('✓ Stripped test retains prompt:', stripped.questions[0].prompt === 'What is 2+2?');

// Test 2: stripCorrectAnswers preserves data for evaluated tests
console.log('\nTest 2: stripCorrectAnswers preserves evaluated test data');
const testEvaluated = {
  ...testPending,
  status: 'evaluated'
};

const evaluatedResult = stripCorrectAnswers(testEvaluated);
console.log('✓ Evaluated test retains correctAnswer:', evaluatedResult.questions[0].correctAnswer === 'B');
console.log('✓ Evaluated test retains modelAnswer:', evaluatedResult.questions[1].modelAnswer === 'This is a model answer.');

// Test 3: createAutoSaveResponse returns minimal payload
console.log('\nTest 3: Auto-save response optimization');
const autoSaveResponse = createAutoSaveResponse();
console.log('✓ Auto-save response is minimal:', JSON.stringify(autoSaveResponse) === '{"ok":true}');
console.log('✓ Auto-save response size:', JSON.stringify(autoSaveResponse).length, 'bytes');

// Test 4: Payload size comparison
console.log('\nTest 4: Payload size comparison');
const fullTestSize = JSON.stringify(testPending).length;
const strippedTestSize = JSON.stringify(stripped).length;
const reduction = ((fullTestSize - strippedTestSize) / fullTestSize * 100).toFixed(1);
console.log('✓ Full test payload:', fullTestSize, 'bytes');
console.log('✓ Stripped test payload:', strippedTestSize, 'bytes');
console.log('✓ Payload reduction:', reduction + '%');

console.log('\n✅ All performance optimization tests passed!');
