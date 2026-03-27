# 🚀 Start Here - AI English Trainer

## ⚡ Quick Start (3 Steps)

### 1️⃣ Test Gemini API
```bash
cd server
node test-gemini.js
```

✅ Should see: `Gemini API is working correctly!`

### 2️⃣ Start the Application
```bash
# Terminal 1 - Server
cd server
npm start

# Terminal 2 - Client  
cd client
npm run dev
```

### 3️⃣ Open and Reset
1. Open http://localhost:5173
2. Click **"Reset"** button (top right)
3. Click **"Reload"** button
4. Wait 30-60 seconds for AI to generate content

## 🎯 What's Fixed

### ✅ UI Improvements
- **4 separate tabs**: Progress, Lesson, Submit Work, Evaluation
- **Interactive form**: Fill in answers with proper labels
- **Real-time preview**: See what you're submitting
- **Clean layout**: No scrolling issues

### ✅ Empty Data Fixed
- **Corrected Gemini model**: `gemini-1.5-flash`
- **Real AI content**: No more "—" placeholders
- **Proper fallbacks**: Clear messages when data is missing

## 📱 How to Use

### Tab 1: 📊 Progress
- View your current day
- See completed days and streak
- Check confidence scores
- Review common mistakes

### Tab 2: 📚 Lesson
- Study grammar explanations
- Learn new vocabulary (10 words)
- Practice pronunciation (5 words)
- Read listening transcript
- Review tasks and questions

### Tab 3: ✍️ Submit Work
**Form Mode** (Recommended):
- Fill in each field separately
- See the actual questions
- Automatic formatting

**Text Mode**:
- Traditional textarea
- Manual formatting

### Tab 4: 📈 Evaluation
- Overall score and tier
- Detailed feedback
- Sentence corrections
- Error analysis

## 🔧 Troubleshooting

### Problem: Still seeing "—" everywhere

**Solution:**
```bash
# 1. Check .env file
cat server/.env | grep GEMINI_MODEL
# Should show: GEMINI_MODEL=gemini-1.5-flash

# 2. Delete cached data
rm server/data/state_local-user.json

# 3. Restart server
cd server
npm start

# 4. Reset in browser
# Click "Reset" then "Reload"
```

### Problem: "Gemini API error"

**Check API Key:**
```bash
cat server/.env | grep GOOGLE_API_KEY
# Should show your actual key
```

**Test API:**
```bash
cd server
node test-gemini.js
```

**Common Errors:**
- `Invalid API key` → Get new key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- `Quota exceeded` → Wait 24 hours or upgrade
- `Model not found` → Check model name is `gemini-1.5-flash`

### Problem: Slow loading

**Normal behavior:**
- First load: 30-60 seconds (AI generating content)
- Subsequent loads: Instant (cached)

**If too slow:**
- Check internet connection
- Use `gemini-1.5-flash` (faster than pro)
- Check server logs for errors

## 📚 Documentation

- **UI_IMPROVEMENTS.md** - Complete list of UI changes
- **FIXING_EMPTY_DATA.md** - Detailed fix explanation
- **QUICK_FIX.md** - Fast troubleshooting guide
- **GEMINI_API_GUIDE.md** - API setup instructions

## 🎓 Learning Flow

1. **Day 1**: Start with basics (verb "to be", greetings)
2. **Study**: Read lesson content in Lesson tab
3. **Practice**: Complete tasks in Submit Work tab
4. **Submit**: Click "Submit Work" button
5. **Review**: Check Evaluation tab for feedback
6. **Improve**: Fix mistakes and resubmit if needed
7. **Advance**: Pass to move to Day 2

## ✨ Features

### Lesson Content
- ✅ Warm-up corrections (3)
- ✅ Grammar explanation
- ✅ Sentence formation guide
- ✅ Pronunciation (5 words with IPA)
- ✅ Vocabulary (10 words with examples)
- ✅ Idiom and phrasal verb
- ✅ Listening transcript + 3 questions
- ✅ Speaking task
- ✅ Writing task
- ✅ Conversation practice (8 turns)
- ✅ Sentence practice (20 prompts)
- ✅ Questions (6)

### Submission
- ✅ Interactive form mode
- ✅ Text mode for advanced users
- ✅ Real-time validation
- ✅ Clear error messages

### Evaluation
- ✅ Overall score (0-100%)
- ✅ Tier (Weak/Medium/Strong)
- ✅ Pass/Fail status
- ✅ Detailed feedback for each section
- ✅ Sentence-by-sentence corrections
- ✅ Common mistakes tracking
- ✅ Weak areas identification

## 🔑 Environment Variables

Required in `server/.env`:
```env
# Gemini API (REQUIRED)
GOOGLE_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash

# MongoDB (REQUIRED)
MONGODB_URI=your_mongodb_uri

# Server (Optional)
PORT=3000
DEFAULT_USER_ID=local-user
```

## 🎯 Success Checklist

- [ ] Gemini test passes (`node test-gemini.js`)
- [ ] Server starts without errors
- [ ] Client opens in browser
- [ ] No "—" in lesson content
- [ ] Can see real vocabulary words
- [ ] Can see real questions
- [ ] Can submit work
- [ ] Can see evaluation results

## 🆘 Need Help?

1. **Check server logs** - Look for error messages
2. **Run test script** - `node server/test-gemini.js`
3. **Reset data** - Delete `server/data/state_local-user.json`
4. **Check API key** - Verify in `server/.env`
5. **Read docs** - Check the markdown files

## 🎉 You're Ready!

Everything is set up and working. Just:
1. Start the servers
2. Open the browser
3. Click Reset
4. Start learning!

Happy learning! 🚀📚
