# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive cumulative test system in a language learning application. The system allows learners who pass daily evaluations (score ≥ 76%) to take optional cumulative tests that assess their knowledge across multiple days. The test system provides persistent storage, auto-save functionality, strict evaluation, and retake/regeneration capabilities.

## Glossary

- **Test_System**: The cumulative test feature that generates, stores, evaluates, and manages tests
- **Gemini_API**: Google's Generative AI service used for test generation and evaluation
- **User_State**: The persistent data structure storing user progress and current test information
- **Test_Instance**: A specific test with unique ID, questions, and user answers
- **Question_Bank**: The collection of 20 questions in a test instance
- **Test_Tab**: A new browser tab opened via window.open() for test interaction
- **Auto_Save**: Automatic persistence of user answers on every interaction
- **Evaluation_Service**: The component that sends test data to Gemini for scoring
- **Test_Version**: An integer counter that increments when a new test is generated

## Requirements

### Requirement 1: Test Eligibility and Access

**User Story:** As a learner, I want to access cumulative tests after passing daily evaluations, so that I can assess my overall progress.

#### Acceptance Criteria

1. WHEN a user completes a daily evaluation with score ≥ 76%, THE Test_System SHALL display a "Take Test" button on the evaluation result page
2. WHEN the user clicks the "Take Test" button, THE Test_System SHALL open a new browser tab at the route '/test'
3. THE Test_System SHALL verify that currentTest.forDay equals currentDay before serving test content
4. IF no valid test exists for the current day, THE Test_System SHALL display a "Generating..." message
5. WHERE a test already exists for the current day, THE Test_System SHALL serve the existing test with pre-filled answers

### Requirement 2: Test Database Schema

**User Story:** As a developer, I want a robust database schema for test storage, so that test data persists reliably across sessions.

#### Acceptance Criteria

1. THE User_State SHALL include a currentTest field with the following structure:
   - testId: string (format: "test_day{N}_v{version}")
   - forDay: integer (day number this test belongs to)
   - generatedAt: ISO 8601 timestamp
   - version: integer (starts at 1, increments on "New Test")
   - status: enum ("pending" | "submitted" | "evaluated")
   - questions: array of 20 question objects
   - userAnswers: object keyed by question id
   - result: null or evaluation result object
2. THE Test_System SHALL never delete or regenerate questions on page reload
3. THE Test_System SHALL preserve all test data until explicitly replaced by "New Test" action
4. WHEN a new test is generated, THE Test_System SHALL increment the version number
5. THE Test_System SHALL store the generatedAt timestamp in ISO 8601 format

### Requirement 3: Question Format and Distribution

**User Story:** As a learner, I want diverse question types covering multiple topics, so that the test comprehensively assesses my knowledge.

#### Acceptance Criteria

1. THE Test_System SHALL generate exactly 20 questions per test with the following distribution:
   - 8 multiple choice questions (single correct answer)
   - 4 multi-correct questions (exactly 2 correct out of 4 options)
   - 5 fill-in-the-blank questions
   - 3 short writing questions
2. THE Test_System SHALL distribute questions across topics as follows:
   - 8 questions from today's grammar topic
   - 8 questions from the last 4 days' topics (2 questions per day)
   - 4 questions from the user's persistent weak areas
3. THE Test_System SHALL distribute difficulty levels as follows:
   - 7 easy questions
   - 9 medium questions
   - 4 hard questions
4. THE Question_Bank SHALL include all necessary metadata: questionId, type, difficulty, topic, correctAnswer(s), and modelAnswer (for writing questions)
5. THE Test_System SHALL ensure each question has a unique questionId within the test

### Requirement 4: Test Generation via Gemini

**User Story:** As a developer, I want AI-powered test generation, so that tests are personalized and contextually relevant.

#### Acceptance Criteria

1. WHEN generating a test, THE Test_System SHALL send the following context to Gemini_API:
   - todaysTopic: string
   - todaysVocabulary: array of vocabulary items
   - recentTopics: array of last 4 days' topics
   - persistentWeakAreas: array of weak areas from user state
   - questionDistribution: object specifying type counts
   - topicDistribution: object specifying topic allocation
   - difficultyDistribution: object specifying difficulty spread
   - outputSchema: JSON schema for response validation
2. THE Test_System SHALL normalize the Gemini response using the same normalization logic as day content generation
3. THE Test_System SHALL validate that the response contains exactly 20 questions
4. THE Test_System SHALL save the generated questions immediately to User_State.currentTest.questions
5. IF Gemini generation fails, THE Test_System SHALL return an error message and not create a partial test

### Requirement 5: Test Serving and New Tab Behavior

**User Story:** As a learner, I want the test to open in a new tab and preserve my progress, so that I can work on it without losing my place.

#### Acceptance Criteria

1. WHEN the "Take Test" button is clicked, THE Test_System SHALL execute window.open('/test', '_blank')
2. WHEN GET /api/test is called, THE Test_System SHALL check if currentTest exists AND currentTest.forDay equals currentDay
3. IF a valid test exists, THE Test_System SHALL return the test with userAnswers pre-filled
4. IF currentTest.status is "evaluated", THE Test_System SHALL return the test with full results displayed
5. IF no valid test exists, THE Test_System SHALL return a "generating" status and trigger POST /api/test/generate
6. THE Test_System SHALL strip correctAnswer, correctAnswers, and modelAnswer fields from questions while status is "pending"
7. THE Test_System SHALL include correct answers in the response only after status becomes "evaluated"

### Requirement 6: Answer Auto-Save

**User Story:** As a learner, I want my answers to save automatically, so that I never lose my work due to accidental page refresh.

#### Acceptance Criteria

1. WHEN a user selects a radio button (MCQ), THE Test_System SHALL call PATCH /api/test/answer immediately
2. WHEN a user toggles a checkbox (multi-correct), THE Test_System SHALL call PATCH /api/test/answer immediately
3. WHEN a user blurs an input field (fill-in-blank), THE Test_System SHALL call PATCH /api/test/answer immediately
4. WHEN a user blurs a textarea (writing), THE Test_System SHALL call PATCH /api/test/answer immediately
5. THE Test_System SHALL update User_State.currentTest.userAnswers with the new answer
6. THE Test_System SHALL return success status after each auto-save operation
7. IF auto-save fails, THE Test_System SHALL display a warning toast but not block user interaction

### Requirement 7: Submission Validation

**User Story:** As a learner, I want clear validation before submission, so that I don't accidentally submit incomplete work.

#### Acceptance Criteria

1. THE Test_System SHALL validate that all 20 questions have answers before allowing submission
2. THE Test_System SHALL validate that writing answers contain at least 10 characters
3. THE Test_System SHALL validate that multi-correct questions have at least 1 option selected
4. THE Test_System SHALL perform validation on both frontend and backend
5. IF validation fails on frontend, THE Test_System SHALL display specific error messages for each incomplete question
6. IF validation fails on backend, THE Test_System SHALL return a 400 error with detailed validation errors
7. THE Test_System SHALL disable the submit button until all validation passes

### Requirement 8: Test Evaluation via Gemini

**User Story:** As a learner, I want accurate and strict evaluation of my test, so that I receive honest feedback on my knowledge.

#### Acceptance Criteria

1. WHEN a test is submitted, THE Evaluation_Service SHALL send all questions with correct answers and user answers to Gemini_API
2. THE Evaluation_Service SHALL evaluate MCQ questions by exact letter match (case-insensitive)
3. THE Evaluation_Service SHALL evaluate multi-correct questions by verifying ALL correct options are selected AND no wrong options are selected
4. THE Evaluation_Service SHALL evaluate fill-in-blank questions for grammatical and semantic correctness, allowing minor spelling variations
5. THE Evaluation_Service SHALL evaluate writing questions against modelAnswer and criteria, being strict but not pedantic
6. THE Evaluation_Service SHALL calculate overall score as percentage of correct answers
7. THE Evaluation_Service SHALL apply a pass threshold of 70% (14 out of 20 questions)
8. THE Evaluation_Service SHALL return per-question feedback including correctness, explanation, and correct answer
9. THE Evaluation_Service SHALL update User_State.currentTest.status to "evaluated"
10. THE Evaluation_Service SHALL store the complete result in User_State.currentTest.result

### Requirement 9: Post-Result Actions

**User Story:** As a learner, I want options to retake or request a new test after seeing results, so that I can improve my score or try different questions.

#### Acceptance Criteria

1. WHEN evaluation is complete, THE Test_System SHALL display two action buttons: "Retake Test" and "New Test"
2. WHEN "Retake Test" is clicked, THE Test_System SHALL reset userAnswers to empty object
3. WHEN "Retake Test" is clicked, THE Test_System SHALL reset status to "pending"
4. WHEN "Retake Test" is clicked, THE Test_System SHALL keep the same questions (no Gemini call)
5. WHEN "Retake Test" is clicked, THE Test_System SHALL clear the result field
6. WHEN "New Test" is clicked, THE Test_System SHALL only allow the action if status is "evaluated"
7. WHEN "New Test" is clicked, THE Test_System SHALL increment the version number
8. WHEN "New Test" is clicked, THE Test_System SHALL generate a completely new set of 20 questions via Gemini
9. WHEN "New Test" is clicked, THE Test_System SHALL replace the entire currentTest object
10. THE Test_System SHALL display a "View Result" button that re-renders the evaluation from database

### Requirement 10: Security and Data Protection

**User Story:** As a developer, I want secure test handling, so that users cannot cheat by inspecting correct answers before submission.

#### Acceptance Criteria

1. THE Test_System SHALL strip correctAnswer from MCQ questions in GET /api/test responses while status is "pending"
2. THE Test_System SHALL strip correctAnswers from multi-correct questions in GET /api/test responses while status is "pending"
3. THE Test_System SHALL strip modelAnswer from writing questions in GET /api/test responses while status is "pending"
4. THE Test_System SHALL only include correct answers in responses after status becomes "evaluated"
5. THE Test_System SHALL validate on backend that submitted answers match expected format
6. THE Test_System SHALL reject any attempts to modify questions or correct answers via API
7. THE Test_System SHALL use authentication middleware for all test-related API routes

### Requirement 11: API Routes

**User Story:** As a developer, I want well-defined API routes, so that the frontend can interact with the test system reliably.

#### Acceptance Criteria

1. THE Test_System SHALL implement GET /api/test to retrieve current test state
2. THE Test_System SHALL implement POST /api/test/generate to create a new test
3. THE Test_System SHALL implement PATCH /api/test/answer to save individual answers
4. THE Test_System SHALL implement POST /api/test/submit to submit completed test for evaluation
5. THE Test_System SHALL implement POST /api/test/retake to reset test for retake
6. THE Test_System SHALL implement POST /api/test/new to generate a new test version
7. THE Test_System SHALL return appropriate HTTP status codes: 200 (success), 400 (validation error), 401 (unauthorized), 500 (server error)
8. THE Test_System SHALL include detailed error messages in all error responses
9. THE Test_System SHALL log all API calls with request/response details for debugging

### Requirement 12: Test Lifecycle Management

**User Story:** As a developer, I want clear test lifecycle rules, so that the system behaves predictably across different scenarios.

#### Acceptance Criteria

1. THE Test_System SHALL create a new test only when no currentTest exists OR currentTest.forDay does not equal currentDay
2. THE Test_System SHALL preserve test state across page reloads by reading from User_State
3. THE Test_System SHALL allow only one active test per day per user
4. WHEN a user advances to a new day, THE Test_System SHALL invalidate the previous day's test
5. THE Test_System SHALL not allow "New Test" action while status is "pending" or "submitted"
6. THE Test_System SHALL allow unlimited retakes of the same test
7. THE Test_System SHALL allow unlimited new test generations after evaluation
8. THE Test_System SHALL maintain test history by incrementing version numbers

### Requirement 13: Parser and Serializer Requirements

**User Story:** As a developer, I want robust parsing and serialization of test data, so that data integrity is maintained across the system.

#### Acceptance Criteria

1. WHEN test data is received from Gemini_API, THE Test_System SHALL parse the JSON response into a Test_Instance object
2. THE Test_System SHALL validate the parsed data against the expected schema
3. THE Test_System SHALL serialize Test_Instance objects to JSON for database storage
4. THE Test_System SHALL implement a pretty printer that formats Test_Instance objects for debugging
5. FOR ALL valid Test_Instance objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
6. IF parsing fails, THE Test_System SHALL return a descriptive error indicating which field failed validation
7. THE Test_System SHALL handle edge cases such as missing optional fields, null values, and empty arrays

### Requirement 14: Error Handling and Recovery

**User Story:** As a learner, I want graceful error handling, so that temporary failures don't lose my test progress.

#### Acceptance Criteria

1. IF Gemini_API is unavailable during generation, THE Test_System SHALL retry up to 2 times with exponential backoff
2. IF all retries fail, THE Test_System SHALL display an error message and not create a partial test
3. IF auto-save fails, THE Test_System SHALL display a warning toast but allow continued interaction
4. IF submission fails due to network error, THE Test_System SHALL preserve user answers and allow retry
5. IF evaluation fails, THE Test_System SHALL keep status as "submitted" and allow re-submission
6. THE Test_System SHALL log all errors with full context for debugging
7. THE Test_System SHALL never delete test data due to errors

### Requirement 15: Frontend UI Components

**User Story:** As a learner, I want an intuitive test interface, so that I can focus on answering questions without confusion.

#### Acceptance Criteria

1. THE Test_System SHALL display a progress indicator showing answered vs total questions
2. THE Test_System SHALL visually distinguish between different question types (MCQ, multi-correct, fill-blank, writing)
3. THE Test_System SHALL display a timer showing elapsed time (non-blocking)
4. THE Test_System SHALL highlight unanswered questions in the progress indicator
5. THE Test_System SHALL disable the submit button until all questions are answered
6. THE Test_System SHALL display validation errors inline next to incomplete questions
7. THE Test_System SHALL show a confirmation dialog before submission
8. THE Test_System SHALL display evaluation results with per-question breakdown
9. THE Test_System SHALL use color coding: green for correct, red for incorrect, yellow for partial credit
10. THE Test_System SHALL display the correct answer alongside user's answer in results view
