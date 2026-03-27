# Requirements Document

## Introduction

This feature transforms the current noisy, unbounded evaluation data sent to Gemini into a compressed, 5-layer context structure. Currently, the system sends either nothing (Day 1) or the full lastEvaluation object (~2000-4000 tokens) containing raw data like 20 sentence corrections, 6 question answers, and raw scores. This creates inefficiency and poor personalization.

The compressed context will reduce token costs to ~830 tokens maximum, provide bounded growth as users progress, improve content personalization, and enable AI-to-AI communication about specific learner patterns through a structured mental model rather than raw transcripts.

## Glossary

- **Compressed_Context**: A 5-layer data structure that synthesizes learner progress into a compact, AI-readable format
- **Learner_Identity**: Static layer containing basic learner metrics (currentDay, level, streak, velocity)
- **Curriculum_Trajectory**: Historical record of topics taught with confidence signals per topic
- **Diagnostic_Profile**: The most valuable layer tracking persistent weak areas, resolved areas, strong areas, and recurring mistake patterns
- **Vocabulary_Memory**: Compact tracking of total words learned, recent words, and words to avoid
- **Todays_Brief**: Strategic directive computed fresh at generation time with goals and instructions
- **Day_Generator**: The system component that generates daily lesson content using Gemini
- **Evaluator**: The system component that evaluates learner submissions and returns structured feedback
- **Learning_Velocity**: Computed metric indicating learner progress speed ("fast" | "steady" | "struggling")
- **Confidence_Signal**: Performance indicator per topic (strong/medium/weak based on scores)

## Requirements

### Requirement 1: Add Compressed Context State Field

**User Story:** As a system, I want to store compressed learner context in state, so that I can efficiently track learner progress across sessions.

#### Acceptance Criteria

1. THE State_Schema SHALL include a new field named "compressedLearnerContext"
2. THE compressedLearnerContext field SHALL contain four sub-layers: learnerIdentity, curriculumTrajectory, diagnosticProfile, and vocabularyMemory
3. THE compressedLearnerContext field SHALL be initialized as null for new users
4. WHEN a user completes their first evaluation, THE System SHALL populate the compressedLearnerContext field

### Requirement 2: Build Learner Identity Layer

**User Story:** As a content generator, I want static learner identity information, so that I can understand the learner's basic profile.

#### Acceptance Criteria

1. THE Compressed_Context SHALL include a learnerIdentity layer with maximum 80 tokens
2. THE learnerIdentity layer SHALL contain: currentDay, level, streakDays, totalDaysCompleted, averageScore, and learningVelocity
3. THE level field SHALL be derived from currentDay: days 1-30 = "Beginner", days 31-70 = "Intermediate", days 71+ = "Advanced"
4. THE learningVelocity field SHALL be computed as "fast" when averageScore >= 85, "steady" when averageScore >= 70, and "struggling" when averageScore < 70
5. THE learnerIdentity layer SHALL be updated after each successful evaluation

### Requirement 3: Build Curriculum Trajectory Layer

**User Story:** As a content generator, I want to know what topics were taught and how well they were learned, so that I can build on previous lessons appropriately.

#### Acceptance Criteria

1. THE Compressed_Context SHALL include a curriculumTrajectory layer with maximum 200 tokens at Day 30
2. THE curriculumTrajectory layer SHALL contain an array of topic entries with: dayNumber, topic, grammarFocus, and confidenceSignal
3. THE confidenceSignal SHALL be "strong" when topic score >= 80, "medium" when score >= 60, and "weak" when score < 60
4. THE curriculumTrajectory layer SHALL grow linearly with days completed
5. THE curriculumTrajectory layer SHALL store only essential topic information, not full evaluation details

### Requirement 4: Build Diagnostic Profile Layer

**User Story:** As a content generator, I want to understand persistent learner weaknesses and strengths, so that I can personalize content to address specific needs.

#### Acceptance Criteria

1. THE Compressed_Context SHALL include a diagnosticProfile layer with maximum 300 tokens
2. THE diagnosticProfile SHALL contain: persistentWeakAreas, resolvedAreas, strongAreas, and recurringMistakePatterns
3. THE persistentWeakAreas SHALL track areas appearing across multiple days with frequency counts
4. THE resolvedAreas SHALL track areas that appeared once then disappeared, limited to last 5 entries
5. THE strongAreas SHALL track consistently well-performed areas based on scores >= 80
6. THE recurringMistakePatterns SHALL contain specific error descriptions for AI-to-AI communication
7. WHEN a weak area appears in 3+ consecutive evaluations, THE System SHALL add it to persistentWeakAreas
8. WHEN a persistent weak area no longer appears in 2+ consecutive evaluations, THE System SHALL move it to resolvedAreas

### Requirement 5: Build Vocabulary Memory Layer

**User Story:** As a content generator, I want compact vocabulary tracking, so that I can introduce new words and avoid repetition.

#### Acceptance Criteria

1. THE Compressed_Context SHALL include a vocabularyMemory layer with maximum 100 tokens
2. THE vocabularyMemory layer SHALL contain: totalWordsLearned (count), recentWords (last 2 days only), and wordsToAvoid (prevent repetition)
3. THE recentWords array SHALL contain only words from the last 2 days
4. THE wordsToAvoid array SHALL contain words used in the last 7 days to prevent immediate repetition
5. THE totalWordsLearned count SHALL increment by the number of new vocabulary words introduced each day

### Requirement 6: Build Today's Brief Layer

**User Story:** As a content generator, I want a fresh strategic directive for today's lesson, so that I can create targeted content addressing current learner needs.

#### Acceptance Criteria

1. THE System SHALL compute a todaysBrief layer fresh at generation time with maximum 150 tokens
2. THE todaysBrief SHALL contain: primaryGoal, reinforcementGoal, avoidTopics, difficultyTarget, sentenceDesignInstruction, and vocabularyInstruction
3. THE todaysBrief SHALL NOT be stored in state
4. THE primaryGoal SHALL target the highest-frequency persistent weak area
5. THE reinforcementGoal SHALL target a recently resolved area to ensure retention
6. THE avoidTopics SHALL list topics from the last 3 days to ensure variety
7. THE difficultyTarget SHALL be "easier" when learningVelocity is "struggling", "standard" when "steady", and "challenging" when "fast"

### Requirement 7: Implement Context Builder Function

**User Story:** As an evaluator, I want to build compressed context from evaluation results, so that learner progress is efficiently tracked.

#### Acceptance Criteria

1. THE System SHALL provide a function named "buildCompressedContext" that accepts state and evaluation parameters
2. WHEN buildCompressedContext is called, THE System SHALL merge new evaluation data into existing compressed context
3. THE buildCompressedContext function SHALL update all four stored layers: learnerIdentity, curriculumTrajectory, diagnosticProfile, and vocabularyMemory
4. THE buildCompressedContext function SHALL be called after each evaluation completes
5. THE buildCompressedContext function SHALL enforce maximum token limits per layer

### Requirement 8: Implement Brief Builder Function

**User Story:** As a day generator, I want to build today's strategic brief, so that I can generate personalized lesson content.

#### Acceptance Criteria

1. THE System SHALL provide a function named "buildTodaysBrief" that accepts compressedContext and dayNumber parameters
2. WHEN buildTodaysBrief is called, THE System SHALL compute fresh strategic directives based on current learner state
3. THE buildTodaysBrief function SHALL return a todaysBrief object with all required fields
4. THE buildTodaysBrief function SHALL be called at content generation time, not at evaluation time
5. THE buildTodaysBrief function SHALL analyze diagnosticProfile to determine primaryGoal and reinforcementGoal

### Requirement 9: Extend Evaluator Return Fields

**User Story:** As a context builder, I want evaluators to return structured diagnostic data, so that I can build accurate diagnostic profiles.

#### Acceptance Criteria

1. THE Evaluator SHALL return a new field named "strongAreas" containing areas where the learner scored >= 80%
2. THE Evaluator SHALL return a new field named "recurringMistakePatterns" containing specific error descriptions
3. THE strongAreas field SHALL be an array of strings with maximum 5 entries
4. THE recurringMistakePatterns field SHALL be an array of strings with maximum 10 entries
5. THE Evaluator SHALL analyze sentence evaluations, question answers, and task feedback to populate these fields

### Requirement 10: Update Day Generator to Use Compressed Context

**User Story:** As a day generator, I want to use compressed context instead of raw evaluation data, so that I can generate better personalized content with lower token costs.

#### Acceptance Criteria

1. WHEN generating day content, THE Day_Generator SHALL use compressedLearnerContext instead of lastEvaluation
2. WHEN compressedLearnerContext is null (Day 1), THE Day_Generator SHALL generate beginner content without context
3. THE Day_Generator SHALL call buildTodaysBrief to get fresh strategic directives
4. THE Day_Generator SHALL pass the complete 5-layer context (4 stored layers + todaysBrief) to Gemini
5. THE Day_Generator SHALL NOT send raw evaluation data to Gemini

### Requirement 11: Update Prompts to Expect Compressed Context

**User Story:** As a prompt engineer, I want prompts that expect compressed context structure, so that Gemini understands the new format.

#### Acceptance Criteria

1. THE System_Trainer_Prompt SHALL document the 5-layer compressed context structure
2. THE System_Trainer_Prompt SHALL explain how to interpret learnerIdentity, curriculumTrajectory, diagnosticProfile, vocabularyMemory, and todaysBrief
3. THE System_Trainer_Prompt SHALL instruct Gemini to use diagnosticProfile for implicit practice design
4. THE System_Trainer_Prompt SHALL instruct Gemini to use todaysBrief for strategic content decisions
5. THE System_Trainer_Prompt SHALL NOT reference raw evaluation fields like sentenceEvaluations or scoreBreakdown

### Requirement 12: Implement Diagnostic Profile Merging Logic

**User Story:** As a context builder, I want to merge new evaluation data into diagnostic profile, so that persistent patterns are tracked accurately.

#### Acceptance Criteria

1. WHEN merging weak areas, THE System SHALL increment frequency count for areas that already exist in persistentWeakAreas
2. WHEN a weak area appears for the first time, THE System SHALL add it to persistentWeakAreas with frequency count of 1
3. WHEN a persistent weak area does not appear in 2+ consecutive evaluations, THE System SHALL move it to resolvedAreas
4. THE resolvedAreas array SHALL be pruned to keep only the last 5 entries to prevent unbounded growth
5. THE persistentWeakAreas array SHALL be sorted by frequency (highest first) for prioritization

### Requirement 13: Implement Token Budget Enforcement

**User Story:** As a system architect, I want token budgets enforced per layer, so that context size remains bounded and predictable.

#### Acceptance Criteria

1. THE System SHALL enforce a maximum of 80 tokens for learnerIdentity layer
2. THE System SHALL enforce a maximum of 200 tokens for curriculumTrajectory layer at Day 30
3. THE System SHALL enforce a maximum of 300 tokens for diagnosticProfile layer
4. THE System SHALL enforce a maximum of 100 tokens for vocabularyMemory layer
5. THE System SHALL enforce a maximum of 150 tokens for todaysBrief layer
6. WHEN a layer exceeds its token budget, THE System SHALL prune oldest or lowest-priority entries
7. THE total compressed context SHALL NOT exceed 830 tokens

### Requirement 14: Implement Backward Compatibility

**User Story:** As a system maintainer, I want backward compatibility with existing state files, so that current users are not disrupted.

#### Acceptance Criteria

1. WHEN compressedLearnerContext is null or missing, THE System SHALL initialize it from existing state fields
2. THE System SHALL migrate data from lastEvaluation, weakAreas, and scoreHistory into compressed context format
3. THE migration SHALL occur automatically on the first evaluation after deployment
4. THE System SHALL continue to store lastEvaluation for debugging purposes
5. THE Day_Generator SHALL prefer compressedLearnerContext when available, falling back to lastEvaluation if missing

### Requirement 15: Implement Context Validation

**User Story:** As a quality assurance engineer, I want compressed context validated before use, so that malformed data does not cause generation failures.

#### Acceptance Criteria

1. THE System SHALL validate compressedLearnerContext structure before passing to Day_Generator
2. THE validation SHALL check that all required layer fields are present
3. THE validation SHALL check that token counts per layer are within budget
4. WHEN validation fails, THE System SHALL log a warning and fall back to rebuilding context from state
5. THE validation SHALL check that learningVelocity is one of: "fast", "steady", or "struggling"
