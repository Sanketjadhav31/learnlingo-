# Quick Fix for Empty Data

## The Problem
You're seeing "—" everywhere because the Gemini AI model name was wrong.

## The Fix (3 steps)

### Step 1: Already Fixed ✅
The model name in `server/.env` has been corrected to:
```
GEMINI_MODEL=gemini-1.5-flash
```

### Step 2: Test the API
```bash
cd server
node test-gemini.js
```

If you see `✅ Gemini API is working correctly!` → proceed to Step 3

If you see errors:
- **Invalid API key** → Check your `GOOGLE_API_KEY` in `server/.env`
- **Model not found** → The fix didn't apply, manually edit `server/.env`
- **Quota exceeded** → Wait a few hours or get a new API key

### Step 3: Reset and Reload

**Terminal 1 (Server):**
```bash
cd server
npm start
```

**Terminal 2 (Client):**
```bash
cd client
npm run dev
```

**Browser:**
1. Open http://localhost:5173
2. Click "Reset" button (top right)
3. Click "Reload" button
4. Wait 30-60 seconds for AI to generate content
5. Check the "📚 Lesson" tab

## What You Should See

Instead of:
```
1) WRONG: —    CORRECT: —
```

You should see:
```
1) WRONG: I am go to school
   CORRECT: I go to school
```

Instead of:
```
- — (—)
  Definition: —
```

You should see:
```
- student (noun)
  Definition: A person who is learning at a school
  Example: She is a student at Harvard
```

## Still Not Working?

### Check Server Logs
Look for:
```
✓ Day content generated successfully
```

If you see:
```
❌ Gemini API error: ...
```

Then:
1. Check your API key is valid
2. Check you have quota remaining
3. Check your internet connection

### Manual Reset
```bash
# Stop the server (Ctrl+C)
rm server/data/state_local-user.json
cd server
npm start
```

Then reload the browser.

## Why This Happened

The `.env` file had:
```
GEMINI_MODEL=gemini-3-flash-preview  ❌ (doesn't exist)
```

Should be:
```
GEMINI_MODEL=gemini-1.5-flash  ✅ (correct)
```

When the model name is wrong, the API fails silently and the app fills everything with placeholder "—" values.

## Success Indicators

✅ Server logs show: `✓ Day content generated successfully`
✅ No "—" in lesson content
✅ Real sentences in warm-up corrections
✅ Real words in vocabulary section
✅ Real questions in questions section
✅ Can submit work and get evaluation

That's it! Your app should now work with real AI-generated content.
