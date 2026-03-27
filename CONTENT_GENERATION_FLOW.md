# Complete Content Generation & Day Progression Flow

## Overview
This document explains how the AI English learning app generates content, manages topics, and advances users through days.

---

## 🔄 COMPLETE FLOW: Day 1 → Day 2

### **STEP 1: User Starts Day 1**

**Location**: `server/src/index.js` → `GET /api/day`

1. **User loads the app** → Frontend calls `GET /api/day`
2. **Server loads user state** from MongoDB:
   ```javascript
   state = {
     currentDay: 1,
     dayContent: null,  // No content yet
     dayContentGeneratedDate: null,
     lastDayCompletionDate: null,
     tracker: { streak: 0, totalDaysCompleted: 0, ... },
     weakAreas: [],
     lastEvaluation: null
   }
   ```

3. **Server calls** `getOrGenerateDayContent()`:
   - Checks if `dayContent` exists for `currentDay = 1`
   - Since `dayContent = null`, it needs to generate

4. **Content Generation** (`server/src/trainer/dayGenerator.js`):
   ```javascript
   generateDayContentGemini({
     state: state,
     dayNumber: 1,
     userId: userId,
     previousDaySummary: null  // First day, no previous
   })
   ```

5. **AI Prompt Construction**:
   ```javascript
   userPrompt = {
     task: "Generate a new day plan",
     dayNumber: 1,
     dayType: "normal",  // Days 1-6 are normal, Day 7 is weekly_review
     level: "Beginner",  // Days 1-30 = Beginner
     curriculumRules: {
       sentenceCount: 20,
       hindiTranslationCount: 20,
       questionCount: 6,
       listeningCount: 3,
       warmUpCorrectionsCount: 3,
       requiredVocabularyWordCount: 10
     },
     previousDay: null,
     weakAreas: [],
     errorLog: null
   }
   ```

6. **Gemini AI Generates**:
   - **Topic Selection**: AI chooses "Simple Present Tense" for Day 1 (beginner level)
   - **Grammar Explanation**: 1800 chars explaining present tense
   - **20 Sentence Prompts**: "Write a sentence about your daily routine"
   - **20 Hindi Sentences**: "मैं रोज़ सुबह उठता हूँ" (I wake up every morning)
   - **6 Questions**: Comprehension questions about present tense
   - **3 Listening Questions**: Audio transcript + questions
   - **10 Vocabulary Words**: routine, activity, daily, etc.
   - **Writing/Speaking/Conversation Tasks**

7. **Content Normalization** (`server/src/trainer/dayNormalize.js`):
   - Validates all fields
   - Fills missing data with fallbacks
   - Ensures exactly 20 sentences, 20 Hindi, 6 questions, etc.

8. **Save to Database**:
   ```javascript
   state.dayContent = newDayContent;
   state.dayContentGeneratedDate = "2026-03-27";  // IST date
   state.currentDay = 1;
   await stateStore.save(userId, state);
   ```

9. **Return to Frontend**:
   ```json
   {
     "dayContent": {
       "dayNumber": 1,
       "dayTheme": "Daily Routines and Habits",
       "grammarFocus": "Simple Present Tense",
       "sentencePractice": { "items": [20 prompts] },
       "hindiTranslation": { "items": [20 Hindi sentences] },
       "questions": { "items": [6 questions] },
       "listening": { "transcript": "...", "questions": [3] },
       "vocabAndTracks": { "wordOfDay": [10 words] }
     },
     "tracker": { "day": 1, "streak": 0 }
   }
   ```

---

### **STEP 2: User Completes Day 1**

**Location**: `server/src/index.js` → `POST /api/submit`

1. **User fills submission form**:
   - Writing task
   - Speaking task
   - Conversation (8 turns)
   - 20 Sentences
   - 20 Hindi→English translations
   - 6 Questions
   - 3 Listening answers
   - 2 Reflection

2. **Frontend sends**:
   ```javascript
   POST /api/submit
   {
     submissionText: "DAY 1 SUBMISSION\n\n1. Writing Task:\n...",
     timeSpentMinutes: 45
   }
   ```

3. **Server validates submission** (`server/src/trainer/validator.js`):
   - Parses text into structured format
   - Checks all 20 sentences present
   - Checks all 20 Hindi translations present
   - Checks all 6 questions answered
   - Checks all 3 listening answers present

4. **AI Evaluation** (`server/src/trainer/evaluationService.js`):
   ```javascript
   evaluateSubmissionGemini({
     dayContent: state.dayContent,
     submissionParsed: parsed,
     state: state
   })
   ```

5. **Gemini Evaluates**:
   - **Sentence Corrections**: Each of 20 sentences → Correct/Incorrect + feedback
   - **Hindi Translations**: Checks accuracy and naturalness
   - **Questions**: Correct/Incorrect for each
   - **Listening**: Correct/Incorrect for each
   - **Overall Score**: Weighted average
   - **Tier**: Weak (<50%), Medium (50-75%), Strong (≥76%)
   - **Today's Summary**: 
     - `grammarSummary`: 150+ word explanation
     - `topicNotes`: 150+ word revision card
     - `quickRecap`: 3-5 flashcard bullets
     - `keyVocabulary`: Words with partOfSpeech tags

6. **Evaluation Result**:
   ```json
   {
     "overallPercent": 82,
     "tier": "Strong",
     "passFail": "PASS",
     "sentenceEvaluations": [20 items],
     "questions": { "answers": [6 items] },
     "listening": { "answers": [3 items] },
     "todaySummary": {
       "topic": "Simple Present Tense",
       "grammarSummary": "150+ words...",
       "topicNotes": "150+ words...",
       "quickRecap": ["Rule 1", "Rule 2", "Rule 3"],
       "keyVocabulary": [
         { "word": "routine", "partOfSpeech": "noun", "meaning": "...", "exampleUse": "..." }
       ]
     }
   }
   ```

---

### **STEP 3: Day Advancement Logic**

**Location**: `server/src/trainer/evaluationService.js` → `updateStateAfterEvaluation()`

1. **Check if user passed**:
   ```javascript
   const passThreshold = 76;  // 80 for weekly_review
   const strong = evaluation.overallPercent >= 76;  // true (82%)
   ```

2. **Check IST timezone date**:
   ```javascript
   const now = new Date();
   const istOffset = 5.5 * 60 * 60 * 1000;  // UTC+5:30
   const istTime = new Date(now.getTime() + istOffset);
   const todayIST = "2026-03-27";  // YYYY-MM-DD
   
   const lastCompletionDate = state.lastDayCompletionDate;  // null (first time)
   const canAdvanceToday = !lastCompletionDate || lastCompletionDate !== todayIST;
   ```

3. **Advance to Day 2** (if passed AND new IST day):
   ```javascript
   if (strong && canAdvanceToday) {
     nextState.currentDay = 2;  // Advance!
     nextState.dayContent = null;  // Clear old content
     nextState.dayContentGeneratedDate = null;  // Force regeneration
     nextState.lastDayCompletionDate = "2026-03-27";  // Track completion
     nextState.lastEvaluation = evaluation;  // Save for next day generation
     nextState.tracker.totalDaysCompleted = 1;
     nextState.tracker.streak = 1;
   }
   ```

4. **Update weak areas for next day**:
   ```javascript
   nextState.weakAreas = evaluation.weakAreas;  // ["Article usage", "Verb forms"]
   nextState.weakGrammarAreas = evaluation.weakAreas.slice(0, 5);
   nextState.confidentTopics = ["Simple Present Tense"];
   nextState.grammarCoveredByDay = { "1": "Simple Present Tense" };
   ```

5. **Save to database**:
   ```javascript
   await stateStore.save(userId, nextState);
   ```

6. **Return to frontend**:
   ```json
   {
     "ok": true,
     "evaluation": { ... },
     "tracker": { "day": 2, "streak": 1, "totalDaysCompleted": 1 },
     "next": { "action": "advance", "day": 2 }
   }
   ```

---

### **STEP 4: User Starts Day 2**

**Location**: `server/src/index.js` → `GET /api/day`

1. **User refreshes or loads app next day**
2. **Server loads state**:
   ```javascript
   state = {
     currentDay: 2,
     dayContent: null,  // Cleared after advancement
     dayContentGeneratedDate: null,
     lastDayCompletionDate: "2026-03-27",
     lastEvaluation: { /* Day 1 results */ },
     weakAreas: ["Article usage", "Verb forms"],
     grammarCoveredByDay: { "1": "Simple Present Tense" }
   }
   ```

3. **Generate Day 2 Content**:
   ```javascript
   generateDayContentGemini({
     state: state,
     dayNumber: 2,
     userId: userId,
     previousDaySummary: state.lastEvaluation  // Day 1 results!
   })
   ```

4. **AI Prompt for Day 2**:
   ```javascript
   userPrompt = {
     task: "Generate a new day plan",
     dayNumber: 2,
     dayType: "normal",
     level: "Beginner",
     previousDay: {
       dayNumber: 1,
       grammarFocus: "Simple Present Tense",
       overallPercent: 82,
       weakAreas: ["Article usage", "Verb forms"],
       commonMistakes: ["Forgot 'a/an'", "Wrong verb form"]
     },
     weakAreas: ["Article usage", "Verb forms"],
     grammarCoveredByDay: { "1": "Simple Present Tense" }
   }
   ```

5. **AI Topic Selection for Day 2**:
   - **Analyzes**: User struggled with articles and verb forms
   - **Avoids**: Simple Present Tense (already covered)
   - **Chooses**: "Articles (a, an, the)" - addresses weak area!
   - **Difficulty**: Still Beginner level (Day 2)
   - **Builds on**: Day 1 vocabulary and concepts

6. **Day 2 Content Generated**:
   ```json
   {
     "dayNumber": 2,
     "dayTheme": "Using Articles Correctly",
     "grammarFocus": "Articles (a, an, the)",
     "grammarExplanationText": "Explains when to use a/an/the...",
     "sentencePractice": [20 new prompts focusing on articles],
     "hindiTranslation": [20 new Hindi sentences],
     "vocabAndTracks": {
       "wordOfDay": [10 new words, avoiding Day 1 words]
     }
   }
   ```

7. **Save and return**:
   ```javascript
   state.dayContent = day2Content;
   state.dayContentGeneratedDate = "2026-03-28";  // New IST date
   await stateStore.save(userId, state);
   ```

---

## 🎯 KEY MECHANISMS

### **1. Topic Progression**

**How AI chooses topics**:

```javascript
// In dayGenerator.js
const userPrompt = {
  previousDay: {
    grammarFocus: "Simple Present Tense",
    weakAreas: ["Article usage", "Verb forms"],
    overallPercent: 82
  },
  grammarCoveredByDay: {
    "1": "Simple Present Tense",
    "2": "Articles (a, an, the)",
    "3": "Present Continuous"
  },
  level: "Beginner"  // Days 1-30
}
```

**AI Logic**:
1. **Check level**: Beginner (Days 1-30) → Simple grammar
2. **Check covered topics**: Avoid repeating recent topics
3. **Check weak areas**: Prioritize user's struggles
4. **Natural progression**: Build on previous concepts
5. **Curriculum balance**: Mix grammar, vocabulary, listening

**Example Progression**:
- Day 1: Simple Present Tense
- Day 2: Articles (a, an, the) ← User weak area
- Day 3: Present Continuous
- Day 4: Prepositions of Time
- Day 5: Question Formation
- Day 6: Past Simple Tense
- Day 7: **Weekly Review** (tests Days 1-6)

### **2. Content Caching**

**Cache Strategy** (`getOrGenerateDayContent`):

```javascript
// Check 1: Content exists for current day AND generated today?
if (state.dayContent?.dayNumber === state.currentDay && 
    state.dayContentGeneratedDate === todayIST) {
  return state;  // Use cached
}

// Check 2: Content exists for current day (any date)?
if (state.dayContent?.dayNumber === state.currentDay) {
  // Still use it, just update date stamp
  state.dayContentGeneratedDate = todayIST;
  return state;
}

// Check 3: No content or wrong day → Generate new
await generateDayContentGemini(...);
```

**Why this works**:
- ✅ Prevents regenerating on every refresh
- ✅ Saves API quota
- ✅ Content only regenerates when day advances
- ✅ Same content throughout the day

### **3. Day Advancement Rules**

**Two conditions must be met**:

```javascript
// Condition 1: User passed (≥76%)
const strong = evaluation.overallPercent >= 76;

// Condition 2: New IST calendar day
const todayIST = "2026-03-27";
const lastCompletionDate = state.lastDayCompletionDate;  // "2026-03-26"
const canAdvanceToday = lastCompletionDate !== todayIST;

// Both must be true
if (strong && canAdvanceToday) {
  state.currentDay++;  // Advance!
}
```

**Scenarios**:
- ✅ Pass at 11 PM → Advance to Day 2
- ✅ Pass Day 2 next morning → Advance to Day 3
- ❌ Pass Day 2 same day → Stay on Day 2 (already advanced today)
- ❌ Fail (50%) → Stay on same day, retry

### **4. Weekly Review (Day 7)**

**Special Logic**:

```javascript
// In dayGenerator.js
const dayType = dayNumber % 7 === 0 ? "weekly_review" : "normal";

if (dayType === "weekly_review") {
  // Collect vocabulary from Days 1-6
  const vocabWeekWords = [];
  for (let d = dayNumber - 6; d < dayNumber; d++) {
    vocabWeekWords.push(...state.vocabByDay[String(d)]);
  }
  
  // Generate vocab quiz from these words
  userPrompt.vocabWeekWords = vocabWeekWords;
  userPrompt.vocabQuizCount = 10;
}
```

**Day 7 Content**:
- Reviews grammar from Days 1-6
- Vocab quiz from all 60 words learned
- Higher pass threshold (80% vs 76%)
- Consolidates learning

---

## 📊 STATE MANAGEMENT

### **User State Structure**:

```javascript
{
  // Current position
  currentDay: 2,
  dayType: "normal",
  
  // Content cache
  dayContent: { /* Full day 2 content */ },
  dayContentGeneratedDate: "2026-03-28",
  
  // Progression tracking
  lastDayCompletionDate: "2026-03-27",
  lastEvaluation: { /* Day 1 results */ },
  
  // Learning history
  weakAreas: ["Article usage", "Verb forms"],
  grammarCoveredByDay: {
    "1": "Simple Present Tense",
    "2": "Articles (a, an, the)"
  },
  vocabByDay: {
    "1": ["routine", "activity", "daily", ...],
    "2": ["article", "noun", "vowel", ...]
  },
  
  // Performance
  tracker: {
    day: 2,
    totalDaysCompleted: 1,
    streak: 1,
    averageScore: 82,
    confidenceScore: {
      Grammar: 75,
      Speaking: 80,
      Writing: 85
    }
  },
  
  // Analytics
  scoreHistory: [
    { dayNumber: 1, overallPercent: 82, tier: "Strong" }
  ],
  attemptsByDay: {
    "1": 1  // Passed on first try
  }
}
```

---

## 🔧 TROUBLESHOOTING

### **Issue: Content regenerates on every refresh**

**Check**:
```javascript
// In getOrGenerateDayContent()
console.log(`dayNumber=${state.dayContent?.dayNumber}, currentDay=${state.currentDay}`);
console.log(`generatedDate=${state.dayContentGeneratedDate}, todayIST=${todayIST}`);
```

**Fix**: Ensure `dayContentGeneratedDate` is saved to DB

### **Issue: User can't advance to next day**

**Check**:
```javascript
// In updateStateAfterEvaluation()
console.log(`strong=${strong}, canAdvanceToday=${canAdvanceToday}`);
console.log(`lastCompletionDate=${state.lastDayCompletionDate}, todayIST=${todayIST}`);
```

**Possible causes**:
- Score < 76% → User must retry
- Already completed a day today → Wait until tomorrow (IST)

### **Issue: Topics repeat**

**Check**:
```javascript
// In dayGenerator.js
console.log(`grammarCoveredByDay:`, state.grammarCoveredByDay);
```

**Fix**: Ensure `grammarCoveredByDay` is updated after each day

---

## 📝 SUMMARY

**Complete Flow**:
1. User loads app → Check if content exists for current day
2. If no content → Generate via Gemini AI (topic based on level + weak areas)
3. Content cached in DB with IST date
4. User completes work → Submit for evaluation
5. AI evaluates → Score + feedback + todaySummary
6. If passed (≥76%) AND new IST day → Advance to next day
7. Next day → Generate new content (avoids previous topics, targets weak areas)
8. Repeat!

**Key Features**:
- ✅ Smart topic selection based on user performance
- ✅ Content caching prevents unnecessary API calls
- ✅ IST timezone prevents multiple advancements per day
- ✅ Weekly reviews consolidate learning
- ✅ Personalized progression based on weak areas
- ✅ Hindi translation practice (20 sentences per day)
