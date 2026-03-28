# Design Document: Learner Context Compression

## Overview

This feature replaces the current unbounded, noisy evaluation data sent to Gemini with a compressed, 5-layer context structure. The current system sends either nothing (Day 1) or the full `lastEvaluation` object (~2000-4000 tokens) containing raw data like 20 sentence corrections, 6 question answers, and raw scores. This creates inefficiency, high token costs, and poor personalization.

The compressed context reduces token usage to ~830 tokens maximum, provides bounded growth as users progress, improves content personalization, and enables AI-to-AI communication about specific learner patterns through a structured mental model rather than raw transcripts.

### Goals

- Reduce token costs from ~2000-4000 tokens to ~830 tokens maximum
- Provide bounded, predictable context growth
- Enable better personalization through structured diagnostic profiles
- Support AI-to-AI communication about learner patterns
- Maintain backward compatibility with existing state files

### Non-Goals

- Changing the evaluation scoring algorithm
- Modifying the UI components
- Altering the submission parsing logic
- Changing the day generation prompt structure (beyond context format)

## Architecture

### System Components

The feature integrates into the existing trainer system with minimal disruption:

```
┌─────────────────────────────────────────────────────────────┐
│                     Evaluation Flow                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  evaluationService.js                                        │
│  - evaluateSubmissionGemini() [existing]                     │
│  - updateStateAfterEvaluation() [modified]                   │
│    └─> calls buildCompressedContext() [NEW]                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  State (state_*.json)                                        │
│  + compressedLearnerContext [NEW FIELD]                     │
│    - learnerIdentity                                         │
│    - curriculumTrajectory                                    │
│    - diagnosticProfile                                       │
│    - vocabularyMemory                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  dayGenerator.js                                             │
│  - generateDayContentGemini() [modified]                     │
│    └─> calls buildTodaysBrief() [NEW]                       │
│    └─> passes compressed context to Gemini                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Evaluation Time**: After Gemini evaluates a submission, `buildCompressedContext()` merges the new evaluation data into the existing compressed context
2. **Storage**: The compressed context is stored in `state.compressedLearnerContext`
3. **Generation Time**: When generating new day content, `buildTodaysBrief()` computes fresh strategic directives from the compressed context
4. **Gemini Call**: The 5-layer context (4 stored + 1 computed) is passed to Gemini instead of raw evaluation data

## Components and Interfaces

### 1. Compressed Context Data Structure

The compressed context consists of 4 stored layers and 1 computed layer:

```typescript
interface CompressedLearnerContext {
  learnerIdentity: LearnerIdentity;
  curriculumTrajectory: CurriculumTrajectory;
  diagnosticProfile: DiagnosticProfile;
  vocabularyMemory: VocabularyMemory;
}

interface LearnerIdentity {
  currentDay: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  streakDays: number;
  totalDaysCompleted: number;
  averageScore: number;
  learningVelocity: "fast" | "steady" | "struggling";
}

interface CurriculumTrajectory {
  topics: Array<{
    dayNumber: number;
    topic: string;
    grammarFocus: string;
    confidenceSignal: "strong" | "medium" | "weak";
  }>;
}

interface DiagnosticProfile {
  persistentWeakAreas: Array<{
    area: string;
    frequency: number;
    firstSeen: number;
    lastSeen: number;
  }>;
  resolvedAreas: Array<{
    area: string;
    resolvedAt: number;
  }>;
  strongAreas: string[];
  recurringMistakePatterns: string[];
}

interface VocabularyMemory {
  totalWordsLearned: number;
  recentWords: string[]; // last 2 days only
  wordsToAvoid: string[]; // last 7 days
}

interface TodaysBrief {
  primaryGoal: string;
  reinforcementGoal: string;
  avoidTopics: string[];
  difficultyTarget: "easier" | "standard" | "challenging";
  sentenceDesignInstruction: string;
  vocabularyInstruction: string;
}
```

### 2. Core Functions

#### buildCompressedContext()

```javascript
/**
 * Builds or updates compressed learner context from evaluation results
 * @param {Object} state - Current user state
 * @param {Object} evaluation - Evaluation result from Gemini
 * @param {Object} dayContent - Day content that was evaluated
 * @returns {Object} Updated compressed context
 */
function buildCompressedContext(state, evaluation, dayContent) {
  // Implementation details in next section
}
```

#### buildTodaysBrief()

```javascript
/**
 * Computes fresh strategic directives for today's lesson generation
 * @param {Object} compressedContext - The 4 stored layers
 * @param {number} dayNumber - Current day number
 * @returns {Object} TodaysBrief object
 */
function buildTodaysBrief(compressedContext, dayNumber) {
  // Implementation details in next section
}
```

#### validateCompressedContext()

```javascript
/**
 * Validates compressed context structure and token budgets
 * @param {Object} context - Compressed context to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateCompressedContext(context) {
  // Implementation details in next section
}
```

### 3. Integration Points

#### evaluationService.js Modifications

**Current behavior**: `updateStateAfterEvaluation()` stores the full evaluation in `state.lastEvaluation`

**New behavior**: 
- Call `buildCompressedContext(state, evaluation, dayContent)` after evaluation
- Store result in `state.compressedLearnerContext`
- Continue storing `state.lastEvaluation` for backward compatibility and debugging

**Required changes**:
- Import `buildCompressedContext` function
- Add call after evaluation validation
- Ensure evaluation includes new fields: `strongAreas` and `recurringMistakePatterns`

#### dayGenerator.js Modifications

**Current behavior**: Passes `state.lastEvaluation` and `state.weakAreas` to Gemini

**New behavior**:
- Check if `state.compressedLearnerContext` exists
- If exists, call `buildTodaysBrief(state.compressedLearnerContext, dayNumber)`
- Pass the 5-layer context to Gemini instead of raw evaluation data
- If null (Day 1), generate beginner content without context

**Required changes**:
- Import `buildTodaysBrief` function
- Modify `generateDayContentGemini()` to use compressed context
- Update user prompt structure to include compressed context

#### prompts.js Modifications

**Current behavior**: No documentation of learner context structure

**New behavior**: Add documentation section explaining the 5-layer compressed context structure and how to interpret each layer

**Required changes**:
- Add "LEARNER CONTEXT STRUCTURE" section to `SYSTEM_TRAINER_PROMPT`
- Document each layer's purpose and interpretation
- Provide guidance on using diagnosticProfile for implicit practice design
- Explain how to use todaysBrief for strategic content decisions

## Data Models

### State Schema Extension

```javascript
// Add to existing state schema
{
  // ... existing fields ...
  compressedLearnerContext: {
    learnerIdentity: {
      currentDay: number,
      level: "Beginner" | "Intermediate" | "Advanced",
      streakDays: number,
      totalDaysCompleted: number,
      averageScore: number,
      learningVelocity: "fast" | "steady" | "struggling"
    },
    curriculumTrajectory: {
      topics: [{
        dayNumber: number,
        topic: string,
        grammarFocus: string,
        confidenceSignal: "strong" | "medium" | "weak"
      }]
    },
    diagnosticProfile: {
      persistentWeakAreas: [{
        area: string,
        frequency: number,
        firstSeen: number,
        lastSeen: number
      }],
      resolvedAreas: [{
        area: string,
        resolvedAt: number
      }],
      strongAreas: string[],
      recurringMistakePatterns: string[]
    },
    vocabularyMemory: {
      totalWordsLearned: number,
      recentWords: string[],
      wordsToAvoid: string[]
    }
  }
}
```

### Evaluation Schema Extension

```javascript
// Add to existing EvaluationSchema
{
  // ... existing fields ...
  strongAreas: string[], // NEW: areas where learner scored >= 80%
  recurringMistakePatterns: string[] // NEW: specific error descriptions
}
```

### Token Budget Allocation

| Layer | Maximum Tokens | Growth Pattern |
|-------|---------------|----------------|
| learnerIdentity | 80 | Fixed |
| curriculumTrajectory | 200 (at Day 30) | Linear with days |
| diagnosticProfile | 300 | Bounded by pruning |
| vocabularyMemory | 100 | Bounded by time windows |
| todaysBrief | 150 | Fixed (computed fresh) |
| **Total** | **830** | **Bounded** |

## Implementation Details

### buildCompressedContext() Algorithm

```javascript
function buildCompressedContext(state, evaluation, dayContent) {
  const existing = state.compressedLearnerContext || null;
  
  // 1. Build/Update Learner Identity
  const learnerIdentity = buildLearnerIdentity(state, evaluation);
  
  // 2. Build/Update Curriculum Trajectory
  const curriculumTrajectory = buildCurriculumTrajectory(
    existing?.curriculumTrajectory,
    dayContent,
    evaluation
  );
  
  // 3. Build/Update Diagnostic Profile
  const diagnosticProfile = buildDiagnosticProfile(
    existing?.diagnosticProfile,
    evaluation,
    dayContent.dayNumber
  );
  
  // 4. Build/Update Vocabulary Memory
  const vocabularyMemory = buildVocabularyMemory(
    existing?.vocabularyMemory,
    dayContent,
    dayContent.dayNumber
  );
  
  return {
    learnerIdentity,
    curriculumTrajectory,
    diagnosticProfile,
    vocabularyMemory
  };
}
```

### buildLearnerIdentity() Algorithm

```javascript
function buildLearnerIdentity(state, evaluation) {
  const currentDay = state.currentDay || 1;
  const level = currentDay <= 30 ? "Beginner" 
              : currentDay <= 70 ? "Intermediate" 
              : "Advanced";
  
  const streakDays = state.tracker?.streak || 0;
  const totalDaysCompleted = state.tracker?.totalDaysCompleted || 0;
  const averageScore = state.tracker?.averageScore || 0;
  
  // Compute learning velocity
  const learningVelocity = averageScore >= 85 ? "fast"
                         : averageScore >= 70 ? "steady"
                         : "struggling";
  
  return {
    currentDay,
    level,
    streakDays,
    totalDaysCompleted,
    averageScore,
    learningVelocity
  };
}
```

### buildCurriculumTrajectory() Algorithm

```javascript
function buildCurriculumTrajectory(existing, dayContent, evaluation) {
  const topics = existing?.topics || [];
  
  // Compute confidence signal from evaluation scores
  const topicScore = evaluation.scoreBreakdown.sentencesPercent;
  const confidenceSignal = topicScore >= 80 ? "strong"
                         : topicScore >= 60 ? "medium"
                         : "weak";
  
  // Add new topic entry
  const newEntry = {
    dayNumber: dayContent.dayNumber,
    topic: dayContent.dayTheme,
    grammarFocus: dayContent.grammarFocus,
    confidenceSignal
  };
  
  topics.push(newEntry);
  
  // Enforce token budget: prune oldest entries if needed
  // Estimate: ~20 tokens per entry, max 200 tokens = ~10 entries
  const maxEntries = 10;
  const prunedTopics = topics.slice(-maxEntries);
  
  return { topics: prunedTopics };
}
```

### buildDiagnosticProfile() Algorithm

```javascript
function buildDiagnosticProfile(existing, evaluation, dayNumber) {
  const persistentWeakAreas = existing?.persistentWeakAreas || [];
  const resolvedAreas = existing?.resolvedAreas || [];
  const strongAreas = evaluation.strongAreas || [];
  const recurringMistakePatterns = evaluation.recurringMistakePatterns || [];
  
  // 1. Merge weak areas with frequency tracking
  const weakAreasMap = new Map();
  
  // Load existing weak areas
  persistentWeakAreas.forEach(item => {
    weakAreasMap.set(item.area, item);
  });
  
  // Process new weak areas from evaluation
  (evaluation.weakAreas || []).forEach(area => {
    if (weakAreasMap.has(area)) {
      const existing = weakAreasMap.get(area);
      weakAreasMap.set(area, {
        ...existing,
        frequency: existing.frequency + 1,
        lastSeen: dayNumber
      });
    } else {
      weakAreasMap.set(area, {
        area,
        frequency: 1,
        firstSeen: dayNumber,
        lastSeen: dayNumber
      });
    }
  });
  
  // 2. Detect resolved areas
  const updatedResolvedAreas = [...resolvedAreas];
  const currentWeakAreaNames = new Set(evaluation.weakAreas || []);
  
  persistentWeakAreas.forEach(item => {
    // If area hasn't appeared in 2+ consecutive evaluations, mark as resolved
    if (!currentWeakAreaNames.has(item.area) && dayNumber - item.lastSeen >= 2) {
      updatedResolvedAreas.push({
        area: item.area,
        resolvedAt: dayNumber
      });
      weakAreasMap.delete(item.area);
    }
  });
  
  // Prune resolved areas to last 5 entries
  const prunedResolvedAreas = updatedResolvedAreas.slice(-5);
  
  // 3. Sort persistent weak areas by frequency (highest first)
  const sortedWeakAreas = Array.from(weakAreasMap.values())
    .sort((a, b) => b.frequency - a.frequency);
  
  // 4. Enforce token budget for diagnostic profile (~300 tokens)
  // Estimate: ~30 tokens per weak area, ~20 per resolved, ~10 per strong, ~15 per pattern
  const maxWeakAreas = 6;
  const maxStrongAreas = 5;
  const maxPatterns = 8;
  
  return {
    persistentWeakAreas: sortedWeakAreas.slice(0, maxWeakAreas),
    resolvedAreas: prunedResolvedAreas,
    strongAreas: strongAreas.slice(0, maxStrongAreas),
    recurringMistakePatterns: recurringMistakePatterns.slice(0, maxPatterns)
  };
}
```

### buildVocabularyMemory() Algorithm

```javascript
function buildVocabularyMemory(existing, dayContent, dayNumber) {
  const totalWordsLearned = (existing?.totalWordsLearned || 0) 
                          + (dayContent.vocabAndTracks?.wordOfDay?.length || 0);
  
  // Extract words from day content
  const newWords = (dayContent.vocabAndTracks?.wordOfDay || [])
    .map(w => w.word);
  
  // Recent words: last 2 days only
  const recentWords = [...(existing?.recentWords || []), ...newWords];
  const prunedRecentWords = recentWords.slice(-20); // ~2 days × 10 words
  
  // Words to avoid: last 7 days
  const wordsToAvoid = [...(existing?.wordsToAvoid || []), ...newWords];
  const prunedWordsToAvoid = wordsToAvoid.slice(-70); // ~7 days × 10 words
  
  return {
    totalWordsLearned,
    recentWords: prunedRecentWords,
    wordsToAvoid: prunedWordsToAvoid
  };
}
```

### buildTodaysBrief() Algorithm

```javascript
function buildTodaysBrief(compressedContext, dayNumber) {
  const { learnerIdentity, curriculumTrajectory, diagnosticProfile, vocabularyMemory } = compressedContext;
  
  // 1. Primary goal: target highest-frequency persistent weak area
  const primaryGoal = diagnosticProfile.persistentWeakAreas.length > 0
    ? `Focus on improving: ${diagnosticProfile.persistentWeakAreas[0].area}`
    : "Build foundational grammar skills";
  
  // 2. Reinforcement goal: target recently resolved area
  const reinforcementGoal = diagnosticProfile.resolvedAreas.length > 0
    ? `Reinforce recently mastered: ${diagnosticProfile.resolvedAreas[diagnosticProfile.resolvedAreas.length - 1].area}`
    : "Continue building confidence";
  
  // 3. Avoid topics: last 3 days
  const avoidTopics = curriculumTrajectory.topics
    .slice(-3)
    .map(t => t.topic);
  
  // 4. Difficulty target based on learning velocity
  const difficultyTarget = learnerIdentity.learningVelocity === "struggling" ? "easier"
                         : learnerIdentity.learningVelocity === "fast" ? "challenging"
                         : "standard";
  
  // 5. Sentence design instruction
  const sentenceDesignInstruction = diagnosticProfile.persistentWeakAreas.length > 0
    ? `Design sentences that implicitly practice: ${diagnosticProfile.persistentWeakAreas.slice(0, 2).map(w => w.area).join(", ")}`
    : "Design sentences appropriate for learner level";
  
  // 6. Vocabulary instruction
  const vocabularyInstruction = vocabularyMemory.wordsToAvoid.length > 0
    ? `Avoid recently used words: ${vocabularyMemory.wordsToAvoid.slice(-10).join(", ")}`
    : "Introduce new vocabulary appropriate for learner level";
  
  return {
    primaryGoal,
    reinforcementGoal,
    avoidTopics,
    difficultyTarget,
    sentenceDesignInstruction,
    vocabularyInstruction
  };
}
```

### validateCompressedContext() Algorithm

```javascript
function validateCompressedContext(context) {
  const errors = [];
  
  // Check required layers
  if (!context.learnerIdentity) errors.push("Missing learnerIdentity layer");
  if (!context.curriculumTrajectory) errors.push("Missing curriculumTrajectory layer");
  if (!context.diagnosticProfile) errors.push("Missing diagnosticProfile layer");
  if (!context.vocabularyMemory) errors.push("Missing vocabularyMemory layer");
  
  // Validate learnerIdentity
  if (context.learnerIdentity) {
    const { learningVelocity, level } = context.learnerIdentity;
    if (!["fast", "steady", "struggling"].includes(learningVelocity)) {
      errors.push(`Invalid learningVelocity: ${learningVelocity}`);
    }
    if (!["Beginner", "Intermediate", "Advanced"].includes(level)) {
      errors.push(`Invalid level: ${level}`);
    }
  }
  
  // Validate token budgets (approximate)
  const estimateTokens = (obj) => JSON.stringify(obj).length / 4;
  
  if (context.learnerIdentity && estimateTokens(context.learnerIdentity) > 100) {
    errors.push("learnerIdentity exceeds token budget");
  }
  if (context.curriculumTrajectory && estimateTokens(context.curriculumTrajectory) > 250) {
    errors.push("curriculumTrajectory exceeds token budget");
  }
  if (context.diagnosticProfile && estimateTokens(context.diagnosticProfile) > 350) {
    errors.push("diagnosticProfile exceeds token budget");
  }
  if (context.vocabularyMemory && estimateTokens(context.vocabularyMemory) > 120) {
    errors.push("vocabularyMemory exceeds token budget");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Compressed Context Structure Completeness

*For any* compressed learner context object, it must contain exactly four sub-layers: learnerIdentity, curriculumTrajectory, diagnosticProfile, and vocabularyMemory.

**Validates: Requirements 1.2, 7.3**

### Property 2: Learner Identity Structure Completeness

*For any* learnerIdentity layer, it must contain all required fields: currentDay, level, streakDays, totalDaysCompleted, averageScore, and learningVelocity.

**Validates: Requirements 2.2**

### Property 3: Level Derivation from Day Number

*For any* currentDay value, the level field must be "Beginner" when currentDay ≤ 30, "Intermediate" when 31 ≤ currentDay ≤ 70, and "Advanced" when currentDay > 70.

**Validates: Requirements 2.3**

### Property 4: Learning Velocity Computation

*For any* averageScore value, the learningVelocity must be "fast" when averageScore ≥ 85, "steady" when 70 ≤ averageScore < 85, and "struggling" when averageScore < 70.

**Validates: Requirements 2.4**

### Property 5: Curriculum Topic Entry Structure

*For any* topic entry in curriculumTrajectory, it must contain exactly four fields: dayNumber, topic, grammarFocus, and confidenceSignal.

**Validates: Requirements 3.2**

### Property 6: Confidence Signal Computation

*For any* topic score value, the confidenceSignal must be "strong" when score ≥ 80, "medium" when 60 ≤ score < 80, and "weak" when score < 60.

**Validates: Requirements 3.3**

### Property 7: Diagnostic Profile Structure Completeness

*For any* diagnosticProfile layer, it must contain exactly four fields: persistentWeakAreas, resolvedAreas, strongAreas, and recurringMistakePatterns.

**Validates: Requirements 4.2**

### Property 8: Weak Area Frequency Tracking

*For any* weak area that appears in multiple evaluations, its frequency count in persistentWeakAreas must equal the number of times it has appeared.

**Validates: Requirements 4.3, 12.1, 12.2**

### Property 9: Resolved Areas Bounded Growth

*For any* resolvedAreas array, its length must not exceed 5 entries.

**Validates: Requirements 4.4, 12.4**

### Property 10: Persistent Weak Areas Sorted by Frequency

*For any* persistentWeakAreas array with multiple entries, the entries must be sorted in descending order by frequency (highest frequency first).

**Validates: Requirements 12.5**

### Property 11: Weak Area Resolution Detection

*For any* persistent weak area that does not appear in the current evaluation and has lastSeen value at least 2 days before the current day, it must be moved to resolvedAreas.

**Validates: Requirements 4.8, 12.3**

### Property 12: Vocabulary Memory Structure Completeness

*For any* vocabularyMemory layer, it must contain exactly three fields: totalWordsLearned, recentWords, and wordsToAvoid.

**Validates: Requirements 5.2**

### Property 13: Recent Words Time Window

*For any* word in the recentWords array, it must have been introduced within the last 2 days.

**Validates: Requirements 5.3**

### Property 14: Words to Avoid Time Window

*For any* word in the wordsToAvoid array, it must have been introduced within the last 7 days.

**Validates: Requirements 5.4**

### Property 15: Total Words Learned Increment

*For any* day with N new vocabulary words, the totalWordsLearned count must increase by exactly N.

**Validates: Requirements 5.5**

### Property 16: Today's Brief Structure Completeness

*For any* todaysBrief object, it must contain exactly six fields: primaryGoal, reinforcementGoal, avoidTopics, difficultyTarget, sentenceDesignInstruction, and vocabularyInstruction.

**Validates: Requirements 6.2, 8.3**

### Property 17: Today's Brief Not Stored in State

*For any* state object, it must not contain a todaysBrief field.

**Validates: Requirements 6.3**

### Property 18: Primary Goal Targets Highest-Frequency Weak Area

*For any* todaysBrief computed from a diagnosticProfile with non-empty persistentWeakAreas, the primaryGoal must reference the weak area with the highest frequency.

**Validates: Requirements 6.4, 8.5**

### Property 19: Reinforcement Goal Targets Recently Resolved Area

*For any* todaysBrief computed from a diagnosticProfile with non-empty resolvedAreas, the reinforcementGoal must reference an area from resolvedAreas.

**Validates: Requirements 6.5, 8.5**

### Property 20: Avoid Topics from Last 3 Days

*For any* todaysBrief computed from a curriculumTrajectory, the avoidTopics array must contain only topics from the last 3 days.

**Validates: Requirements 6.6**

### Property 21: Difficulty Target Based on Learning Velocity

*For any* learningVelocity value, the difficultyTarget must be "easier" when velocity is "struggling", "standard" when "steady", and "challenging" when "fast".

**Validates: Requirements 6.7**

### Property 22: Token Budget Enforcement - Learner Identity

*For any* learnerIdentity layer, its estimated token count must not exceed 80 tokens.

**Validates: Requirements 2.1, 13.1**

### Property 23: Token Budget Enforcement - Curriculum Trajectory

*For any* curriculumTrajectory layer at day 30 or later, its estimated token count must not exceed 200 tokens.

**Validates: Requirements 3.1, 13.2**

### Property 24: Token Budget Enforcement - Diagnostic Profile

*For any* diagnosticProfile layer, its estimated token count must not exceed 300 tokens.

**Validates: Requirements 4.1, 13.3**

### Property 25: Token Budget Enforcement - Vocabulary Memory

*For any* vocabularyMemory layer, its estimated token count must not exceed 100 tokens.

**Validates: Requirements 5.1, 13.4**

### Property 26: Token Budget Enforcement - Today's Brief

*For any* todaysBrief layer, its estimated token count must not exceed 150 tokens.

**Validates: Requirements 6.1, 13.5**

### Property 27: Total Compressed Context Token Budget

*For any* complete compressed context (4 stored layers + todaysBrief), the total estimated token count must not exceed 830 tokens.

**Validates: Requirements 13.7**

### Property 28: Build Compressed Context Returns All Layers

*For any* call to buildCompressedContext with valid state and evaluation, the returned object must contain all four required layers: learnerIdentity, curriculumTrajectory, diagnosticProfile, and vocabularyMemory.

**Validates: Requirements 7.2, 7.3**

### Property 29: Build Compressed Context Enforces Token Limits

*For any* compressed context returned by buildCompressedContext, each layer must be within its respective token budget.

**Validates: Requirements 7.5**

### Property 30: Build Today's Brief Returns Complete Object

*For any* call to buildTodaysBrief with valid compressedContext and dayNumber, the returned object must contain all six required fields.

**Validates: Requirements 8.2, 8.3**

### Property 31: Strong Areas Maximum Length

*For any* strongAreas array in an evaluation, its length must not exceed 5 entries.

**Validates: Requirements 9.3**

### Property 32: Recurring Mistake Patterns Maximum Length

*For any* recurringMistakePatterns array in an evaluation, its length must not exceed 10 entries.

**Validates: Requirements 9.4**

### Property 33: Backward Compatibility - Context Initialization

*For any* state with null or missing compressedLearnerContext, calling buildCompressedContext must successfully initialize the context from existing state fields (lastEvaluation, weakAreas, scoreHistory).

**Validates: Requirements 14.1, 14.2**

### Property 34: Backward Compatibility - Last Evaluation Preserved

*For any* state after evaluation, the lastEvaluation field must still be present and populated.

**Validates: Requirements 14.4**

### Property 35: Validation Checks Required Fields

*For any* compressed context, validation must verify that all required layer fields are present.

**Validates: Requirements 15.2**

### Property 36: Validation Checks Token Budgets

*For any* compressed context, validation must verify that each layer's token count is within its budget.

**Validates: Requirements 15.3**

### Property 37: Validation Checks Learning Velocity Values

*For any* learnerIdentity layer, validation must verify that learningVelocity is one of: "fast", "steady", or "struggling".

**Validates: Requirements 15.5**

### Property 38: Curriculum Trajectory Excludes Evaluation Details

*For any* topic entry in curriculumTrajectory, it must not contain evaluation-specific fields such as sentenceEvaluations, scoreBreakdown, or detailed feedback.

**Validates: Requirements 3.5**

### Property 39: Day Generator Does Not Send Raw Evaluation Data

*For any* prompt generated for Gemini, it must not contain raw evaluation fields like sentenceEvaluations or detailed scoreBreakdown arrays.

**Validates: Requirements 10.5**

## Error Handling

### Context Building Errors

**Scenario**: buildCompressedContext receives invalid or incomplete data

**Handling**:
- Log warning with details of missing/invalid fields
- Attempt to build context with available data
- Use sensible defaults for missing fields
- Never throw exceptions that would block evaluation completion

**Example**:
```javascript
if (!evaluation.weakAreas || !Array.isArray(evaluation.weakAreas)) {
  console.warn("Evaluation missing weakAreas, using empty array");
  evaluation.weakAreas = [];
}
```

### Token Budget Exceeded

**Scenario**: A layer exceeds its token budget during construction

**Handling**:
- Prune oldest entries first (for time-based arrays like curriculumTrajectory)
- Prune lowest-priority entries (for frequency-based arrays like persistentWeakAreas)
- Log warning indicating pruning occurred
- Ensure pruned result is still valid and useful

**Example**:
```javascript
if (estimateTokens(curriculumTrajectory) > 200) {
  console.warn("Curriculum trajectory exceeds budget, pruning oldest entries");
  curriculumTrajectory.topics = curriculumTrajectory.topics.slice(-10);
}
```

### Validation Failures

**Scenario**: validateCompressedContext detects structural issues

**Handling**:
- Log detailed error messages
- Attempt to rebuild context from state
- If rebuild fails, fall back to lastEvaluation for generation
- Never block day generation due to validation failures

**Example**:
```javascript
const validation = validateCompressedContext(context);
if (!validation.valid) {
  console.error("Context validation failed:", validation.errors);
  console.log("Attempting to rebuild context from state...");
  context = buildCompressedContext(state, state.lastEvaluation, state.dayContent);
}
```

### Missing Compressed Context (Day 1)

**Scenario**: Day generator called with null compressedLearnerContext

**Handling**:
- Detect null context
- Generate beginner-level content without personalization
- Do not attempt to call buildTodaysBrief
- Log informational message (not error)

**Example**:
```javascript
if (!state.compressedLearnerContext) {
  console.log("Day 1: Generating beginner content without learner context");
  return generateBeginnerContent(dayNumber);
}
```

### Migration Errors

**Scenario**: Backward compatibility migration encounters unexpected state structure

**Handling**:
- Log warning with details of unexpected structure
- Use best-effort migration with available data
- Initialize missing fields with sensible defaults
- Ensure migration never fails completely

**Example**:
```javascript
const migratedContext = {
  learnerIdentity: buildLearnerIdentity(state, state.lastEvaluation || {}),
  curriculumTrajectory: { topics: [] }, // Start empty if no history
  diagnosticProfile: {
    persistentWeakAreas: (state.weakAreas || []).map(area => ({
      area,
      frequency: 1,
      firstSeen: state.currentDay,
      lastSeen: state.currentDay
    })),
    resolvedAreas: [],
    strongAreas: [],
    recurringMistakePatterns: []
  },
  vocabularyMemory: {
    totalWordsLearned: 0,
    recentWords: [],
    wordsToAvoid: []
  }
};
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Test Day 1 initialization (null context)
- Test migration from legacy state format
- Test specific token budget scenarios
- Test error handling paths
- Test integration with evaluationService and dayGenerator

**Property-Based Tests**: Verify universal properties across all inputs
- Generate random state and evaluation data
- Verify structural properties hold for all inputs
- Test token budget enforcement across wide range of data
- Verify computation correctness (level, velocity, confidence signals)
- Test merging and pruning logic with randomized sequences

### Property-Based Testing Configuration

**Library**: Use `fast-check` for JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `// Feature: learner-context-compression, Property {number}: {property_text}`

**Example Property Test**:
```javascript
const fc = require('fast-check');

// Feature: learner-context-compression, Property 3: Level Derivation from Day Number
test('Level is correctly derived from currentDay', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 200 }), // Generate random day numbers
      (currentDay) => {
        const context = buildCompressedContext(
          { currentDay, tracker: { averageScore: 75 } },
          mockEvaluation,
          mockDayContent
        );
        
        const expectedLevel = currentDay <= 30 ? "Beginner"
                            : currentDay <= 70 ? "Intermediate"
                            : "Advanced";
        
        expect(context.learnerIdentity.level).toBe(expectedLevel);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Coverage

**Critical Unit Tests**:

1. **Context Initialization**
   - Test new user (null context) initialization
   - Test first evaluation populates context
   - Test all required fields are present

2. **Layer Construction**
   - Test learnerIdentity with various state values
   - Test curriculumTrajectory growth over multiple days
   - Test diagnosticProfile merging with various weak areas
   - Test vocabularyMemory time window pruning

3. **Computation Correctness**
   - Test level derivation for boundary days (30, 31, 70, 71)
   - Test learningVelocity for boundary scores (70, 85)
   - Test confidenceSignal for boundary scores (60, 80)
   - Test difficultyTarget for each velocity value

4. **Token Budget Enforcement**
   - Test each layer stays within budget
   - Test pruning occurs when budget exceeded
   - Test total context stays within 830 tokens

5. **Today's Brief Generation**
   - Test primaryGoal selects highest-frequency weak area
   - Test reinforcementGoal selects from resolved areas
   - Test avoidTopics contains last 3 days
   - Test all fields are populated

6. **Validation**
   - Test validation passes for valid context
   - Test validation fails for missing fields
   - Test validation fails for invalid enum values
   - Test validation fails for exceeded token budgets

7. **Error Handling**
   - Test graceful handling of missing evaluation fields
   - Test fallback to defaults when data incomplete
   - Test migration from legacy state format
   - Test Day 1 generation without context

8. **Integration**
   - Test evaluationService calls buildCompressedContext
   - Test dayGenerator uses compressed context
   - Test dayGenerator falls back to lastEvaluation if needed
   - Test backward compatibility with existing state files

### Test Data Generators

**For Property-Based Tests**:

```javascript
// Generate random state
const stateArbitrary = fc.record({
  currentDay: fc.integer({ min: 1, max: 200 }),
  tracker: fc.record({
    streak: fc.integer({ min: 0, max: 100 }),
    totalDaysCompleted: fc.integer({ min: 0, max: 200 }),
    averageScore: fc.integer({ min: 0, max: 100 }),
    scoreHistory: fc.array(fc.integer({ min: 0, max: 100 }), { maxLength: 30 })
  }),
  weakAreas: fc.array(fc.string(), { maxLength: 10 }),
  compressedLearnerContext: fc.option(compressedContextArbitrary, { nil: null })
});

// Generate random evaluation
const evaluationArbitrary = fc.record({
  overallPercent: fc.integer({ min: 0, max: 100 }),
  weakAreas: fc.array(fc.string(), { maxLength: 10 }),
  strongAreas: fc.array(fc.string(), { maxLength: 5 }),
  recurringMistakePatterns: fc.array(fc.string(), { maxLength: 10 }),
  scoreBreakdown: fc.record({
    sentencesPercent: fc.integer({ min: 0, max: 100 }),
    writingPercent: fc.integer({ min: 0, max: 100 }),
    speakingPercent: fc.integer({ min: 0, max: 100 })
  })
});

// Generate random day content
const dayContentArbitrary = fc.record({
  dayNumber: fc.integer({ min: 1, max: 200 }),
  dayTheme: fc.string(),
  grammarFocus: fc.string(),
  vocabAndTracks: fc.record({
    wordOfDay: fc.array(
      fc.record({ word: fc.string() }),
      { minLength: 5, maxLength: 10 }
    )
  })
});
```

### Testing Priorities

**High Priority** (Must test before deployment):
1. Token budget enforcement (Properties 22-27)
2. Structure completeness (Properties 1, 2, 7, 12, 16)
3. Computation correctness (Properties 3, 4, 6, 21)
4. Backward compatibility (Properties 33, 34)

**Medium Priority** (Should test):
5. Merging and pruning logic (Properties 8, 9, 10, 11)
6. Time window enforcement (Properties 13, 14, 20)
7. Today's brief generation (Properties 18, 19)
8. Validation (Properties 35, 36, 37)

**Lower Priority** (Nice to have):
9. Maximum length enforcement (Properties 31, 32)
10. Data exclusion (Properties 38, 39)

