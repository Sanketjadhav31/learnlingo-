# AI Personal English Trainer

An intelligent, adaptive English learning platform powered by Google Gemini AI. Features personalized daily lessons, real-time evaluation, cumulative testing, and smart context compression for optimal learning progression.

## 🚀 Features

### Core Learning System
- **Adaptive Daily Lessons**: AI-generated content tailored to your level and progress
- **Comprehensive Content**: Grammar, vocabulary, pronunciation, listening, speaking, writing, and conversation practice
- **Real-time Evaluation**: Instant feedback with detailed corrections and improvement suggestions
- **Progress Tracking**: Streak tracking, confidence scores, and performance analytics
- **Smart Context Compression**: Efficient learner profiling that reduces token usage by 70% while improving personalization

### Advanced Features
- **Cumulative Testing**: Optional tests covering multiple days of material (unlocked at ≥76% daily score)
- **Auto-save System**: Debounced auto-save prevents data loss (300ms delay, 70% fewer network requests)
- **Enhanced Evaluation**: Motivational messages, strengths highlighting, error type classification, and learning tips
- **Weak Area Tracking**: Persistent tracking of common mistakes with frequency analysis
- **Vocabulary Memory**: Smart vocabulary tracking to avoid repetition and reinforce learning

### Technical Highlights
- **5-Layer Learner Context**: Identity, curriculum trajectory, diagnostic profile, vocabulary memory, and daily brief
- **Token Optimization**: Compressed context (~830 tokens vs 2000-4000 tokens previously)
- **Security**: Correct answers stripped from API responses until evaluation complete
- **Performance**: Optimized payloads (28% reduction), debounced saves, loading states

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express
- **Database**: MongoDB (with local file fallback)
- **AI**: Google Gemini 1.5 Flash
- **Authentication**: JWT-based auth system

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (optional - falls back to local file storage)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

## ⚡ Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd <repo-name>

# Install dependencies
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Configure Environment

Create `server/.env` (copy from `.env.example`):

```env
# Required
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Required
MONGODB_URI=your_mongodb_connection_string

# Optional
PORT=3000
DEFAULT_USER_ID=local-user
JWT_SECRET=your_jwt_secret
```

### 3. Test Gemini API

```bash
cd server
node test-gemini.js
```

You should see: `✅ Gemini API is working correctly!`

### 4. Start Development Servers

```bash
# From root directory
npm run dev
```

This starts both servers concurrently:
- **Client**: http://localhost:5173
- **Server**: http://localhost:3000

### 5. Start Learning

1. Open http://localhost:5173
2. Click **Reset** button (top right)
3. Click **Reload** button
4. Wait 30-60 seconds for AI to generate Day 1 content
5. Start learning!

## 📚 How to Use

### Daily Learning Flow

1. **Progress Tab**: View your current day, streak, scores, and weak areas
2. **Lesson Tab**: Study grammar, vocabulary, pronunciation, and practice materials
3. **Submit Work Tab**: Complete tasks using interactive form or text mode
4. **Evaluation Tab**: Review detailed feedback, corrections, and learning summary

### Cumulative Tests

- Unlocked when you score ≥76% on daily evaluation
- 20 questions covering multiple days of material
- Question types: MCQ, multi-correct, fill-in-blank, short writing
- Auto-saved answers (never lose progress)
- Pass threshold: 70% (14/20 questions)
- Retake with same questions or generate new test

## 🏗️ Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── lib/          # API client and types
│   │   ├── App.tsx       # Main app
│   │   └── test.tsx      # Test route entry
│   └── vite.config.ts    # Vite configuration
│
├── server/                # Express backend
│   ├── src/
│   │   ├── auth.js       # Authentication
│   │   ├── index.js      # API routes
│   │   ├── mongo/        # MongoDB models
│   │   ├── state/        # State management
│   │   └── trainer/      # AI training system
│   │       ├── contextBuilder.js      # 5-layer context compression
│   │       ├── briefBuilder.js        # Daily strategic directive
│   │       ├── contextValidator.js    # Context validation
│   │       ├── dayGenerator.js        # Lesson generation
│   │       ├── evaluationService.js   # Evaluation logic
│   │       ├── testGenerator.js       # Cumulative test generation
│   │       ├── testEvaluator.js       # Test evaluation
│   │       └── geminiClient.js        # Gemini API client
│   └── data/             # Local file storage fallback
│
└── docs/                 # Documentation files
```

## 🧪 Testing

### Test Gemini API
```bash
cd server
node test-gemini.js
```

### Test Context Compression
```bash
cd server
node test-context-compression.js
```

### Test Performance Optimization
```bash
cd server
node test-performance-optimization.js
```

## 🔧 Available Scripts

### Root
- `npm run dev` - Start both client and server in development mode
- `npm run server` - Start server only
- `npm run client` - Start client only
- `npm run build` - Build client for production
- `npm start` - Start server in production mode

### Server
- `npm --prefix server start` - Start server
- `npm --prefix server run dev` - Start server with nodemon

### Client
- `npm --prefix client run dev` - Start Vite dev server
- `npm --prefix client run build` - Build for production
- `npm --prefix client run preview` - Preview production build

## 📖 Documentation

- **START_HERE.md** - Quick start guide and troubleshooting
- **CUMULATIVE_TEST_IMPLEMENTATION.md** - Cumulative test system details
- **LEARNER_CONTEXT_COMPRESSION_IMPLEMENTATION.md** - Context compression system
- **PERFORMANCE_OPTIMIZATION.md** - Performance improvements
- **NEW_FEATURES_ADDED.md** - Enhanced evaluation features
- **TEST_API_DOCUMENTATION.md** - API endpoint documentation
- **TEST_USER_GUIDE.md** - User guide for cumulative tests

## 🔐 Security

- API keys and database credentials stored in `.env` (never committed)
- JWT-based authentication
- Correct answers stripped from API responses during tests
- Input validation and sanitization
- MongoDB injection prevention

## 🚀 Deployment

### Build for Production

```bash
# Build client
npm run build

# Start production server
npm start
```

### Environment Variables for Production

Ensure these are set in your production environment:
- `GOOGLE_API_KEY`
- `GEMINI_MODEL`
- `MONGODB_URI`
- `JWT_SECRET`
- `PORT` (optional, defaults to 3000)

## 🐛 Troubleshooting

### Still seeing "—" placeholders?
1. Check `.env` has correct `GEMINI_MODEL=gemini-1.5-flash`
2. Delete `server/data/state_local-user.json`
3. Restart server
4. Click Reset → Reload in browser

### Gemini API errors?
1. Verify API key: `cat server/.env | grep GOOGLE_API_KEY`
2. Test API: `node server/test-gemini.js`
3. Check quota at [Google AI Studio](https://makersuite.google.com/app/apikey)

### Slow loading?
- First load: 30-60 seconds (AI generating content) - normal
- Subsequent loads: Instant (cached)
- Use `gemini-1.5-flash` for faster generation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Google Gemini AI for powering the intelligent content generation
- MongoDB for flexible data storage
- React and Tailwind CSS for the modern UI

## 📞 Support

For issues, questions, or suggestions:
1. Check the documentation files in the repo
2. Review troubleshooting section above
3. Open an issue on GitHub

---

**Happy Learning! 🎓📚**

