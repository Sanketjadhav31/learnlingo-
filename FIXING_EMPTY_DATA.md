# Fixing Empty Data Issue

## Problem
The lesson content shows empty fields with "—" placeholders because the Gemini API is not generating proper content.

## Root Cause
The Gemini model name in `server/.env` was incorrect: `gemini-3-flash-preview` (doesn't exist)

## Solution

### 1. Fix the Model Name
Updated `server/.env`:
```env
GEMINI_MODEL=gemini-1.5-flash
```

Valid Gemini model names:
- `gemini-1.5-flash` (recommended - fast and cost-effective)
- `gemini-1.5-pro` (more capable but slower)
- `gemini-1.0-pro` (older version)

### 2. Test the API

Run the test script to verify Gemini is working:
```bash
cd server
node test-gemini.js
```

Expected output:
```
✓ Model initialized
✓ API call successful!
✅ Gemini API is working correctly!
```

### 3. Reset User Data

After fixing the model, reset your user to regenerate content:

**Option A: Via UI**
1. Open the app in browser
2. Click "Reset" button in the header

**Option B: Via API**
```bash
curl -X POST http://localhost:3000/api/reset?userId=local-user
```

**Option C: Delete state file**
```bash
rm server/data/state_local-user.json
```

### 4. Restart the Server

```bash
cd server
npm start
```

### 5. Reload the App

1. Open http://localhost:5173 (or your client URL)
2. Click "Reload" button
3. The app will generate new day content with real data

## How It Works

### Data Flow:
1. **Client** requests day content → `/api/day?userId=local-user`
2. **Server** checks if day content exists
3. If not, calls **Gemini API** to generate lesson
4. **Gemini** returns JSON with:
   - Warm-up corrections (3 items)
   - Grammar explanations
   - Pronunciation guide (5 words)
   - Vocabulary (10 words)
   - Listening transcript + 3 questions
   - Speaking/Writing/Conversation tasks
   - Sentence practice prompts (20)
   - Questions (6)
5. **Server** normalizes and validates the data
6. **Server** saves to state file
7. **Client** displays the content

### Fallback Behavior:
If Gemini fails or returns incomplete data, the `dayNormalize.js` fills missing fields with:
- `"—"` for text fields
- `["learn", "practice"]` for collocations
- Default prompts like "Write sentence 1"

## Troubleshooting

### Issue: Still seeing "—" after fix

**Check 1: API Key**
```bash
# In server/.env, verify:
GOOGLE_API_KEY=AIzaSy...  # Should be your actual key
```

**Check 2: Model Name**
```bash
# Should be one of:
GEMINI_MODEL=gemini-1.5-flash
# or
GEMINI_MODEL=gemini-1.5-pro
```

**Check 3: Server Logs**
Look for errors in server console:
```
❌ Gemini API error: ...
```

Common errors:
- `Invalid API key` → Check your key
- `Model not found` → Fix model name
- `Quota exceeded` → Wait or upgrade plan
- `Timeout` → Increase timeout in code

**Check 4: Network Issues**
```bash
# Test connectivity
curl https://generativelanguage.googleapis.com/
```

### Issue: API quota exceeded

**Solution 1: Wait**
Free tier resets daily

**Solution 2: Upgrade**
Get a paid API key from Google AI Studio

**Solution 3: Use cached data**
The app caches generated content, so you only need API calls once per day

### Issue: Slow generation

**Cause:** Gemini API can take 10-60 seconds to generate a full lesson

**Solution:** 
- Use `gemini-1.5-flash` (faster)
- Increase timeout in `dayGenerator.js` (already set to 60s)
- Be patient on first load

## Verification

After fixing, you should see:

### Warm-up Corrections:
```
1) WRONG: I am go to school
   CORRECT: I go to school
2) WRONG: She don't like coffee
   CORRECT: She doesn't like coffee
3) WRONG: They is happy
   CORRECT: They are happy
```

### Pronunciation:
```
- student
  IPA: /ˈstuːdənt/
  Stress: First syllable
  Common: STOO-dent
  Correct: STEW-dent
```

### Vocabulary:
```
- student (noun)
  Definition: A person who is learning at a school or university
  Example: She is a student at Harvard University
  Collocations: university student, exchange student
  Synonym: learner, pupil
  Antonym: teacher
```

### Questions:
```
1) What is your name?
2) Where are you from?
3) How old are you?
4) What do you do?
5) Do you like English?
6) Why are you learning English?
```

## Summary

1. ✅ Fixed model name: `gemini-1.5-flash`
2. ✅ Updated default in code
3. ✅ Created test script
4. ✅ Reset user data
5. ✅ Restart server
6. ✅ Reload app

The app should now generate real, meaningful lesson content instead of placeholders!
