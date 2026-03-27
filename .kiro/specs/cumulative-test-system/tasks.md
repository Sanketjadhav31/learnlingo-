# Implementation Plan: Cumulative Test System

## Overview

This implementation plan breaks down the cumulative test system into concrete, actionable tasks following the 10-day roadmap outlined in the design document. The system allows learners who pass daily evaluations (≥76%) to take optional cumulative tests covering material from multiple days, with persistent storage, auto-save functionality, strict AI-powered evaluation, and retake/regeneration capabilities.

## Tasks

### Phase 1: Backend Foundation (Days 1-2)

- [x] 1. Extend database schema and state management
  - [x] 1.1 Add currentTest field to User_State schema
    - Add currentTest field with structure: testId, forDay, generatedAt, version, status, questions, userAnswers, result
    - Update UserState.js model in server/src/mongo/models/
    - Ensure field is optional (no migration needed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 1.2 Write unit tests for state persistence
    - Test that currentTest field persists correctly
    - Test that state loads with existing currentTest
    - Test that state loads without currentTest (backward compatibility)
    - _Requirements: 2.2, 2.3_

- [x] 2. Implement test generator module
  - [x] 2.1 Create testGenerator.js module structure
    - Create server/src/trainer/testGenerator.js
    - Import dependencies: geminiClient, prompts, schemas
    - Set up module exports for generateTestGemini and normalizeTestContent
    - _Requirements: 4.1, 4.2_
  
  - [x] 2.2 Implement buildQuestionDistribution function
    - Extract today's topic and vocabulary from state
    - Extract last 4 days' topics from grammarCoveredByDay
    - Extract persistent weak areas from state
    - Build distribution object with question types, topics, and difficulty
    - _Requirements: 3.2, 3.3_
  
  - [x] 2.3 Implement buildTestPrompt function
    - Construct prompt with task, context, requirements, and output schema
    - Include question distribution (8 MCQ, 4 multi-correct, 5 fill-blank, 3 writing)
    - Include topic distribution (8 today, 8 recent, 4 weak areas)
    - Include difficulty distribution (7 easy, 9 medium, 4 hard)
    - Add instructions for unique questionIds and correct answer formats
    - _Requirements: 3.1, 3.2, 3.3, 4.1_

  - [x] 2.4 Implement normalizeTestContent function
    - Handle various Gemini response shapes (nested questions array, flat structure)
    - Ensure exactly 20 questions with validation
    - Normalize question types, difficulty levels, and metadata
    - Ensure unique questionIds (q1-q20)
    - Validate type-specific fields (options, correctAnswer, etc.)
    - _Requirements: 3.4, 3.5, 4.2, 4.3, 13.1, 13.2_
  
  - [x] 2.5 Implement generateTestGemini function with retry logic
    - Build test prompt using buildQuestionDistribution and buildTestPrompt
    - Call Gemini API with callGeminiJsonWithFallback (120s timeout)
    - Parse and normalize response
    - Validate question count (exactly 20)
    - Implement retry logic (2 attempts with exponential backoff)
    - Handle quota/rate limit errors
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 14.1, 14.2_
  
  - [ ]* 2.6 Write unit tests for test generator
    - Test that generateTestGemini produces exactly 20 questions
    - Test question type distribution (8 MCQ, 4 multi-correct, 5 fill-blank, 3 writing)
    - Test that all questions have required fields
    - Test normalization handles various response shapes
    - Test retry logic on failure
    - _Requirements: 3.1, 3.4, 3.5, 4.3_

- [x] 3. Implement test evaluator module
  - [x] 3.1 Create testEvaluator.js module structure
    - Create server/src/trainer/testEvaluator.js
    - Import dependencies: geminiClient, prompts
    - Set up module exports for evaluateTestGemini and normalizeTestEvaluation
    - _Requirements: 8.1_
  
  - [x] 3.2 Implement buildEvaluationPrompt function
    - Include all 20 questions with correct answers
    - Include user answers for all questions
    - Specify evaluation rules (MCQ exact match, multi-correct all correct, fill-blank semantic, writing strict)
    - Specify pass threshold (70%)
    - Request per-question feedback and overall summary
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_
  
  - [x] 3.3 Implement normalizeTestEvaluation function
    - Handle various Gemini response shapes
    - Ensure exactly 20 question results
    - Calculate overall score from correct count
    - Determine passed status (score >= 70%)
    - Normalize feedback and topic arrays
    - _Requirements: 8.6, 8.7, 8.8_

  - [x] 3.4 Implement evaluateTestGemini function with retry logic
    - Build evaluation prompt with questions and user answers
    - Call Gemini API with callGeminiJsonWithFallback (120s timeout)
    - Parse and normalize response
    - Validate that all 20 questions have results
    - Implement retry logic (2 attempts with exponential backoff)
    - Update test status to "evaluated" and store result
    - _Requirements: 8.1, 8.8, 8.9, 8.10, 14.1, 14.2_
  
  - [ ]* 3.5 Write unit tests for test evaluator
    - Test MCQ evaluation (exact letter match, case-insensitive)
    - Test multi-correct evaluation (all correct, no wrong)
    - Test overall score calculation ((correct/20) * 100)
    - Test pass threshold (70%)
    - Test that evaluation includes per-question feedback
    - _Requirements: 8.2, 8.3, 8.6, 8.7, 8.8_

- [x] 4. Checkpoint - Backend foundation complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: API Routes (Days 3-4)

- [x] 5. Implement core test API routes
  - [x] 5.1 Implement GET /api/test route
    - Add authRequired middleware
    - Get user state from stateStore
    - Check if currentTest exists and forDay equals currentDay
    - Return "no_test" status if no valid test
    - Strip correct answers if status is "pending" using stripCorrectAnswers()
    - Include correct answers if status is "evaluated"
    - Return test with status
    - _Requirements: 1.3, 1.4, 1.5, 5.2, 5.3, 5.4, 5.6, 5.7, 11.1_
  
  - [x] 5.2 Implement POST /api/test/generate route
    - Add authRequired middleware
    - Get user state from stateStore
    - Verify eligibility (lastEvaluation.overallPercent >= 76)
    - Return 403 if not eligible
    - Call generateTestGemini with state, forDay, userId
    - Create currentTest object with testId, forDay, generatedAt, version, status, questions, userAnswers, result
    - Save state to database
    - Strip correct answers before returning
    - _Requirements: 1.1, 1.2, 4.1, 4.4, 11.2_
  
  - [x] 5.3 Implement PATCH /api/test/answer route
    - Add authRequired middleware
    - Extract questionId and answer from request body
    - Get user state from stateStore
    - Validate that currentTest exists and status is "pending"
    - Validate that questionId exists in test
    - Update currentTest.userAnswers[questionId] with answer
    - Save state to database
    - Return success status
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.5, 10.6, 11.3_

  - [x] 5.4 Implement POST /api/test/submit route
    - Add authRequired middleware
    - Get user state from stateStore
    - Validate that currentTest exists and status is "pending"
    - Validate submission completeness (all 20 questions answered, writing >= 10 chars, multi-correct >= 1 option)
    - Return 400 with detailed errors if validation fails
    - Call evaluateTestGemini with test, userAnswers, state
    - Update currentTest.status to "evaluated"
    - Update currentTest.result with evaluation
    - Save state to database
    - Return evaluation and full test (with correct answers)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.9, 8.10, 11.4_
  
  - [ ]* 5.5 Write integration tests for core routes
    - Test GET /api/test returns no_test when no test exists
    - Test GET /api/test returns test with stripped answers when pending
    - Test GET /api/test returns test with correct answers when evaluated
    - Test POST /api/test/generate creates valid test
    - Test POST /api/test/generate rejects ineligible users
    - Test PATCH /api/test/answer saves answers correctly
    - Test POST /api/test/submit validates and evaluates test
    - _Requirements: 1.3, 5.2, 5.6, 5.7, 7.6, 11.1, 11.2, 11.3, 11.4_

- [x] 6. Implement action API routes
  - [x] 6.1 Implement POST /api/test/retake route
    - Add authRequired middleware
    - Get user state from stateStore
    - Validate that currentTest exists and status is "evaluated"
    - Return 400 if no evaluated test
    - Reset currentTest.userAnswers to empty object
    - Reset currentTest.status to "pending"
    - Clear currentTest.result
    - Keep questions array unchanged
    - Save state to database
    - Return test with stripped correct answers
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 11.5_
  
  - [x] 6.2 Implement POST /api/test/new route
    - Add authRequired middleware
    - Get user state from stateStore
    - Validate that currentTest exists and status is "evaluated"
    - Return 400 if status is not "evaluated"
    - Increment version number (currentTest.version + 1)
    - Call generateTestGemini with state, forDay, userId, newVersion
    - Replace entire currentTest object with new test
    - Save state to database
    - Return new test with stripped correct answers
    - _Requirements: 9.6, 9.7, 9.8, 9.9, 11.6, 12.5, 12.8_
  
  - [ ]* 6.3 Write integration tests for action routes
    - Test POST /api/test/retake resets answers and status
    - Test POST /api/test/retake preserves questions
    - Test POST /api/test/retake rejects non-evaluated tests
    - Test POST /api/test/new increments version
    - Test POST /api/test/new generates new questions
    - Test POST /api/test/new rejects non-evaluated tests
    - _Requirements: 9.2, 9.3, 9.4, 9.6, 9.7, 12.8_

- [x] 7. Implement security and validation utilities
  - [x] 7.1 Implement stripCorrectAnswers function
    - Check test status (return unchanged if "evaluated")
    - For "pending" status, remove correctAnswer, correctAnswers, correctFillBlank, modelAnswer from all questions
    - Return modified test object
    - _Requirements: 5.6, 10.1, 10.2, 10.3, 10.4_
  
  - [x] 7.2 Implement validateTestSubmission function
    - Check all 20 questions have answers
    - Validate writing answers have >= 10 characters
    - Validate multi-correct answers have >= 1 option selected
    - Return validation result with ok flag, message, and detailed errors
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_
  
  - [x] 7.3 Implement sendError utility function
    - Create consistent error response format with ok: false, reject: { message, details }
    - Use in all error responses across test routes
    - _Requirements: 11.7, 11.8_
  
  - [ ]* 7.4 Write unit tests for security utilities
    - Test stripCorrectAnswers removes all correct answer fields when pending
    - Test stripCorrectAnswers preserves correct answers when evaluated
    - Test validateTestSubmission catches incomplete answers
    - Test validateTestSubmission catches short writing answers
    - Test validateTestSubmission catches empty multi-correct answers
    - _Requirements: 7.1, 7.2, 7.3, 10.1, 10.2, 10.3_

- [x] 8. Checkpoint - API routes complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Frontend Components (Days 5-7)

- [x] 9. Create TestRoute component foundation
  - [x] 9.1 Create TestRoute.tsx component file
    - Create client/src/components/TestRoute.tsx
    - Set up component structure with state management
    - Add state for test, answers, loading, submitting, evaluation, validationErrors
    - _Requirements: 5.1_
  
  - [x] 9.2 Implement test loading logic
    - Add useEffect to load test on mount
    - Call GET /api/test to retrieve current test
    - Handle "no_test" status by calling POST /api/test/generate
    - Pre-fill answers from test.userAnswers
    - Pre-fill evaluation if test.status is "evaluated"
    - _Requirements: 1.5, 5.2, 5.3, 5.4, 12.2_
  
  - [x] 9.3 Implement auto-save functionality
    - Create debounced save function (500ms delay)
    - Call PATCH /api/test/answer on every answer change
    - Update local state immediately (optimistic update)
    - Show warning toast on auto-save failure (don't block user)
    - Track pending sync answers for retry
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 14.3_

  - [x] 9.4 Implement submission validation and handling
    - Validate all 20 questions answered before enabling submit
    - Validate writing answers >= 10 characters
    - Validate multi-correct answers have >= 1 option
    - Show inline validation errors for incomplete questions
    - Retry pending syncs before submission
    - Call POST /api/test/submit on submit
    - Handle submission errors with specific messages (quota, timeout, generic)
    - Update state with evaluation results
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 14.4_
  
  - [x] 9.5 Add progress indicator and timer
    - Display progress indicator showing answered vs total questions (X/20)
    - Highlight unanswered questions in progress indicator
    - Display non-blocking timer showing elapsed time since generatedAt
    - _Requirements: 15.1, 15.3, 15.4_

- [x] 10. Create question components
  - [x] 10.1 Create MCQQuestion.tsx component
    - Display question prompt
    - Render 4 radio button options (A, B, C, D)
    - Call onAnswerChange when radio button selected
    - Show validation error if present
    - Display correct answer and feedback after evaluation
    - Disable interaction when evaluation is present
    - _Requirements: 15.2, 15.6, 15.10_
  
  - [x] 10.2 Create MultiCorrectQuestion.tsx component
    - Display question prompt
    - Render 4 checkbox options (A, B, C, D)
    - Call onAnswerChange when checkbox toggled
    - Maintain array of selected options
    - Show validation error if present
    - Display correct answers and feedback after evaluation
    - Disable interaction when evaluation is present
    - _Requirements: 15.2, 15.6, 15.10_
  
  - [x] 10.3 Create FillBlankQuestion.tsx component
    - Display question prompt
    - Render text input field
    - Call onAnswerChange on blur
    - Show validation error if present
    - Display correct answer and feedback after evaluation
    - Disable interaction when evaluation is present
    - _Requirements: 15.2, 15.6, 15.10_
  
  - [x] 10.4 Create WritingQuestion.tsx component
    - Display question prompt and criteria
    - Render textarea with character count
    - Call onAnswerChange on blur
    - Show validation error if present (minimum 10 characters)
    - Display model answer and feedback after evaluation
    - Disable interaction when evaluation is present
    - _Requirements: 15.2, 15.6, 15.10_
  
  - [x] 10.5 Create QuestionRenderer.tsx component
    - Switch on question type to render appropriate component
    - Pass question, answer, onAnswerChange, error, evaluation, disabled props
    - Handle all 4 question types (mcq, multi_correct, fill_blank, writing)
    - _Requirements: 15.2_

- [x] 11. Create evaluation display and actions
  - [x] 11.1 Create TestEvaluationDisplay.tsx component
    - Display overall score as percentage
    - Display pass/fail status with color coding
    - Display per-question breakdown with correctness indicators
    - Show user answer vs correct answer for each question
    - Show feedback for each question
    - Use color coding: green for correct, red for incorrect
    - Display weak topics and strong topics
    - Display overall feedback
    - _Requirements: 15.8, 15.9, 15.10_
  
  - [x] 11.2 Implement retake and new test actions in TestRoute
    - Add "Retake Test" button (visible when evaluation present)
    - Call POST /api/test/retake on click
    - Reset local state (answers, evaluation, validationErrors)
    - Add "New Test" button (visible when evaluation present)
    - Call POST /api/test/new on click
    - Reset local state and load new test
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_
  
  - [x] 11.3 Add confirmation dialog for submission
    - Show confirmation dialog before submitting test
    - Display warning about finality of submission
    - Proceed with submission only on confirmation
    - _Requirements: 15.7_

- [x] 12. Extend EvaluationPanel component
  - [x] 12.1 Add "Take Test" button to EvaluationPanel.tsx
    - Check if evaluation.passFail is "PASS" and overallPercent >= 76
    - Display "📝 Take Cumulative Test" button
    - Call window.open('/test', '_blank') on click
    - Style button consistently with existing UI
    - _Requirements: 1.1, 1.2_
  
  - [x] 12.2 Add /test route to App.tsx
    - Add route for /test path
    - Render TestRoute component
    - Ensure route is accessible without navigation (direct URL)
    - _Requirements: 1.2, 5.1_

- [x] 13. Checkpoint - Frontend components complete
  - Ensure all components render correctly, ask the user if questions arise.

### Phase 4: Integration and Testing (Days 8-9)

- [ ] 14. End-to-end integration testing
  - [ ]* 14.1 Write integration test for complete test flow
    - Test: User passes evaluation → generates test → answers questions → submits → sees results
    - Verify test has 20 questions
    - Verify answers persist across page reloads
    - Verify evaluation returns correct score
    - Verify correct answers shown after evaluation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2, 5.3, 5.4, 6.5, 8.9, 8.10_
  
  - [ ]* 14.2 Write integration test for retake flow
    - Test: User completes test → retakes → answers again → submits
    - Verify questions remain the same
    - Verify answers reset to empty
    - Verify status changes to pending
    - Verify new evaluation is independent
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [ ]* 14.3 Write integration test for new test flow
    - Test: User completes test → generates new test → answers → submits
    - Verify version increments
    - Verify questions are different
    - Verify new test is independent
    - _Requirements: 9.7, 9.8, 9.9, 12.8_
  
  - [ ]* 14.4 Write integration test for error scenarios
    - Test auto-save failure (network error)
    - Test submission failure (network error)
    - Test Gemini API failure (quota exceeded)
    - Verify data is not lost on errors
    - Verify graceful error messages
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7_
  
  - [ ]* 14.5 Write integration test for security measures
    - Test that correct answers are not in GET /api/test response when pending
    - Test that correct answers are in GET /api/test response when evaluated
    - Test that unauthenticated requests return 401
    - Test that ineligible users cannot generate tests
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7_

- [ ] 15. Property-based testing
  - [ ]* 15.1 Write property test: Test generation produces exactly 20 valid questions
    - **Property 1: Test generation produces exactly 20 valid questions**
    - **Validates: Requirements 2.1, 3.1, 3.4, 3.5, 4.3**
    - Generate test with various user states
    - Verify exactly 20 questions
    - Verify all questions have unique questionIds
    - Verify all questions have required metadata fields
  
  - [ ]* 15.2 Write property test: Question distribution matches specification
    - **Property 2: Question distribution matches specification**
    - **Validates: Requirements 3.1**
    - Generate test with various user states
    - Verify 8 MCQ, 4 multi-correct, 5 fill-blank, 3 writing
  
  - [ ]* 15.3 Write property test: Test persistence round-trip
    - **Property 3: Test persistence round-trip**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
    - Serialize test to JSON then deserialize
    - Verify equivalent test with same questions, answers, metadata
  
  - [ ]* 15.4 Write property test: Answer auto-save persistence
    - **Property 4: Answer auto-save persistence**
    - **Validates: Requirements 6.5, 6.6**
    - Save answer via PATCH /api/test/answer
    - Retrieve test via GET /api/test
    - Verify answer is in userAnswers
  
  - [ ]* 15.5 Write property test: Security stripping for pending tests
    - **Property 5: Security stripping for pending tests**
    - **Validates: Requirements 5.6, 10.1, 10.2, 10.3**
    - Call stripCorrectAnswers on pending test
    - Verify all correct answer fields removed

  - [ ]* 15.6 Write property test: Correct answers included after evaluation
    - **Property 6: Correct answers included after evaluation**
    - **Validates: Requirements 5.7, 10.4**
    - Call stripCorrectAnswers on evaluated test
    - Verify all correct answer fields present
  
  - [ ]* 15.7 Write property test: Test validity check
    - **Property 7: Test validity check**
    - **Validates: Requirements 1.3, 5.2, 12.1**
    - Test GET /api/test with various currentTest states
    - Verify test only served when forDay equals currentDay
  
  - [ ]* 15.8 Write property test: Version incrementing
    - **Property 8: Version incrementing**
    - **Validates: Requirements 2.4, 9.7, 12.8**
    - Generate test with version N
    - Call POST /api/test/new
    - Verify new test has version N+1
  
  - [ ]* 15.9 Write property test: Retake preserves questions
    - **Property 9: Retake preserves questions**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5**
    - Complete test and evaluate
    - Call POST /api/test/retake
    - Verify questions array unchanged, userAnswers empty, status pending
  
  - [ ]* 15.10 Write property test: Submission validation completeness
    - **Property 10: Submission validation completeness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
    - Submit test with various answer states
    - Verify validation passes only when all 20 questions answered correctly
  
  - [ ]* 15.11 Write property test: Backend validation rejects invalid submissions
    - **Property 11: Backend validation rejects invalid submissions**
    - **Validates: Requirements 7.6, 11.7, 11.8**
    - Submit incomplete test
    - Verify 400 error with detailed validation errors
  
  - [ ]* 15.12 Write property test: MCQ evaluation by exact match
    - **Property 12: MCQ evaluation by exact match**
    - **Validates: Requirements 8.2**
    - Evaluate MCQ with various answers
    - Verify correct only when exact match (case-insensitive)
  
  - [ ]* 15.13 Write property test: Multi-correct evaluation requires exact match
    - **Property 13: Multi-correct evaluation requires exact match**
    - **Validates: Requirements 8.3**
    - Evaluate multi-correct with various answer combinations
    - Verify correct only when ALL correct selected AND no wrong selected
  
  - [ ]* 15.14 Write property test: Overall score calculation
    - **Property 14: Overall score calculation**
    - **Validates: Requirements 8.6**
    - Evaluate test with various correct counts
    - Verify score equals (correct/20) * 100

  - [ ]* 15.15 Write property test: Pass threshold at 70%
    - **Property 15: Pass threshold at 70%**
    - **Validates: Requirements 8.7**
    - Evaluate test with various scores
    - Verify passed true if and only if score >= 70%
  
  - [ ]* 15.16 Write property test: Evaluation updates test status
    - **Property 16: Evaluation updates test status**
    - **Validates: Requirements 8.9, 8.10**
    - Submit test for evaluation
    - Verify status updated to "evaluated" and result stored
  
  - [ ]* 15.17 Write property test: New test authorization
    - **Property 17: New test authorization**
    - **Validates: Requirements 9.6, 12.5**
    - Call POST /api/test/new with various test states
    - Verify rejected unless status is "evaluated"
  
  - [ ]* 15.18 Write property test: One test per day per user
    - **Property 18: One test per day per user**
    - **Validates: Requirements 12.3**
    - Generate test for user on day N
    - Verify only one test exists with forDay = N
  
  - [ ]* 15.19 Write property test: Test invalidation on day advance
    - **Property 19: Test invalidation on day advance**
    - **Validates: Requirements 12.4**
    - Create test for day N
    - Advance currentDay to N+1
    - Verify GET /api/test returns no_test
  
  - [ ]* 15.20 Write property test: Error recovery preserves data
    - **Property 20: Error recovery preserves data**
    - **Validates: Requirements 14.4, 14.5, 14.7**
    - Simulate submission/evaluation failure
    - Verify test data (questions, userAnswers) unchanged
  
  - [ ]* 15.21 Write property test: Authentication required for all test routes
    - **Property 21: Authentication required for all test routes**
    - **Validates: Requirements 10.7**
    - Call all test routes without authentication
    - Verify all return 401 Unauthorized
  
  - [ ]* 15.22 Write property test: ISO 8601 timestamp format
    - **Property 22: ISO 8601 timestamp format**
    - **Validates: Requirements 2.5**
    - Generate test
    - Verify generatedAt is valid ISO 8601 timestamp
  
  - [ ]* 15.23 Write property test: Evaluation includes per-question feedback
    - **Property 23: Evaluation includes per-question feedback**
    - **Validates: Requirements 8.8**
    - Evaluate test
    - Verify questionResults has exactly 20 entries with all required fields

- [ ] 16. Checkpoint - Integration and testing complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: Polish and Documentation (Day 10)

- [x] 17. Error handling improvements
  - [x] 17.1 Enhance frontend error messages
    - Add specific error messages for quota exceeded (429)
    - Add specific error messages for timeout errors
    - Add specific error messages for network failures
    - Improve toast notifications with actionable guidance
    - _Requirements: 14.1, 14.2_
  
  - [x] 17.2 Enhance backend error logging
    - Add structured logging for all test operations
    - Log test generation duration and success/failure
    - Log evaluation duration and success/failure
    - Log auto-save success/failure rates
    - Add error context (userId, testId, operation)
    - _Requirements: 11.9_
  
  - [x] 17.3 Implement retry logic for pending syncs
    - Track answers that failed to auto-save
    - Retry pending syncs before submission
    - Retry pending syncs on next successful save
    - Show clear warning if syncs still pending at submission
    - _Requirements: 14.3, 14.4_

- [x] 18. Performance optimization
  - [x] 18.1 Optimize auto-save debouncing
    - Tune debounce delay (currently 500ms)
    - Test with various network conditions
    - Ensure no answer loss on rapid changes
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 18.2 Add loading states and spinners
    - Show loading spinner during test generation
    - Show loading spinner during evaluation
    - Disable submit button during submission
    - Show progress indicator during long operations
    - _Requirements: 1.4, 15.1_
  
  - [x] 18.3 Optimize test data transfer
    - Verify correct answers stripped before sending to frontend
    - Minimize payload size for GET /api/test
    - Consider pagination for large evaluation results (future enhancement)
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 19. Documentation and code quality
  - [x] 19.1 Add inline code comments
    - Document all complex functions in testGenerator.js
    - Document all complex functions in testEvaluator.js
    - Document security measures in stripCorrectAnswers
    - Document validation logic in validateTestSubmission
    - Document API route handlers
  
  - [x] 19.2 Update API documentation
    - Document all 6 test routes (GET /api/test, POST /api/test/generate, PATCH /api/test/answer, POST /api/test/submit, POST /api/test/retake, POST /api/test/new)
    - Document request/response formats
    - Document error codes and messages
    - Document authentication requirements
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [x] 19.3 Create user guide for test feature
    - Document how to access cumulative tests
    - Document test format and question types
    - Document auto-save behavior
    - Document retake and new test options
    - Document scoring and pass threshold
    - _Requirements: 1.1, 1.2, 3.1, 6.1, 8.7, 9.1, 9.6_

- [x] 20. Final checkpoint - Feature complete
  - Ensure all tests pass, verify feature works end-to-end, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties from the design document
- Unit and integration tests validate specific examples and edge cases
- The implementation follows existing patterns from dayGenerator.js, evaluationService.js, and stateStore.js
- All test routes use the existing authRequired middleware for security
- The frontend uses React with TypeScript, following existing component patterns
- The backend uses Express with JavaScript, following existing route patterns
