# Implementation Plan: Learner Context Compression

## Overview

This implementation transforms the current noisy, unbounded evaluation data (~2000-4000 tokens) into a compressed 5-layer context structure (~830 tokens maximum). The feature creates new utility modules for context building and validation, modifies existing services to use compressed context, and ensures backward compatibility with existing state files.

## Tasks

- [x] 1. Create core utility modules for context management
  - [x] 1.1 Create contextBuilder.js with buildCompressedContext function
    - Implement buildCompressedContext() that accepts state, evaluation, and dayContent
    - Implement buildLearnerIdentity() helper function
    - Implement buildCurriculumTrajectory() helper function
    - Implement buildDiagnosticProfile() helper function
    - Implement buildVocabularyMemory() helper function
    - Ensure all functions enforce token budgets through pruning
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5, 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 13.7_

  - [ ]* 1.2 Write property tests for contextBuilder.js
    - **Property 1: Compressed Context Structure Completeness**
    - **Validates: Requirements 1.2, 7.3**
    - **Property 2: Learner Identity Structure Completeness**
    - **Validates: Requirements 2.2**
    - **Property 3: Level Derivation from Day Number**
    - **Validates: Requirements 2.3**
    - **Property 4: Learning Velocity Computation**
    - **Validates: Requirements 2.4**
    - **Property 5: Curriculum Topic Entry Structure**
    - **Validates: Requirements 3.2**
    - **Property 6: Confidence Signal Computation**
    - **Validates: Requirements 3.3**
    - **Property 7: Diagnostic Profile Structure Completeness**
    - **Validates: Requirements 4.2**
    - **Property 8: Weak Area Frequency Tracking**
    - **Validates: Requirements 4.3, 12.1, 12.2**
    - **Property 9: Resolved Areas Bounded Growth**
    - **Validates: Requirements 4.4, 12.4**
    - **Property 10: Persistent Weak Areas Sorted by Frequency**
    - **Validates: Requirements 12.5**
    - **Property 11: Weak Area Resolution Detection**
    - **Validates: Requirements 4.8, 12.3**
    - **Property 12: Vocabulary Memory Structure Completeness**
    - **Validates: Requirements 5.2**
    - **Property 13: Recent Words Time Window**
    - **Validates: Requirements 5.3**
    - **Property 14: Words to Avoid Time Window**
    - **Validates: Requirements 5.4**
    - **Property 15: Total Words Learned Increment**
    - **Validates: Requirements 5.5**
    - **Property 22: Token Budget Enforcement - Learner Identity**
    - **Validates: Requirements 2.1, 13.1**
    - **Property 23: Token Budget Enforcement - Curriculum Trajectory**
    - **Validates: Requirements 3.1, 13.2**
    - **Property 24: Token Budget Enforcement - Diagnostic Profile**
    - **Validates: Requirements 4.1, 13.3**
    - **Property 25: Token Budget Enforcement - Vocabulary Memory**
    - **Validates: Requirements 5.1, 13.4**
    - **Property 27: Total Compressed Context Token Budget**
    - **Validates: Requirements 13.7**
    - **Property 28: Build Compressed Context Returns All Layers**
    - **Validates: Requirements 7.2, 7.3**
    - **Property 29: Build Compressed Context Enforces Token Limits**
    - **Validates: Requirements 7.5**
    - **Property 38: Curriculum Trajectory Excludes Evaluation Details**
    - **Validates: Requirements 3.5**

  - [ ]* 1.3 Write unit tests for contextBuilder.js
    - Test Day 1 initialization with null context
    - Test context initialization from first evaluation
    - Test learnerIdentity with boundary day values (30, 31, 70, 71)
    - Test learningVelocity with boundary scores (70, 85)
    - Test curriculumTrajectory growth over multiple days
    - Test diagnosticProfile merging with repeated weak areas
    - Test weak area resolution after 2+ days absence
    - Test vocabularyMemory time window pruning
    - Test token budget pruning for each layer
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.8, 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3, 13.4, 13.7_

- [x] 2. Create briefBuilder.js module for strategic directives
  - [x] 2.1 Implement buildTodaysBrief function
    - Accept compressedContext and dayNumber parameters
    - Compute primaryGoal from highest-frequency persistent weak area
    - Compute reinforcementGoal from recently resolved areas
    - Extract avoidTopics from last 3 days of curriculum trajectory
    - Compute difficultyTarget based on learningVelocity
    - Generate sentenceDesignInstruction from persistent weak areas
    - Generate vocabularyInstruction from wordsToAvoid
    - Enforce 150 token maximum for the brief
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 2.2 Write property tests for briefBuilder.js
    - **Property 16: Today's Brief Structure Completeness**
    - **Validates: Requirements 6.2, 8.3**
    - **Property 17: Today's Brief Not Stored in State**
    - **Validates: Requirements 6.3**
    - **Property 18: Primary Goal Targets Highest-Frequency Weak Area**
    - **Validates: Requirements 6.4, 8.5**
    - **Property 19: Reinforcement Goal Targets Recently Resolved Area**
    - **Validates: Requirements 6.5, 8.5**
    - **Property 20: Avoid Topics from Last 3 Days**
    - **Validates: Requirements 6.6**
    - **Property 21: Difficulty Target Based on Learning Velocity**
    - **Validates: Requirements 6.7**
    - **Property 26: Token Budget Enforcement - Today's Brief**
    - **Validates: Requirements 6.1, 13.5**
    - **Property 30: Build Today's Brief Returns Complete Object**
    - **Validates: Requirements 8.2, 8.3**

  - [ ]* 2.3 Write unit tests for briefBuilder.js
    - Test primaryGoal selection with multiple weak areas
    - Test reinforcementGoal with empty resolved areas
    - Test avoidTopics with fewer than 3 days of history
    - Test difficultyTarget for each learningVelocity value
    - Test sentenceDesignInstruction with no persistent weak areas
    - Test vocabularyInstruction with empty wordsToAvoid
    - Test token budget enforcement
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 8.1, 8.2, 8.3, 8.5, 13.5_

- [x] 3. Create contextValidator.js module for validation
  - [x] 3.1 Implement validateCompressedContext function
    - Check all required layers are present (learnerIdentity, curriculumTrajectory, diagnosticProfile, vocabularyMemory)
    - Validate learnerIdentity fields and enum values
    - Validate learningVelocity is one of: "fast", "steady", "struggling"
    - Validate level is one of: "Beginner", "Intermediate", "Advanced"
    - Estimate token counts per layer using JSON.stringify().length / 4
    - Check each layer is within token budget
    - Return { valid: boolean, errors: string[] }
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 3.2 Write property tests for contextValidator.js
    - **Property 35: Validation Checks Required Fields**
    - **Validates: Requirements 15.2**
    - **Property 36: Validation Checks Token Budgets**
    - **Validates: Requirements 15.3**
    - **Property 37: Validation Checks Learning Velocity Values**
    - **Validates: Requirements 15.5**

  - [ ]* 3.3 Write unit tests for contextValidator.js
    - Test validation passes for valid context
    - Test validation fails for missing learnerIdentity
    - Test validation fails for missing curriculumTrajectory
    - Test validation fails for missing diagnosticProfile
    - Test validation fails for missing vocabularyMemory
    - Test validation fails for invalid learningVelocity value
    - Test validation fails for invalid level value
    - Test validation fails when layer exceeds token budget
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 4. Checkpoint - Ensure all utility module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend evaluationService.js to return new diagnostic fields
  - [x] 5.1 Add strongAreas extraction to evaluation normalization
    - Analyze scoreBreakdown to identify areas with scores >= 80%
    - Extract strongAreas from sentence evaluations, writing, speaking, conversation
    - Limit strongAreas array to maximum 5 entries
    - Add strongAreas field to normalized evaluation object
    - _Requirements: 9.1, 9.3_

  - [x] 5.2 Add recurringMistakePatterns extraction to evaluation normalization
    - Analyze sentenceEvaluations for repeated errorType patterns
    - Extract specific error descriptions from errorReason fields
    - Identify patterns appearing 2+ times in the evaluation
    - Limit recurringMistakePatterns array to maximum 10 entries
    - Add recurringMistakePatterns field to normalized evaluation object
    - _Requirements: 9.2, 9.4, 9.5_

  - [ ]* 5.3 Write unit tests for new evaluation fields
    - Test strongAreas extraction with various score combinations
    - Test strongAreas limited to 5 entries
    - Test recurringMistakePatterns extraction from sentence errors
    - Test recurringMistakePatterns limited to 10 entries
    - Test evaluation normalization includes new fields
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 6. Modify evaluationService.js to build compressed context
  - [x] 6.1 Import contextBuilder and contextValidator modules
    - Add require statements for contextBuilder.js and contextValidator.js
    - _Requirements: 7.1_

  - [x] 6.2 Update updateStateAfterEvaluation to build compressed context
    - Call buildCompressedContext(state, evaluation, dayContent) after evaluation
    - Store result in nextState.compressedLearnerContext
    - Validate compressed context using validateCompressedContext
    - Log warning if validation fails and attempt rebuild
    - Continue storing nextState.lastEvaluation for backward compatibility
    - Handle errors gracefully without blocking evaluation completion
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5, 14.4, 15.1, 15.2, 15.3, 15.4_

  - [ ]* 6.3 Write integration tests for evaluationService modifications
    - Test updateStateAfterEvaluation calls buildCompressedContext
    - Test compressedLearnerContext is stored in state
    - Test lastEvaluation is still stored for backward compatibility
    - Test validation is called on compressed context
    - Test graceful error handling when context building fails
    - Test context rebuild on validation failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.4, 14.4, 15.1, 15.4_

- [x] 7. Modify dayGenerator.js to use compressed context
  - [x] 7.1 Import briefBuilder and contextValidator modules
    - Add require statements for briefBuilder.js and contextValidator.js
    - _Requirements: 8.1_

  - [x] 7.2 Update generateDayContentGemini to use compressed context
    - Check if state.compressedLearnerContext exists
    - If null (Day 1), generate beginner content without context
    - If exists, validate context using validateCompressedContext
    - Call buildTodaysBrief(state.compressedLearnerContext, dayNumber)
    - Build 5-layer context object (4 stored layers + todaysBrief)
    - Pass compressed context to Gemini instead of lastEvaluation
    - Remove references to state.lastEvaluation and state.weakAreas in prompt
    - Fall back to lastEvaluation if compressed context validation fails
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5, 14.5, 15.1, 15.4_

  - [ ]* 7.3 Write integration tests for dayGenerator modifications
    - Test Day 1 generation with null compressedLearnerContext
    - Test generation with valid compressed context
    - Test buildTodaysBrief is called when context exists
    - Test 5-layer context is passed to Gemini
    - Test fallback to lastEvaluation on validation failure
    - Test raw evaluation data is not sent to Gemini
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 10.1, 10.2, 10.3, 10.4, 10.5, 14.5, 15.4_

- [x] 8. Update prompts.js to document compressed context structure
  - [x] 8.1 Add LEARNER CONTEXT STRUCTURE section to SYSTEM_TRAINER_PROMPT
    - Document the 5-layer compressed context structure
    - Explain learnerIdentity layer and its fields
    - Explain curriculumTrajectory layer and confidenceSignal interpretation
    - Explain diagnosticProfile layer and how to use it for implicit practice design
    - Explain vocabularyMemory layer and word avoidance
    - Explain todaysBrief layer and strategic directives
    - Provide guidance on using diagnosticProfile for personalization
    - Provide guidance on using todaysBrief for content decisions
    - Remove or deprecate references to raw evaluation fields
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 8.2 Write validation tests for prompt documentation
    - Test prompt includes all 5 layer descriptions
    - Test prompt explains how to interpret confidenceSignal
    - Test prompt explains how to use diagnosticProfile
    - Test prompt explains how to use todaysBrief
    - Test prompt does not reference raw evaluation fields
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 9. Checkpoint - Ensure integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement backward compatibility and migration logic
  - [x] 10.1 Add migration function to contextBuilder.js
    - Implement migrateFromLegacyState(state) function
    - Initialize compressedLearnerContext from lastEvaluation if present
    - Migrate weakAreas to persistentWeakAreas with frequency 1
    - Migrate scoreHistory to curriculumTrajectory if possible
    - Use sensible defaults for missing fields
    - Return fully initialized compressed context
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 10.2 Update evaluationService to trigger migration
    - Check if state.compressedLearnerContext is null or missing
    - Call migrateFromLegacyState(state) on first evaluation after deployment
    - Store migrated context in state
    - Log informational message about migration
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ]* 10.3 Write migration tests
    - Test migration from state with lastEvaluation
    - Test migration from state with weakAreas
    - Test migration from state with scoreHistory
    - Test migration with missing fields uses defaults
    - Test migration creates valid compressed context
    - Test migration is triggered automatically on first evaluation
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 11. Add comprehensive error handling
  - [x] 11.1 Add error handling to contextBuilder.js
    - Handle missing or invalid evaluation fields gracefully
    - Use empty arrays for missing weakAreas, strongAreas, recurringMistakePatterns
    - Log warnings for missing data but continue building context
    - Never throw exceptions that would block evaluation completion
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 11.2 Add error handling to briefBuilder.js
    - Handle empty persistentWeakAreas gracefully
    - Handle empty resolvedAreas gracefully
    - Handle empty curriculumTrajectory gracefully
    - Provide sensible default values for all brief fields
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 11.3 Add error handling to dayGenerator.js
    - Handle null compressedLearnerContext (Day 1)
    - Handle validation failures with fallback to lastEvaluation
    - Handle buildTodaysBrief failures gracefully
    - Log detailed error messages for debugging
    - Never block day generation due to context issues
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 15.4_

  - [ ]* 11.4 Write error handling tests
    - Test contextBuilder with missing evaluation fields
    - Test briefBuilder with empty diagnostic profile
    - Test dayGenerator with null context
    - Test dayGenerator with validation failure
    - Test fallback to lastEvaluation works correctly
    - _Requirements: 7.1, 7.2, 8.1, 8.2, 10.1, 10.2, 15.4_

- [x] 12. Final checkpoint - Ensure all tests pass and integration works
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and integration points
- The implementation maintains backward compatibility by continuing to store lastEvaluation
- Token budgets are enforced through pruning strategies (oldest-first for time-based, lowest-priority for frequency-based)
- Error handling ensures the feature never blocks evaluation or generation flows
