# Cumulative Test System - Design Document

## Overview

The cumulative test system is a comprehensive assessment feature that allows learners who pass daily evaluations (score ≥ 76%) to take optional tests covering material from multiple days. The system provides persistent storage, auto-save functionality, strict AI-powered evaluation, and retake/regeneration capabilities.

This design follows the existing architecture patterns established in the codebase, reusing proven approaches from `dayGenerator.js`, `evaluationService.js`, and `stateStore.js`.

## Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ EvaluationPanel│  │  TestRoute   │  │  TestInterface       │  │
│  │ (Take Test btn)│  │  (/test)     │  │  (Questions + Save)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/JSON
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Express)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              API Routes (server/src/index.js)            │   │
│  │  GET /api/test  │  POST /api/test/generate               │   │
│  │  PATCH /api/test/answer  │  POST /api/test/submit        │   │
│  │  POST /api/test/retake   │  POST /api/test/new           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────────────────┼────────────────────────────────┐  │
│  │                          ▼                                 │  │
│  │  ┌──────────────────────────────────────────────────┐     │  │
│  │  │      testGenerator.js (New Module)               │     │  │
│  │  │  - generateTestGemini()                          │     │  │
│  │  │  - normalizeTestContent()                        │     │  │
│  │  └──────────────────────────────────────────────────┘     │  │
│  │                          │                                 │  │
│  │  ┌──────────────────────▼──────────────────────────┐     │  │
│  │  │      testEvaluator.js (New Module)              │     │  │
│  │  │  - evaluateTestGemini()                         │     │  │
│  │  │  - normalizeTestEvaluation()                    │     │  │
│  │  └──────────────────────────────────────────────────┘     │  │
│  │                          │                                 │  │
│  │  ┌──────────────────────▼──────────────────────────┐     │  │
│  │  │      geminiClient.js (Existing)                 │     │  │
│  │  │  - callGeminiJsonWithFallback()                 │     │  │
│  │  └──────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │      stateStore.js (Existing - Extended)                  │  │
│  │  - User_State.currentTest (New Field)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Test Access**: User completes daily evaluation → EvaluationPanel shows "Take Test" button → Opens `/test` in new tab
2. **Test Generation**: Frontend calls `POST /api/test/generate` → Backend calls `generateTestGemini()` → Gemini returns 20 questions → Normalized and saved to `currentTest`
3. **Auto-Save**: User answers question → Frontend calls `PATCH /api/test/answer` → Backend updates `currentTest.userAnswers[questionId]`
4. **Submission**: User clicks submit → Frontend calls `POST /api/test/submit` → Backend calls `evaluateTestGemini()` → Results saved to `currentTest.result`
5. **Retake/New**: User clicks action → Backend resets or regenerates test → Frontend reloads


## Components and Interfaces

### Backend Components

#### 1. testGenerator.js (New Module)

**Location**: `server/src/trainer/testGenerator.js`

**Purpose**: Generate cumulative tests using Gemini API, following the same pattern as `dayGenerator.js`.

**Key Functions**:

```javascript
async function generateTestGemini({ state, forDay, userId }) {
  // Similar structure to generateDayContentGemini
  // 1. Build context from state (today's topic, last 4 days, weak areas)
  // 2. Construct prompt with distribution requirements
  // 3. Call Gemini with schema enforcement
  // 4. Normalize response
  // 5. Validate question counts
  // 6. Return test object
}

function normalizeTestContent(raw, { forDay, version }) {
  // Similar to normalizeDayContent
  // Handles various Gemini response shapes
  // Ensures all 20 questions have required fields
  // Strips correct answers before returning
}

function buildTestResponseSchema() {
  // JSON schema for Gemini response
  // Enforces 20 questions with specific distribution
}
```

**Reused Patterns**:
- Retry logic with exponential backoff (from `dayGenerator.js`)
- Schema validation with Zod
- Normalization of AI responses
- Error handling and logging

#### 2. testEvaluator.js (New Module)

**Location**: `server/src/trainer/testEvaluator.js`

**Purpose**: Evaluate test submissions using Gemini API, following the same pattern as `evaluationService.js`.

**Key Functions**:

```javascript
async function evaluateTestGemini({ test, userAnswers, state }) {
  // Similar structure to evaluateSubmissionGemini
  // 1. Build evaluation prompt with questions and answers
  // 2. Call Gemini for strict evaluation
  // 3. Normalize response
  // 4. Validate per-question feedback
  // 5. Calculate overall score
  // 6. Return evaluation object
}

function normalizeTestEvaluation(raw) {
  // Similar to normalizeEvaluationShape
  // Handles various Gemini response formats
  // Ensures all 20 questions have feedback
}
```

**Reused Patterns**:
- Evaluation prompt structure (from `evaluationService.js`)
- Normalization of correctness values
- Score calculation logic
- Retry mechanism for incomplete responses

#### 3. API Route Handlers (Extended in server/src/index.js)

**New Routes**:

```javascript
// GET /api/test - Retrieve current test state
app.get("/api/test", authRequired, async (req, res) => {
  const userId = req.userId;
  const state = await stateStore.getOrCreate(userId);
  
  // Check if currentTest exists and is for current day
  if (!state.currentTest || state.currentTest.forDay !== state.currentDay) {
    return res.json({ ok: true, test: null, status: "no_test" });
  }
  
  // Strip correct answers if status is "pending"
  const test = stripCorrectAnswers(state.currentTest);
  
  return res.json({ ok: true, test, status: state.currentTest.status });
});

// POST /api/test/generate - Generate new test
app.post("/api/test/generate", authRequired, async (req, res) => {
  const userId = req.userId;
  const state = await stateStore.getOrCreate(userId);
  
  // Verify eligibility (passed today's evaluation)
  if (!state.lastEvaluation || state.lastEvaluation.overallPercent < 76) {
    return res.status(403).json({ 
      ok: false, 
      reject: { message: "Complete daily evaluation with ≥76% to access test" } 
    });
  }
  
  // Generate test
  const test = await generateTestGemini({ 
    state, 
    forDay: state.currentDay, 
    userId 
  });
  
  // Save to state
  state.currentTest = {
    testId: `test_day${state.currentDay}_v${test.version}`,
    forDay: state.currentDay,
    generatedAt: new Date().toISOString(),
    version: test.version,
    status: "pending",
    questions: test.questions,
    userAnswers: {},
    result: null
  };
  
  await stateStore.save(userId, state);
  
  return res.json({ ok: true, test: stripCorrectAnswers(state.currentTest) });
});

// PATCH /api/test/answer - Auto-save answer
app.patch("/api/test/answer", authRequired, async (req, res) => {
  const userId = req.userId;
  const { questionId, answer } = req.body;
  
  const state = await stateStore.getOrCreate(userId);
  
  if (!state.currentTest || state.currentTest.status !== "pending") {
    return res.status(400).json({ 
      ok: false, 
      reject: { message: "No active test" } 
    });
  }
  
  // Update answer
  state.currentTest.userAnswers[questionId] = answer;
  await stateStore.save(userId, state);
  
  return res.json({ ok: true });
});

// POST /api/test/submit - Submit test for evaluation
app.post("/api/test/submit", authRequired, async (req, res) => {
  const userId = req.userId;
  const state = await stateStore.getOrCreate(userId);
  
  if (!state.currentTest || state.currentTest.status !== "pending") {
    return res.status(400).json({ 
      ok: false, 
      reject: { message: "No active test" } 
    });
  }
  
  // Validate all questions answered
  const validation = validateTestSubmission(state.currentTest);
  if (!validation.ok) {
    return res.status(400).json({ 
      ok: false, 
      reject: { message: validation.message, details: validation.details } 
    });
  }
  
  // Evaluate
  const evaluation = await evaluateTestGemini({
    test: state.currentTest,
    userAnswers: state.currentTest.userAnswers,
    state
  });
  
  // Update state
  state.currentTest.status = "evaluated";
  state.currentTest.result = evaluation;
  await stateStore.save(userId, state);
  
  return res.json({ ok: true, evaluation, test: state.currentTest });
});

// POST /api/test/retake - Reset test for retake
app.post("/api/test/retake", authRequired, async (req, res) => {
  const userId = req.userId;
  const state = await stateStore.getOrCreate(userId);
  
  if (!state.currentTest || state.currentTest.status !== "evaluated") {
    return res.status(400).json({ 
      ok: false, 
      reject: { message: "No evaluated test to retake" } 
    });
  }
  
  // Reset answers and status
  state.currentTest.userAnswers = {};
  state.currentTest.status = "pending";
  state.currentTest.result = null;
  await stateStore.save(userId, state);
  
  return res.json({ ok: true, test: stripCorrectAnswers(state.currentTest) });
});

// POST /api/test/new - Generate new test version
app.post("/api/test/new", authRequired, async (req, res) => {
  const userId = req.userId;
  const state = await stateStore.getOrCreate(userId);
  
  if (!state.currentTest || state.currentTest.status !== "evaluated") {
    return res.status(400).json({ 
      ok: false, 
      reject: { message: "Can only generate new test after evaluation" } 
    });
  }
  
  // Generate new version
  const newVersion = state.currentTest.version + 1;
  const test = await generateTestGemini({ 
    state, 
    forDay: state.currentDay, 
    userId,
    version: newVersion
  });
  
  // Replace current test
  state.currentTest = {
    testId: `test_day${state.currentDay}_v${newVersion}`,
    forDay: state.currentDay,
    generatedAt: new Date().toISOString(),
    version: newVersion,
    status: "pending",
    questions: test.questions,
    userAnswers: {},
    result: null
  };
  
  await stateStore.save(userId, state);
  
  return res.json({ ok: true, test: stripCorrectAnswers(state.currentTest) });
});
```


### Frontend Components

#### 1. TestRoute Component (New)

**Location**: `client/src/components/TestRoute.tsx`

**Purpose**: Main test interface opened in new tab via `window.open('/test', '_blank')`.

**Key Features**:
- Loads test via `GET /api/test`
- Displays 20 questions with appropriate UI for each type
- Auto-saves answers on every interaction
- Shows progress indicator (answered vs total)
- Validates completion before enabling submit
- Displays evaluation results after submission
- Provides "Retake" and "New Test" actions

**State Management**:
```typescript
const [test, setTest] = useState<Test | null>(null);
const [answers, setAnswers] = useState<Record<string, any>>({});
const [submitting, setSubmitting] = useState(false);
const [evaluation, setEvaluation] = useState<TestEvaluation | null>(null);
```

#### 2. EvaluationPanel Extension (Modified)

**Location**: `client/src/components/EvaluationPanel.tsx`

**Modification**: Add "Take Test" button when evaluation shows PASS (≥76%).

```typescript
{evaluation.passFail === "PASS" && evaluation.overallPercent >= 76 && (
  <button
    onClick={() => window.open('/test', '_blank')}
    className="..."
    type="button"
  >
    📝 Take Cumulative Test
  </button>
)}
```

#### 3. Question Components (New)

**Location**: `client/src/components/test/`

Individual components for each question type:
- `MCQQuestion.tsx` - Single correct answer (radio buttons)
- `MultiCorrectQuestion.tsx` - Multiple correct answers (checkboxes)
- `FillBlankQuestion.tsx` - Text input
- `WritingQuestion.tsx` - Textarea with character count

Each component:
- Receives question data and current answer
- Calls `onAnswerChange(questionId, answer)` on interaction
- Shows validation errors if incomplete
- Displays correct answer and feedback after evaluation


## Data Models

### Database Schema Extension

#### User_State.currentTest (New Field)

```typescript
currentTest: {
  testId: string;              // Format: "test_day{N}_v{version}"
  forDay: number;              // Day number this test belongs to
  generatedAt: string;         // ISO 8601 timestamp
  version: number;             // Starts at 1, increments on "New Test"
  status: "pending" | "submitted" | "evaluated";
  questions: Question[];       // Array of 20 question objects
  userAnswers: Record<string, any>;  // Keyed by questionId
  result: TestEvaluation | null;     // Evaluation result after submission
}
```

### Question Object Schema

```typescript
type Question = {
  questionId: string;          // Unique ID within test (e.g., "q1", "q2")
  type: "mcq" | "multi_correct" | "fill_blank" | "writing";
  difficulty: "easy" | "medium" | "hard";
  topic: string;               // Grammar topic or weak area
  prompt: string;              // Question text
  
  // MCQ fields
  options?: string[];          // 4 options (A, B, C, D)
  correctAnswer?: string;      // Single letter (stripped before sending to frontend)
  
  // Multi-correct fields
  correctAnswers?: string[];   // Array of correct letters (stripped before sending)
  
  // Fill-blank fields
  correctFillBlank?: string;   // Expected answer (stripped before sending)
  
  // Writing fields
  modelAnswer?: string;        // Example answer (stripped before sending)
  criteria?: string[];         // Evaluation criteria
};
```

### Test Evaluation Schema

```typescript
type TestEvaluation = {
  overallScore: number;        // Percentage (0-100)
  passed: boolean;             // True if score >= 70%
  totalQuestions: number;      // Always 20
  correctCount: number;        // Number of correct answers
  
  questionResults: {
    questionId: string;
    correct: boolean;
    userAnswer: any;
    correctAnswer: any;
    feedback: string;          // Explanation of correctness
    partialCredit?: number;    // For writing questions (0-1)
  }[];
  
  overallFeedback: string;     // Summary feedback
  weakTopics: string[];        // Topics to review
  strongTopics: string[];      // Topics mastered
};
```

### Question Distribution Logic

```javascript
function buildQuestionDistribution(state, forDay) {
  const todaysTopic = state.dayContent.grammarFocus;
  const todaysVocab = state.dayContent.vocabAndTracks.wordOfDay;
  
  // Last 4 days' topics
  const recentTopics = [];
  for (let d = forDay - 4; d < forDay; d++) {
    if (d > 0 && state.grammarCoveredByDay[d]) {
      recentTopics.push({
        day: d,
        topic: state.grammarCoveredByDay[d]
      });
    }
  }
  
  // Persistent weak areas
  const weakAreas = state.weakAreas || [];
  
  return {
    todaysTopic,
    todaysVocabulary: todaysVocab,
    recentTopics,
    persistentWeakAreas: weakAreas,
    
    // Distribution requirements
    questionDistribution: {
      mcq: 8,
      multiCorrect: 4,
      fillBlank: 5,
      writing: 3
    },
    
    topicDistribution: {
      todaysTopic: 8,      // 8 questions from today
      recentTopics: 8,     // 2 questions per day from last 4 days
      weakAreas: 4         // 4 questions from weak areas
    },
    
    difficultyDistribution: {
      easy: 7,
      medium: 9,
      hard: 4
    }
  };
}
```


## Gemini Integration

### Test Generation Prompt Structure

Following the pattern from `dayGenerator.js`, the test generation prompt includes:

```javascript
const userPrompt = {
  task: "Generate a cumulative English test",
  forDay: forDay,
  userId: userId,
  
  context: {
    todaysTopic: "Present Perfect Tense",
    todaysVocabulary: [...],
    recentTopics: [
      { day: 3, topic: "Past Simple" },
      { day: 4, topic: "Prepositions" },
      { day: 5, topic: "Articles" },
      { day: 6, topic: "Modal Verbs" }
    ],
    persistentWeakAreas: ["Article usage", "Verb tense consistency"],
    learnerLevel: "Beginner" // Based on day number
  },
  
  requirements: {
    totalQuestions: 20,
    questionTypes: {
      mcq: 8,              // Multiple choice (single correct)
      multiCorrect: 4,     // Multiple choice (2 correct out of 4)
      fillBlank: 5,        // Fill in the blank
      writing: 3           // Short writing (2-3 sentences)
    },
    topicDistribution: {
      todaysTopic: 8,
      recentTopics: 8,     // 2 per day from last 4 days
      weakAreas: 4
    },
    difficultyDistribution: {
      easy: 7,
      medium: 9,
      hard: 4
    }
  },
  
  outputSchema: {
    // JSON schema for response validation
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: { /* question schema */ },
        minItems: 20,
        maxItems: 20
      }
    }
  },
  
  instructions: [
    "Generate exactly 20 unique questions",
    "Each question must have a unique questionId (q1-q20)",
    "MCQ questions must have exactly 4 options (A, B, C, D)",
    "Multi-correct questions must have exactly 2 correct answers",
    "Fill-blank questions should test grammar understanding",
    "Writing questions should require 2-3 sentences",
    "Distribute topics and difficulty as specified",
    "Include correct answers for all questions"
  ]
};
```

### Test Evaluation Prompt Structure

Following the pattern from `evaluationService.js`:

```javascript
const evaluationPrompt = {
  task: "Strictly evaluate a cumulative test submission",
  
  test: {
    questions: test.questions,  // All 20 questions with correct answers
    forDay: test.forDay,
    version: test.version
  },
  
  userAnswers: test.userAnswers,  // User's submitted answers
  
  evaluationRules: {
    mcq: "Exact letter match (case-insensitive)",
    multiCorrect: "ALL correct options selected AND no wrong options",
    fillBlank: "Grammatically and semantically correct, allow minor spelling variations",
    writing: "Strict but not pedantic, evaluate against modelAnswer and criteria",
    passThreshold: 70,  // 14 out of 20 questions
    partialCredit: "Only for writing questions (0-1 scale)"
  },
  
  outputExpectations: {
    overallScore: "Percentage (0-100)",
    passed: "Boolean based on 70% threshold",
    questionResults: "Array of 20 results with feedback",
    overallFeedback: "2-3 sentences summarizing performance",
    weakTopics: "Array of topics to review",
    strongTopics: "Array of topics mastered"
  },
  
  strictInstructions: [
    "Evaluate all 20 questions",
    "Provide specific feedback for each question",
    "Be strict but fair",
    "Identify patterns in mistakes",
    "Suggest specific topics to review"
  ]
};
```

### Normalization Strategy

Both test generation and evaluation responses are normalized using the same pattern as `dayNormalize.js` and `normalizeEvaluationShape()`:

```javascript
function normalizeTestContent(raw, { forDay, version }) {
  // Handle various Gemini response shapes
  const questions = extractQuestions(raw);
  
  // Ensure exactly 20 questions
  if (questions.length !== 20) {
    throw new Error(`Expected 20 questions, got ${questions.length}`);
  }
  
  // Normalize each question
  return questions.map((q, i) => ({
    questionId: q.questionId || `q${i + 1}`,
    type: normalizeQuestionType(q.type),
    difficulty: normalizeDifficulty(q.difficulty),
    topic: String(q.topic || "General"),
    prompt: String(q.prompt || q.question || ""),
    
    // Type-specific fields
    ...(q.type === "mcq" && {
      options: ensureArray(q.options, 4),
      correctAnswer: String(q.correctAnswer || "A").toUpperCase()
    }),
    
    ...(q.type === "multi_correct" && {
      options: ensureArray(q.options, 4),
      correctAnswers: ensureArray(q.correctAnswers, 2).map(a => String(a).toUpperCase())
    }),
    
    ...(q.type === "fill_blank" && {
      correctFillBlank: String(q.correctFillBlank || q.answer || "")
    }),
    
    ...(q.type === "writing" && {
      modelAnswer: String(q.modelAnswer || ""),
      criteria: ensureArray(q.criteria, 3)
    })
  }));
}

function normalizeTestEvaluation(raw) {
  // Handle various Gemini response shapes
  const results = extractQuestionResults(raw);
  
  // Ensure exactly 20 results
  if (results.length !== 20) {
    throw new Error(`Expected 20 results, got ${results.length}`);
  }
  
  const correctCount = results.filter(r => r.correct).length;
  const overallScore = Math.round((correctCount / 20) * 100);
  
  return {
    overallScore,
    passed: overallScore >= 70,
    totalQuestions: 20,
    correctCount,
    questionResults: results.map(r => ({
      questionId: r.questionId,
      correct: Boolean(r.correct),
      userAnswer: r.userAnswer,
      correctAnswer: r.correctAnswer,
      feedback: String(r.feedback || ""),
      partialCredit: r.partialCredit ? Number(r.partialCredit) : undefined
    })),
    overallFeedback: String(raw.overallFeedback || ""),
    weakTopics: ensureArray(raw.weakTopics || []),
    strongTopics: ensureArray(raw.strongTopics || [])
  };
}
```


## Frontend Component Structure

### TestRoute Component Structure

```typescript
// client/src/components/TestRoute.tsx

export function TestRoute() {
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<TestEvaluation | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Load test on mount
  useEffect(() => {
    loadTest();
  }, []);
  
  async function loadTest() {
    const res = await fetch('/api/test', { headers: authHeaders() });
    const data = await res.json();
    
    if (data.status === "no_test") {
      // Generate new test
      await generateTest();
    } else {
      setTest(data.test);
      setAnswers(data.test.userAnswers || {});
      if (data.test.status === "evaluated") {
        setEvaluation(data.test.result);
      }
    }
    setLoading(false);
  }
  
  async function generateTest() {
    const res = await fetch('/api/test/generate', { 
      method: 'POST', 
      headers: authHeaders() 
    });
    const data = await res.json();
    setTest(data.test);
  }
  
  async function handleAnswerChange(questionId: string, answer: any) {
    // Update local state
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    // Auto-save to backend
    try {
      await fetch('/api/test/answer', {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ questionId, answer })
      });
    } catch (error) {
      // Show warning toast but don't block interaction
      console.warn('Auto-save failed:', error);
    }
  }
  
  function validateSubmission() {
    const errors: Record<string, string> = {};
    
    test?.questions.forEach(q => {
      const answer = answers[q.questionId];
      
      if (!answer) {
        errors[q.questionId] = "Answer required";
      } else if (q.type === "writing" && String(answer).trim().length < 10) {
        errors[q.questionId] = "Writing answer must be at least 10 characters";
      } else if (q.type === "multi_correct" && (!Array.isArray(answer) || answer.length === 0)) {
        errors[q.questionId] = "Select at least one option";
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }
  
  async function handleSubmit() {
    if (!validateSubmission()) {
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      
      setEvaluation(data.evaluation);
      setTest(data.test);
    } catch (error) {
      console.error('Submit failed:', error);
    } finally {
      setSubmitting(false);
    }
  }
  
  async function handleRetake() {
    const res = await fetch('/api/test/retake', {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    
    setTest(data.test);
    setAnswers({});
    setEvaluation(null);
    setValidationErrors({});
  }
  
  async function handleNewTest() {
    const res = await fetch('/api/test/new', {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    
    setTest(data.test);
    setAnswers({});
    setEvaluation(null);
    setValidationErrors({});
  }
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!test) {
    return <div>No test available</div>;
  }
  
  return (
    <div className="test-container">
      {/* Progress Indicator */}
      <TestProgress 
        total={20} 
        answered={Object.keys(answers).length} 
      />
      
      {/* Timer (non-blocking) */}
      <Timer startTime={test.generatedAt} />
      
      {/* Questions */}
      {test.questions.map(question => (
        <QuestionRenderer
          key={question.questionId}
          question={question}
          answer={answers[question.questionId]}
          onAnswerChange={handleAnswerChange}
          error={validationErrors[question.questionId]}
          evaluation={evaluation?.questionResults.find(r => r.questionId === question.questionId)}
          disabled={evaluation !== null}
        />
      ))}
      
      {/* Actions */}
      {!evaluation && (
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length < 20}
          className="submit-button"
        >
          {submitting ? "Submitting..." : "Submit Test"}
        </button>
      )}
      
      {evaluation && (
        <div className="evaluation-results">
          <TestEvaluationDisplay evaluation={evaluation} />
          
          <div className="actions">
            <button onClick={handleRetake}>Retake Test</button>
            <button onClick={handleNewTest}>New Test</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Question Renderer Component

```typescript
// client/src/components/test/QuestionRenderer.tsx

export function QuestionRenderer({ 
  question, 
  answer, 
  onAnswerChange, 
  error, 
  evaluation, 
  disabled 
}: QuestionRendererProps) {
  switch (question.type) {
    case "mcq":
      return (
        <MCQQuestion
          question={question}
          answer={answer}
          onChange={onAnswerChange}
          error={error}
          evaluation={evaluation}
          disabled={disabled}
        />
      );
    
    case "multi_correct":
      return (
        <MultiCorrectQuestion
          question={question}
          answer={answer}
          onChange={onAnswerChange}
          error={error}
          evaluation={evaluation}
          disabled={disabled}
        />
      );
    
    case "fill_blank":
      return (
        <FillBlankQuestion
          question={question}
          answer={answer}
          onChange={onAnswerChange}
          error={error}
          evaluation={evaluation}
          disabled={disabled}
        />
      );
    
    case "writing":
      return (
        <WritingQuestion
          question={question}
          answer={answer}
          onChange={onAnswerChange}
          error={error}
          evaluation={evaluation}
          disabled={disabled}
        />
      );
    
    default:
      return null;
  }
}
```


## State Management and Data Flow

### State Persistence Strategy

Following the existing `stateStore.js` pattern:

```javascript
// State is persisted to MongoDB (or file-based fallback)
// Every API call that modifies currentTest calls stateStore.save()

// Example flow:
async function handleTestAnswer(userId, questionId, answer) {
  const state = await stateStore.getOrCreate(userId);
  
  // Modify state
  state.currentTest.userAnswers[questionId] = answer;
  
  // Persist immediately
  await stateStore.save(userId, state);
  
  return { ok: true };
}
```

### Test Lifecycle State Machine

```
┌─────────────┐
│   no_test   │ ← Initial state (no currentTest or forDay mismatch)
└──────┬──────┘
       │ POST /api/test/generate
       ▼
┌─────────────┐
│   pending   │ ← Test generated, user answering questions
└──────┬──────┘
       │ POST /api/test/submit
       ▼
┌─────────────┐
│  evaluated  │ ← Test evaluated, results available
└──────┬──────┘
       │
       ├─ POST /api/test/retake → pending (same questions)
       │
       └─ POST /api/test/new → pending (new questions, version++)
```

### Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    User Actions                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  Frontend State                               │
│  - test: Test | null                                          │
│  - answers: Record<string, any>                               │
│  - evaluation: TestEvaluation | null                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  Backend Routes                               │
│  GET /api/test                                                │
│  POST /api/test/generate                                      │
│  PATCH /api/test/answer                                       │
│  POST /api/test/submit                                        │
│  POST /api/test/retake                                        │
│  POST /api/test/new                                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              Business Logic Modules                           │
│  - testGenerator.js (generateTestGemini)                      │
│  - testEvaluator.js (evaluateTestGemini)                      │
│  - geminiClient.js (callGeminiJsonWithFallback)               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  State Persistence                            │
│  - stateStore.js (getOrCreate, save)                          │
│  - MongoDB (User_State.currentTest)                           │
└──────────────────────────────────────────────────────────────┘
```

### Auto-Save Implementation

```typescript
// Frontend: Debounced auto-save
const debouncedSave = useMemo(
  () => debounce(async (questionId: string, answer: any) => {
    try {
      await fetch('/api/test/answer', {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ questionId, answer })
      });
    } catch (error) {
      // Show warning toast but don't block
      showToast('warning', 'Auto-save failed. Your answer is saved locally.');
    }
  }, 500),
  []
);

function handleAnswerChange(questionId: string, answer: any) {
  // Update local state immediately
  setAnswers(prev => ({ ...prev, [questionId]: answer }));
  
  // Trigger debounced save
  debouncedSave(questionId, answer);
}
```

### Page Reload Behavior

```typescript
// On page reload, test state is restored from backend
useEffect(() => {
  async function loadTest() {
    const res = await fetch('/api/test', { headers: authHeaders() });
    const data = await res.json();
    
    if (data.test) {
      setTest(data.test);
      setAnswers(data.test.userAnswers || {});
      
      if (data.test.status === "evaluated") {
        setEvaluation(data.test.result);
      }
    }
  }
  
  loadTest();
}, []);
```


## Security Measures

### Answer Stripping Strategy

Following the principle of "never send correct answers to frontend until evaluation is complete":

```javascript
function stripCorrectAnswers(test) {
  if (test.status === "evaluated") {
    // After evaluation, include correct answers for display
    return test;
  }
  
  // Before evaluation, strip all correct answers
  return {
    ...test,
    questions: test.questions.map(q => {
      const stripped = { ...q };
      
      // Remove correct answer fields based on question type
      delete stripped.correctAnswer;
      delete stripped.correctAnswers;
      delete stripped.correctFillBlank;
      delete stripped.modelAnswer;
      
      return stripped;
    })
  };
}

// Applied in all GET /api/test responses
app.get("/api/test", authRequired, async (req, res) => {
  const state = await stateStore.getOrCreate(req.userId);
  const test = stripCorrectAnswers(state.currentTest);
  return res.json({ ok: true, test });
});
```

### Backend Validation

```javascript
function validateTestSubmission(test) {
  const errors = [];
  
  // Validate all questions answered
  test.questions.forEach(q => {
    const answer = test.userAnswers[q.questionId];
    
    if (answer === undefined || answer === null) {
      errors.push({
        questionId: q.questionId,
        message: "Answer required"
      });
    }
    
    // Type-specific validation
    if (q.type === "writing") {
      if (String(answer).trim().length < 10) {
        errors.push({
          questionId: q.questionId,
          message: "Writing answer must be at least 10 characters"
        });
      }
    }
    
    if (q.type === "multi_correct") {
      if (!Array.isArray(answer) || answer.length === 0) {
        errors.push({
          questionId: q.questionId,
          message: "Select at least one option"
        });
      }
    }
  });
  
  return {
    ok: errors.length === 0,
    message: errors.length > 0 ? "Incomplete submission" : "Valid",
    details: errors
  };
}
```

### Authentication Middleware

All test routes use the existing `authRequired` middleware:

```javascript
// All test routes are protected
app.get("/api/test", authRequired, ...);
app.post("/api/test/generate", authRequired, ...);
app.patch("/api/test/answer", authRequired, ...);
app.post("/api/test/submit", authRequired, ...);
app.post("/api/test/retake", authRequired, ...);
app.post("/api/test/new", authRequired, ...);
```

### Eligibility Verification

```javascript
// Only users who passed today's evaluation can generate tests
app.post("/api/test/generate", authRequired, async (req, res) => {
  const state = await stateStore.getOrCreate(req.userId);
  
  // Check if user passed today's evaluation
  if (!state.lastEvaluation || state.lastEvaluation.overallPercent < 76) {
    return res.status(403).json({
      ok: false,
      reject: { 
        message: "Complete daily evaluation with score ≥76% to access cumulative test" 
      }
    });
  }
  
  // Proceed with test generation
  // ...
});
```

### Data Integrity Checks

```javascript
// Prevent tampering with test data
app.patch("/api/test/answer", authRequired, async (req, res) => {
  const { questionId, answer } = req.body;
  const state = await stateStore.getOrCreate(req.userId);
  
  // Verify test exists and is in correct state
  if (!state.currentTest) {
    return res.status(400).json({
      ok: false,
      reject: { message: "No active test" }
    });
  }
  
  if (state.currentTest.status !== "pending") {
    return res.status(400).json({
      ok: false,
      reject: { message: "Cannot modify answers after submission" }
    });
  }
  
  // Verify questionId exists in test
  const questionExists = state.currentTest.questions.some(
    q => q.questionId === questionId
  );
  
  if (!questionExists) {
    return res.status(400).json({
      ok: false,
      reject: { message: "Invalid question ID" }
    });
  }
  
  // Update answer
  state.currentTest.userAnswers[questionId] = answer;
  await stateStore.save(req.userId, state);
  
  return res.json({ ok: true });
});
```


## Error Handling and Retry Logic

### Gemini API Error Handling

Following the pattern from `geminiClient.js` and `dayGenerator.js`:

```javascript
async function generateTestGemini({ state, forDay, userId, version = 1 }) {
  const maxAttempts = 2;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Test generation attempt ${attempt}/${maxAttempts}`);
      
      const prompt = buildTestPrompt({ state, forDay, version });
      
      const rawJson = await callGeminiJsonWithFallback({
        systemPrompt: SYSTEM_TRAINER_PROMPT,
        userPrompt: JSON.stringify(prompt, null, 2),
        timeoutMs: 120000
      });
      
      const parsed = JSON.parse(rawJson);
      const normalized = normalizeTestContent(parsed, { forDay, version });
      
      // Validate question count
      if (normalized.questions.length !== 20) {
        throw new Error(
          `Expected 20 questions, got ${normalized.questions.length}`
        );
      }
      
      console.log(`✓ Test generated successfully`);
      return { questions: normalized.questions, version };
      
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠ Attempt ${attempt} failed: ${msg}`);
      
      // Check for quota/rate limit errors
      if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
        if (attempt < maxAttempts) {
          const waitTime = 1500 * attempt;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
  }
  
  throw new Error(
    `Test generation failed after ${maxAttempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
```

### Auto-Save Error Handling

```typescript
// Frontend: Graceful degradation for auto-save failures
async function handleAnswerChange(questionId: string, answer: any) {
  // Update local state immediately (optimistic update)
  setAnswers(prev => ({ ...prev, [questionId]: answer }));
  
  // Attempt auto-save
  try {
    await fetch('/api/test/answer', {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ questionId, answer })
    });
  } catch (error) {
    // Show warning but don't block user
    showToast('warning', 'Auto-save failed. Your answer is saved locally.');
    
    // Mark answer as pending sync
    setPendingSyncAnswers(prev => ({ ...prev, [questionId]: answer }));
  }
}

// Retry pending syncs on next successful save
async function retryPendingSyncs() {
  const pending = Object.entries(pendingSyncAnswers);
  
  for (const [questionId, answer] of pending) {
    try {
      await fetch('/api/test/answer', {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ questionId, answer })
      });
      
      // Remove from pending on success
      setPendingSyncAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch (error) {
      // Keep in pending, will retry later
      console.warn(`Retry failed for ${questionId}:`, error);
    }
  }
}
```

### Submission Error Handling

```typescript
// Frontend: Comprehensive submission error handling
async function handleSubmit() {
  // Validate locally first
  if (!validateSubmission()) {
    showToast('error', 'Please answer all questions before submitting');
    return;
  }
  
  // Retry pending syncs before submission
  await retryPendingSyncs();
  
  if (Object.keys(pendingSyncAnswers).length > 0) {
    showToast('error', 'Some answers failed to save. Please check your connection.');
    return;
  }
  
  setSubmitting(true);
  
  try {
    const res = await fetch('/api/test/submit', {
      method: 'POST',
      headers: authHeaders()
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data?.reject?.message || 'Submission failed');
    }
    
    const data = await res.json();
    setEvaluation(data.evaluation);
    setTest(data.test);
    
    showToast('success', 'Test submitted successfully!');
    
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Submission failed';
    
    // Check for specific error types
    if (msg.includes('quota') || msg.includes('429')) {
      showToast('error', 'AI evaluation service is temporarily unavailable. Please try again in a few minutes.');
    } else if (msg.includes('timeout')) {
      showToast('error', 'Evaluation is taking longer than expected. Please try again.');
    } else {
      showToast('error', msg);
    }
    
  } finally {
    setSubmitting(false);
  }
}
```

### Backend Error Responses

```javascript
// Consistent error response format
function sendError(res, statusCode, message, details = null) {
  return res.status(statusCode).json({
    ok: false,
    reject: {
      message,
      ...(details && { details })
    }
  });
}

// Usage in routes
app.post("/api/test/submit", authRequired, async (req, res) => {
  try {
    const state = await stateStore.getOrCreate(req.userId);
    
    if (!state.currentTest) {
      return sendError(res, 400, "No active test");
    }
    
    const validation = validateTestSubmission(state.currentTest);
    if (!validation.ok) {
      return sendError(res, 400, validation.message, validation.details);
    }
    
    const evaluation = await evaluateTestGemini({
      test: state.currentTest,
      userAnswers: state.currentTest.userAnswers,
      state
    });
    
    state.currentTest.status = "evaluated";
    state.currentTest.result = evaluation;
    await stateStore.save(req.userId, state);
    
    return res.json({ ok: true, evaluation, test: state.currentTest });
    
  } catch (error) {
    console.error('Test submission error:', error);
    
    const msg = error instanceof Error ? error.message : 'Submission failed';
    
    // Check for specific error types
    if (msg.includes('quota') || msg.includes('429')) {
      return sendError(res, 503, 'AI evaluation service temporarily unavailable');
    } else if (msg.includes('timeout')) {
      return sendError(res, 504, 'Evaluation timeout - please try again');
    } else {
      return sendError(res, 500, 'Evaluation failed - please retry');
    }
  }
});
```


## Testing Strategy

### Unit Tests

**Backend Unit Tests**:

```javascript
// server/src/trainer/__tests__/testGenerator.test.js

describe('testGenerator', () => {
  test('generates exactly 20 questions', async () => {
    const state = mockState();
    const result = await generateTestGemini({ state, forDay: 5, userId: 'test' });
    expect(result.questions).toHaveLength(20);
  });
  
  test('distributes question types correctly', async () => {
    const state = mockState();
    const result = await generateTestGemini({ state, forDay: 5, userId: 'test' });
    
    const types = result.questions.map(q => q.type);
    expect(types.filter(t => t === 'mcq')).toHaveLength(8);
    expect(types.filter(t => t === 'multi_correct')).toHaveLength(4);
    expect(types.filter(t => t === 'fill_blank')).toHaveLength(5);
    expect(types.filter(t => t === 'writing')).toHaveLength(3);
  });
  
  test('strips correct answers before sending to frontend', () => {
    const test = mockTest();
    const stripped = stripCorrectAnswers(test);
    
    stripped.questions.forEach(q => {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.correctAnswers).toBeUndefined();
      expect(q.correctFillBlank).toBeUndefined();
      expect(q.modelAnswer).toBeUndefined();
    });
  });
  
  test('includes correct answers after evaluation', () => {
    const test = mockTest({ status: 'evaluated' });
    const result = stripCorrectAnswers(test);
    
    // Should NOT strip when evaluated
    expect(result.questions[0].correctAnswer).toBeDefined();
  });
});

// server/src/trainer/__tests__/testEvaluator.test.js

describe('testEvaluator', () => {
  test('evaluates MCQ correctly', async () => {
    const test = mockTest();
    const userAnswers = { q1: 'A', q2: 'B' };
    
    const evaluation = await evaluateTestGemini({ test, userAnswers, state: mockState() });
    
    expect(evaluation.questionResults).toHaveLength(20);
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(0);
    expect(evaluation.overallScore).toBeLessThanOrEqual(100);
  });
  
  test('applies 70% pass threshold', async () => {
    const test = mockTest();
    const userAnswers = mockAnswers({ correctCount: 14 });
    
    const evaluation = await evaluateTestGemini({ test, userAnswers, state: mockState() });
    
    expect(evaluation.passed).toBe(true);
    expect(evaluation.overallScore).toBeGreaterThanOrEqual(70);
  });
  
  test('fails when score < 70%', async () => {
    const test = mockTest();
    const userAnswers = mockAnswers({ correctCount: 13 });
    
    const evaluation = await evaluateTestGemini({ test, userAnswers, state: mockState() });
    
    expect(evaluation.passed).toBe(false);
    expect(evaluation.overallScore).toBeLessThan(70);
  });
});
```

**Frontend Unit Tests**:

```typescript
// client/src/components/test/__tests__/TestRoute.test.tsx

describe('TestRoute', () => {
  test('loads test on mount', async () => {
    const { getByText } = render(<TestRoute />);
    
    await waitFor(() => {
      expect(getByText(/Question 1/i)).toBeInTheDocument();
    });
  });
  
  test('auto-saves answers', async () => {
    const { getByLabelText } = render(<TestRoute />);
    
    const input = getByLabelText(/Question 1/i);
    fireEvent.change(input, { target: { value: 'Test answer' } });
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/test/answer', expect.any(Object));
    });
  });
  
  test('validates submission', async () => {
    const { getByText } = render(<TestRoute />);
    
    const submitButton = getByText(/Submit Test/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(getByText(/Answer required/i)).toBeInTheDocument();
    });
  });
  
  test('displays evaluation results', async () => {
    const { getByText } = render(<TestRoute />);
    
    // Submit test
    const submitButton = getByText(/Submit Test/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(getByText(/Your Score/i)).toBeInTheDocument();
    });
  });
});
```

### Property-Based Tests

**Property 1: Test generation round trip**

*For any* valid user state, generating a test then normalizing should produce exactly 20 valid questions with all required fields.

**Validates: Requirements 2.1, 3.1, 3.5**

**Property 2: Answer persistence**

*For any* test and any answer, saving an answer then retrieving the test should return the same answer.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

**Property 3: Security stripping**

*For any* test with status "pending", stripping correct answers should remove all correctAnswer, correctAnswers, correctFillBlank, and modelAnswer fields.

**Validates: Requirements 10.1, 10.2, 10.3**

**Property 4: Evaluation consistency**

*For any* test with the same user answers, evaluating twice should produce the same correctness results (scores may vary slightly due to AI, but correctness should be consistent).

**Validates: Requirements 8.2, 8.3, 8.4, 8.5**

**Property 5: Validation completeness**

*For any* test submission, if validation passes, all 20 questions must have non-empty answers.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Integration Tests

```javascript
// server/__tests__/integration/test-flow.test.js

describe('Test Flow Integration', () => {
  test('complete test lifecycle', async () => {
    // 1. User passes daily evaluation
    const userId = 'test-user';
    await completeEvaluation(userId, 80); // 80% score
    
    // 2. Generate test
    const generateRes = await request(app)
      .post('/api/test/generate')
      .set('Authorization', `Bearer ${getToken(userId)}`);
    
    expect(generateRes.status).toBe(200);
    expect(generateRes.body.test.questions).toHaveLength(20);
    
    // 3. Answer questions
    for (let i = 1; i <= 20; i++) {
      await request(app)
        .patch('/api/test/answer')
        .set('Authorization', `Bearer ${getToken(userId)}`)
        .send({ questionId: `q${i}`, answer: 'A' });
    }
    
    // 4. Submit test
    const submitRes = await request(app)
      .post('/api/test/submit')
      .set('Authorization', `Bearer ${getToken(userId)}`);
    
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.evaluation).toBeDefined();
    expect(submitRes.body.evaluation.overallScore).toBeGreaterThanOrEqual(0);
    
    // 5. Retake test
    const retakeRes = await request(app)
      .post('/api/test/retake')
      .set('Authorization', `Bearer ${getToken(userId)}`);
    
    expect(retakeRes.status).toBe(200);
    expect(retakeRes.body.test.status).toBe('pending');
    expect(retakeRes.body.test.userAnswers).toEqual({});
  });
});
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Test generation produces exactly 20 valid questions

*For any* valid user state and day number, generating a test should produce exactly 20 questions, each with a unique questionId and all required metadata fields (type, difficulty, topic, prompt, and type-specific answer fields).

**Validates: Requirements 2.1, 3.1, 3.4, 3.5, 4.3**

### Property 2: Question distribution matches specification

*For any* generated test, the question type distribution should be exactly 8 MCQ, 4 multi-correct, 5 fill-blank, and 3 writing questions.

**Validates: Requirements 3.1**

### Property 3: Test persistence round-trip

*For any* valid test object, serializing to JSON then deserializing should produce an equivalent test with the same questions, answers, and metadata.

**Validates: Requirements 13.1, 13.2, 13.3, 13.5**

### Property 4: Answer auto-save persistence

*For any* test and any answer, saving an answer via PATCH /api/test/answer then retrieving the test via GET /api/test should return the same answer in userAnswers.

**Validates: Requirements 6.5, 6.6**

### Property 5: Security stripping for pending tests

*For any* test with status "pending", calling stripCorrectAnswers() should remove all correctAnswer, correctAnswers, correctFillBlank, and modelAnswer fields from all questions.

**Validates: Requirements 5.6, 10.1, 10.2, 10.3**

### Property 6: Correct answers included after evaluation

*For any* test with status "evaluated", the API response should include all correct answer fields (correctAnswer, correctAnswers, correctFillBlank, modelAnswer) for all questions.

**Validates: Requirements 5.7, 10.4**

### Property 7: Test validity check

*For any* GET /api/test request, the system should only serve a test if currentTest exists AND currentTest.forDay equals currentDay.

**Validates: Requirements 1.3, 5.2, 12.1**

### Property 8: Version incrementing

*For any* test with version N, clicking "New Test" should generate a new test with version N+1.

**Validates: Requirements 2.4, 9.7, 12.8**

### Property 9: Retake preserves questions

*For any* test, clicking "Retake Test" should reset userAnswers to empty and status to "pending", but keep the exact same questions array unchanged.

**Validates: Requirements 9.2, 9.3, 9.4, 9.5**

### Property 10: Submission validation completeness

*For any* test submission, if validation passes, all 20 questions must have non-empty answers, writing answers must have ≥10 characters, and multi-correct answers must have ≥1 option selected.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 11: Backend validation rejects invalid submissions

*For any* test submission with incomplete answers, the backend should return a 400 error with detailed validation errors listing which questions are incomplete.

**Validates: Requirements 7.6, 11.7, 11.8**

### Property 12: MCQ evaluation by exact match

*For any* MCQ question, if the user answer matches the correct answer (case-insensitive), the evaluation should mark it as correct; otherwise incorrect.

**Validates: Requirements 8.2**

### Property 13: Multi-correct evaluation requires exact match

*For any* multi-correct question, the evaluation should mark it correct only if ALL correct options are selected AND no incorrect options are selected.

**Validates: Requirements 8.3**

### Property 14: Overall score calculation

*For any* test evaluation, the overall score should equal (number of correct answers / 20) × 100, rounded to the nearest integer.

**Validates: Requirements 8.6**

### Property 15: Pass threshold at 70%

*For any* test evaluation, the passed field should be true if and only if the overall score is ≥ 70%.

**Validates: Requirements 8.7**

### Property 16: Evaluation updates test status

*For any* successful test evaluation, the test status should be updated to "evaluated" and the result should be stored in currentTest.result.

**Validates: Requirements 8.9, 8.10**

### Property 17: New test authorization

*For any* POST /api/test/new request, the system should reject the request if the current test status is not "evaluated".

**Validates: Requirements 9.6, 12.5**

### Property 18: One test per day per user

*For any* user on any given day, only one test should exist where currentTest.forDay equals currentDay.

**Validates: Requirements 12.3**

### Property 19: Test invalidation on day advance

*For any* user, when currentDay advances from N to N+1, any test with forDay = N should no longer be served by GET /api/test.

**Validates: Requirements 12.4**

### Property 20: Error recovery preserves data

*For any* test, if submission or evaluation fails, the test data (questions and userAnswers) should remain unchanged in the database.

**Validates: Requirements 14.4, 14.5, 14.7**

### Property 21: Authentication required for all test routes

*For any* test-related API endpoint (GET /api/test, POST /api/test/generate, PATCH /api/test/answer, POST /api/test/submit, POST /api/test/retake, POST /api/test/new), requests without valid authentication should return 401 Unauthorized.

**Validates: Requirements 10.7**

### Property 22: ISO 8601 timestamp format

*For any* generated test, the generatedAt field should be a valid ISO 8601 timestamp string.

**Validates: Requirements 2.5**

### Property 23: Evaluation includes per-question feedback

*For any* test evaluation, the questionResults array should have exactly 20 entries, each with questionId, correct, userAnswer, correctAnswer, and feedback fields.

**Validates: Requirements 8.8**


## Implementation Roadmap

### Phase 1: Backend Foundation (Days 1-2)

1. **Database Schema**
   - Add `currentTest` field to User_State schema
   - Update `stateStore.js` to handle new field
   - Test persistence with mock data

2. **Test Generator Module**
   - Create `server/src/trainer/testGenerator.js`
   - Implement `generateTestGemini()` following `dayGenerator.js` pattern
   - Implement `normalizeTestContent()` following `dayNormalize.js` pattern
   - Implement `buildQuestionDistribution()` logic
   - Add unit tests for generation and normalization

3. **Test Evaluator Module**
   - Create `server/src/trainer/testEvaluator.js`
   - Implement `evaluateTestGemini()` following `evaluationService.js` pattern
   - Implement `normalizeTestEvaluation()` following `normalizeEvaluationShape()` pattern
   - Add unit tests for evaluation logic

### Phase 2: API Routes (Days 3-4)

1. **Core Routes**
   - Implement GET /api/test
   - Implement POST /api/test/generate
   - Implement PATCH /api/test/answer
   - Implement POST /api/test/submit
   - Add authentication middleware to all routes
   - Add validation logic

2. **Action Routes**
   - Implement POST /api/test/retake
   - Implement POST /api/test/new
   - Add authorization checks

3. **Security**
   - Implement `stripCorrectAnswers()` function
   - Add backend validation for submissions
   - Test security measures

### Phase 3: Frontend Components (Days 5-7)

1. **TestRoute Component**
   - Create `client/src/components/TestRoute.tsx`
   - Implement test loading and state management
   - Implement auto-save with debouncing
   - Add progress indicator and timer

2. **Question Components**
   - Create `client/src/components/test/MCQQuestion.tsx`
   - Create `client/src/components/test/MultiCorrectQuestion.tsx`
   - Create `client/src/components/test/FillBlankQuestion.tsx`
   - Create `client/src/components/test/WritingQuestion.tsx`
   - Create `client/src/components/test/QuestionRenderer.tsx`

3. **Evaluation Display**
   - Create `client/src/components/test/TestEvaluationDisplay.tsx`
   - Implement per-question feedback display
   - Add "Retake" and "New Test" buttons

4. **EvaluationPanel Extension**
   - Add "Take Test" button to `EvaluationPanel.tsx`
   - Implement `window.open('/test', '_blank')` logic

### Phase 4: Integration and Testing (Days 8-9)

1. **Integration Tests**
   - Test complete flow: generate → answer → submit → evaluate
   - Test retake flow
   - Test new test generation flow
   - Test error scenarios

2. **Property-Based Tests**
   - Implement all 23 correctness properties
   - Run tests with 100+ iterations each
   - Fix any discovered issues

3. **Manual Testing**
   - Test in multiple browsers
   - Test page reload scenarios
   - Test network failure scenarios
   - Test concurrent user scenarios

### Phase 5: Polish and Documentation (Day 10)

1. **Error Handling**
   - Improve error messages
   - Add retry logic for transient failures
   - Test graceful degradation

2. **Performance**
   - Optimize auto-save debouncing
   - Add loading states
   - Test with slow network

3. **Documentation**
   - Update API documentation
   - Add inline code comments
   - Create user guide for test feature

## Deployment Considerations

### Environment Variables

```bash
# Existing variables (reused)
GOOGLE_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_VERSION=v1beta
MONGODB_URI=<mongodb-connection-string>

# New variables (optional)
TEST_GENERATION_TIMEOUT_MS=120000
TEST_EVALUATION_TIMEOUT_MS=120000
TEST_MAX_RETRIES=2
```

### Database Migration

No migration required - `currentTest` field is optional and will be created on first test generation.

### Monitoring

Add logging for:
- Test generation requests and duration
- Test evaluation requests and duration
- Auto-save success/failure rates
- Gemini API quota usage
- Error rates by type

### Rollback Plan

If issues arise:
1. Disable "Take Test" button in EvaluationPanel
2. Return 503 from all test routes
3. Existing daily evaluation flow remains unaffected
4. No data loss - tests remain in database

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Test History**
   - Store all test versions in separate collection
   - Allow users to view past test results
   - Show progress over time

2. **Adaptive Difficulty**
   - Adjust question difficulty based on user performance
   - Generate harder tests for high performers
   - Generate easier tests for struggling learners

3. **Timed Tests**
   - Add optional time limits
   - Show countdown timer
   - Auto-submit when time expires

4. **Test Analytics**
   - Track average scores by topic
   - Identify consistently weak areas
   - Generate personalized study recommendations

5. **Offline Support**
   - Cache test questions locally
   - Queue answers for sync when online
   - Show offline indicator

6. **Mobile Optimization**
   - Responsive design for mobile devices
   - Touch-friendly question interfaces
   - Mobile-specific layouts

## Conclusion

This design provides a comprehensive blueprint for implementing the cumulative test system. By following existing architectural patterns from `dayGenerator.js`, `evaluationService.js`, and `stateStore.js`, we ensure consistency with the codebase while adding powerful new assessment capabilities.

The system is designed with security, reliability, and user experience as top priorities. All correct answers are stripped from API responses until evaluation is complete, auto-save ensures no work is lost, and comprehensive error handling provides graceful degradation.

The 23 correctness properties provide a strong foundation for property-based testing, ensuring the system behaves correctly across all valid inputs and edge cases.

