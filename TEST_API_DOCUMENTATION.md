# Cumulative Test System - API Documentation

## Overview
The cumulative test system provides 6 REST API endpoints for generating, taking, and evaluating English proficiency tests. All endpoints require authentication via JWT token.

## Authentication
All test endpoints require the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

If authentication fails, endpoints return:
```json
{
  "ok": false,
  "reject": {
    "message": "Unauthorized"
  }
}
```
**Status Code:** 401

---

## Endpoints

### 1. GET /api/test
**Purpose:** Retrieve the current test state for the authenticated user.

**Authentication:** Required

**Request:**
- Method: GET
- Headers: `Authorization: Bearer <token>`
- Body: None

**Response - Success (Test Exists):**
```json
{
  "ok": true,
  "test": {
    "testId": "test_day5_v1",
    "forDay": 5,
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "version": 1,
    "status": "pending",
    "questions": [
      {
        "questionId": "q1",
        "type": "mcq",
        "difficulty": "easy",
        "topic": "Present Simple",
        "prompt": "Which sentence is correct?",
        "options": ["A) He go to school", "B) He goes to school", "C) He going to school", "D) He is go to school"]
      }
      // ... 19 more questions
    ],
    "userAnswers": {
      "q1": "B",
      "q2": "A"
    }
  },
  "status": "pending"
}
```
**Status Code:** 200

**Response - Success (No Test):**
```json
{
  "ok": true,
  "test": null,
  "status": "no_test"
}
```
**Status Code:** 200

**Response - Error:**
```json
{
  "ok": false,
  "reject": {
    "message": "Failed to retrieve test"
  }
}
```
**Status Code:** 500

**Notes:**
- For pending tests, correct answers are stripped for security (prevents cheating)
- For evaluated tests, correct answers are included for review
- Tests are day-specific and expire when user advances to next day

---

### 2. POST /api/test/generate
**Purpose:** Generate a new 20-question cumulative test based on user's learning history.

**Authentication:** Required

**Eligibility:** User must have passed today's evaluation with ≥76%

**Request:**
- Method: POST
- Headers: `Authorization: Bearer <token>`
- Body: None

**Response - Success:**
```json
{
  "ok": true,
  "test": {
    "testId": "test_day5_v1",
    "forDay": 5,
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "version": 1,
    "status": "pending",
    "questions": [
      // 20 questions (correct answers stripped)
    ],
    "userAnswers": {}
  }
}
```
**Status Code:** 200

**Response - Not Eligible:**
```json
{
  "ok": false,
  "reject": {
    "message": "Complete daily evaluation with ≥76% to access test"
  }
}
```
**Status Code:** 403

**Response - AI Service Busy:**
```json
{
  "ok": false,
  "reject": {
    "message": "AI service is temporarily busy. Please try again in a moment."
  }
}
```
**Status Code:** 503

**Response - Timeout:**
```json
{
  "ok": false,
  "reject": {
    "message": "Test generation timed out. Please try again."
  }
}
```
**Status Code:** 504

**Response - General Error:**
```json
{
  "ok": false,
  "reject": {
    "message": "Failed to generate test"
  }
}
```
**Status Code:** 500

**Test Structure:**
- Total Questions: 20
- Question Types:
  - MCQ (Multiple Choice): 8 questions
  - Multi-Correct: 4 questions (exactly 2 correct answers)
  - Fill-in-the-Blank: 5 questions
  - Writing: 3 questions (2-3 sentences required)
- Topic Distribution:
  - Today's topic: 8 questions (40%)
  - Recent topics (last 4 days): 8 questions (40%)
  - Weak areas: 4 questions (20%)
- Difficulty Distribution:
  - Easy: 7 questions
  - Medium: 9 questions
  - Hard: 4 questions

---

### 3. PATCH /api/test/answer
**Purpose:** Auto-save a single answer during test-taking (optimized for minimal payload).

**Authentication:** Required

**Request:**
- Method: PATCH
- Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
- Body:
```json
{
  "questionId": "q1",
  "answer": "B"
}
```

**Answer Formats by Question Type:**
- MCQ: String (e.g., "B")
- Multi-Correct: Array (e.g., ["A", "C"])
- Fill-in-the-Blank: String (e.g., "goes")
- Writing: String (e.g., "The cat is sleeping on the couch. It looks very comfortable.")

**Response - Success:**
```json
{
  "ok": true
}
```
**Status Code:** 200

**Response - No Active Test:**
```json
{
  "ok": false,
  "reject": {
    "message": "No active test"
  }
}
```
**Status Code:** 400

**Response - Invalid Question ID:**
```json
{
  "ok": false,
  "reject": {
    "message": "Invalid question ID"
  }
}
```
**Status Code:** 400

**Response - Error:**
```json
{
  "ok": false,
  "reject": {
    "message": "Failed to save answer"
  }
}
```
**Status Code:** 500

**Notes:**
- Minimal response payload for performance
- Answers are saved immediately (no need to wait for submission)
- Can be called multiple times for the same question (updates answer)
- Only works on pending tests

---

### 4. POST /api/test/submit
**Purpose:** Submit completed test for AI evaluation.

**Authentication:** Required

**Request:**
- Method: POST
- Headers: `Authorization: Bearer <token>`
- Body: None (answers already saved via PATCH /api/test/answer)

**Response - Success:**
```json
{
  "ok": true,
  "evaluation": {
    "overallScore": 85,
    "passed": true,
    "totalQuestions": 20,
    "correctCount": 17,
    "questionResults": [
      {
        "questionId": "q1",
        "correct": true,
        "userAnswer": "B",
        "correctAnswer": "B",
        "feedback": "Correct! 'Goes' is the correct form for third person singular."
      },
      {
        "questionId": "q2",
        "correct": false,
        "userAnswer": "A",
        "correctAnswer": "C",
        "feedback": "Incorrect. The past tense of 'go' is 'went', not 'goed'."
      }
      // ... 18 more results
    ],
    "overallFeedback": "Good performance overall. Focus on irregular past tense verbs and prepositions.",
    "weakTopics": ["Irregular Verbs", "Prepositions"],
    "strongTopics": ["Present Simple", "Articles"]
  },
  "test": {
    "testId": "test_day5_v1",
    "status": "evaluated",
    "questions": [
      // All 20 questions with correct answers included
    ],
    "userAnswers": {
      // All user answers
    },
    "result": {
      // Same as evaluation object
    }
  }
}
```
**Status Code:** 200

**Response - No Active Test:**
```json
{
  "ok": false,
  "reject": {
    "message": "No active test"
  }
}
```
**Status Code:** 400

**Response - Incomplete Submission:**
```json
{
  "ok": false,
  "reject": {
    "message": "Incomplete submission",
    "details": [
      {
        "questionId": "q15",
        "message": "Answer required"
      },
      {
        "questionId": "q18",
        "message": "Writing answer must be at least 10 characters"
      }
    ]
  }
}
```
**Status Code:** 400

**Response - AI Service Unavailable:**
```json
{
  "ok": false,
  "reject": {
    "message": "AI evaluation service temporarily unavailable"
  }
}
```
**Status Code:** 503

**Response - Timeout:**
```json
{
  "ok": false,
  "reject": {
    "message": "Evaluation timeout - please try again"
  }
}
```
**Status Code:** 504

**Response - Error:**
```json
{
  "ok": false,
  "reject": {
    "message": "Evaluation failed - please retry"
  }
}
```
**Status Code:** 500

**Validation Rules:**
- All 20 questions must have answers
- Writing answers must be at least 10 characters
- Multi-correct answers must have at least one selection

**Evaluation Rules:**
- MCQ: Exact letter match (case-insensitive)
- Multi-Correct: ALL correct options selected AND no wrong options
- Fill-in-the-Blank: Grammatically and semantically correct (minor spelling variations allowed)
- Writing: Evaluated against model answer and criteria (strict but fair)
- Pass Threshold: 70% (14/20 correct)

---

### 5. POST /api/test/retake
**Purpose:** Reset an evaluated test to retake with the same questions.

**Authentication:** Required

**Request:**
- Method: POST
- Headers: `Authorization: Bearer <token>`
- Body: None

**Response - Success:**
```json
{
  "ok": true,
  "test": {
    "testId": "test_day5_v1",
    "forDay": 5,
    "version": 1,
    "status": "pending",
    "questions": [
      // Same 20 questions (correct answers stripped)
    ],
    "userAnswers": {}
  }
}
```
**Status Code:** 200

**Response - No Evaluated Test:**
```json
{
  "ok": false,
  "reject": {
    "message": "No evaluated test to retake"
  }
}
```
**Status Code:** 400

**Response - Error:**
```json
{
  "ok": false,
  "reject": {
    "message": "Failed to reset test"
  }
}
```
**Status Code:** 500

**Notes:**
- Clears all user answers
- Resets status to "pending"
- Keeps the same questions (allows practice)
- Correct answers are stripped for security

---

### 6. POST /api/test/new
**Purpose:** Generate a new version of the test with different questions.

**Authentication:** Required

**Request:**
- Method: POST
- Headers: `Authorization: Bearer <token>`
- Body: None

**Response - Success:**
```json
{
  "ok": true,
  "test": {
    "testId": "test_day5_v2",
    "forDay": 5,
    "version": 2,
    "status": "pending",
    "questions": [
      // 20 new questions (correct answers stripped)
    ],
    "userAnswers": {}
  }
}
```
**Status Code:** 200

**Response - Cannot Generate:**
```json
{
  "ok": false,
  "reject": {
    "message": "Can only generate new test after evaluation"
  }
}
```
**Status Code:** 400

**Response - AI Service Busy:**
```json
{
  "ok": false,
  "reject": {
    "message": "AI service is temporarily busy. Please try again in a moment."
  }
}
```
**Status Code:** 503

**Response - Timeout:**
```json
{
  "ok": false,
  "reject": {
    "message": "Test generation timed out. Please try again."
  }
}
```
**Status Code:** 504

**Response - Error:**
```json
{
  "ok": false,
  "reject": {
    "message": "Failed to generate new test"
  }
}
```
**Status Code:** 500

**Notes:**
- Can only be called after evaluating current test
- Increments version number
- Generates completely new questions
- Maintains same topic distribution and difficulty

---

## Question Types Reference

### MCQ (Multiple Choice)
```json
{
  "questionId": "q1",
  "type": "mcq",
  "difficulty": "easy",
  "topic": "Present Simple",
  "prompt": "Which sentence is correct?",
  "options": ["A) He go", "B) He goes", "C) He going", "D) He is go"],
  "correctAnswer": "B"
}
```

### Multi-Correct
```json
{
  "questionId": "q2",
  "type": "multi_correct",
  "difficulty": "medium",
  "topic": "Articles",
  "prompt": "Select ALL correct sentences:",
  "options": ["A) I have a apple", "B) I have an apple", "C) The sun is bright", "D) A sun is bright"],
  "correctAnswers": ["B", "C"]
}
```

### Fill-in-the-Blank
```json
{
  "questionId": "q3",
  "type": "fill_blank",
  "difficulty": "easy",
  "topic": "Present Simple",
  "prompt": "She ___ to school every day.",
  "correctFillBlank": "goes"
}
```

### Writing
```json
{
  "questionId": "q4",
  "type": "writing",
  "difficulty": "hard",
  "topic": "Past Tense Narrative",
  "prompt": "Write 2-3 sentences about what you did yesterday.",
  "modelAnswer": "Yesterday, I went to the park with my friends. We played soccer and had a picnic. It was a wonderful day.",
  "criteria": [
    "Uses past tense correctly",
    "Complete sentences with proper punctuation",
    "Coherent narrative flow"
  ]
}
```

---

## Error Codes Summary

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| 200 | Success | Request completed successfully |
| 400 | Bad Request | No active test, incomplete submission, invalid data |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User not eligible (evaluation score < 76%) |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | AI service quota exceeded or temporarily down |
| 504 | Gateway Timeout | AI service took too long to respond |

---

## Security Features

1. **Answer Stripping:** Correct answers are removed from pending tests to prevent cheating
2. **Authentication:** All endpoints require valid JWT token
3. **Eligibility Check:** Test generation requires passing daily evaluation
4. **Validation:** Submission validation ensures all questions are answered
5. **Day-Specific Tests:** Tests expire when user advances to next day

---

## Performance Optimizations

1. **Minimal Auto-Save Response:** PATCH /api/test/answer returns only `{ok: true}` for speed
2. **Payload Optimization:** Unnecessary fields removed from pending tests
3. **Retry Logic:** Built-in retry for AI service quota errors
4. **Timeout Handling:** Graceful timeout handling with specific error messages
