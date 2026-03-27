# Data Flow: Submission to Evaluation Display

## 1. User Submits Work
```
User types in SubmissionEditor:
- Writing Task: "I like coding..."
- Sentences: 20 sentences
- Questions: 6 answers
- etc.
```

## 2. API Receives Submission (`POST /api/submit`)
```javascript
{
  submissionText: "DAY 1 SUBMISSION\n\n1. Writing Task:\nI like coding...\n\n2. Sentences:\n1. I am learning...\n2. She goes..."
}
```

## 3. Server Parses Submission
```javascript
parsed = {
  sentencePractice: [
    { k: 1, text: "I am learning English" },
    { k: 2, text: "She goes to school" },
    // ... 20 total
  ],
  questions: [
    { k: 1, text: "answer 1" },
    // ... 6 total
  ],
  writingTask: "I like coding...",
  speakingTask: "...",
  conversationPractice: "...",
  listening: [...],
  reflection: [...]
}
```

## 4. Gemini AI Evaluates
**Sends to Gemini:**
- User's parsed submission
- Day content (prompts, grammar focus)
- Previous performance

**Gemini Returns:**
```javascript
{
  overallPercent: 85,
  tier: "Strong",
  passFail: "PASS",
  sentenceEvaluations: [
    {
      k: 1,
      correctness: "Correct",
      errorReason: "N/A",
      original: "",  // ❌ PROBLEM: Gemini doesn't return this
      correctVersion: "I am learning English.",
      naturalVersion: "I'm learning English."
    },
    {
      k: 2,
      correctness: "Incorrect",
      errorReason: "Missing article 'the'",
      original: "",  // ❌ PROBLEM
      correctVersion: "She goes to the school.",
      naturalVersion: "She goes to school."
    }
  ],
  writing: { scorePercent: 80, feedback: "Good work..." },
  speaking: { scorePercent: 90, feedback: "..." },
  // ... etc
}
```

## 5. Server Merges Original Text (NEW FIX)
```javascript
// After getting Gemini response, we merge user's original text:
evaluation.sentenceEvaluations = evaluation.sentenceEvaluations.map(evalItem => {
  const userSentence = parsed.sentencePractice.find(s => s.k === evalItem.k);
  return {
    ...evalItem,
    original: userSentence?.text || evalItem.original || ""
  };
});

// Now it looks like:
sentenceEvaluations: [
  {
    k: 1,
    correctness: "Correct",
    errorReason: "N/A",
    original: "I am learning English",  // ✅ FIXED
    correctVersion: "I am learning English.",
    naturalVersion: "I'm learning English."
  }
]
```

## 6. Client Displays in EvaluationPanel
```typescript
// EvaluationPanel.tsx shows:
filtered.map(s => (
  <button>
    <div>#{s.k}</div>
    <div>{s.correctness}</div>
    <div>{s.original}</div>  // ✅ Now shows user's text
  </button>
  
  {expanded && (
    <div>
      Original: {s.original}
      Correct: {s.correctVersion}
      Natural: {s.naturalVersion}
      Reason: {s.errorReason}
    </div>
  )}
))
```

## Summary

**Problem:** Gemini wasn't returning the user's original sentences in the evaluation

**Solution:** After Gemini evaluation, we merge the user's original text from `parsed.sentencePractice` back into `sentenceEvaluations`

**Result:** UI now shows:
- #1 Correct - "I am learning English" (user's actual text)
- Click to expand → shows corrections and natural versions
