const fs = require("fs");
const path = require("path");
const { getUserStateModel } = require("../mongo/models/UserState");

function createEmptyTracker(day = 1) {
  return {
    day,
    totalDaysCompleted: 0,
    streak: 0,
    longestStreak: 0,
    totalSubmissions: 0,
    totalTimeSpentMinutes: 0,
    averageScore: 0,
    scoreHistory: [],
    todayWorkStatus: {
      Grammar: "Pending",
      Speaking: "Pending",
      Writing: "Pending",
      Conversation: "Pending",
      "Sentences (20)": "Pending",
      Questions: "Pending",
      "Listening (3)": "Pending",
      Reflection: "Pending",
    },
    finalStatus: "Not Started",
    confidenceScore: { Grammar: 0, Speaking: 0, Writing: 0 },
    commonMistakes: ["-", "-", "-"],
  };
}

function createEmptyState() {
  return {
    currentDay: 1,
    dayContent: null,
    dayType: "normal",
    scoreHistory: [],
    vocabByDay: {},
    grammarCoveredByDay: {},
    weakAreas: [],
    weakGrammarAreas: [],
    weakVocabAreas: [],
    confidentTopics: [],
    attemptsByDay: {},
    dailyAnalytics: {},
    streakShieldUsed: false,
    consecutiveFailsOnCurrentDay: 0,
    catchUpMode: false,
    lastSubmissionParsed: null,
    lastEvaluation: null,
    tracker: createEmptyTracker(1),
    dayProgress: {},
    errorPatternLog: {
      tenseErrors: 0,
      articleErrors: 0,
      prepositionErrors: 0,
      subjectVerbAgreement: 0,
      wordOrderErrors: 0,
      vocabularyMisuse: 0,
      spellingErrors: 0,
      questionFormation: 0,
      negativeFormErrors: 0,
      doDoesErrors: 0,
      ingFormErrors: 0,
    },
  };
}

function fileStoreFactory() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  function filePathFor(userId) {
    const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(dir, `state_${safe}.json`);
  }

  return {
    async getOrCreate(userId) {
      console.log(`      📁 FileStore: Loading state for user ${userId}`);
      const fp = filePathFor(userId);
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, "utf-8");
        if (raw.trim()) {
          const state = JSON.parse(raw);
          console.log(`      ✓ FileStore: State loaded - Day ${state.currentDay}`);
          return state;
        }
      }
      console.log(`      📝 FileStore: Creating new state for user ${userId}`);
      const st = createEmptyState();
      fs.writeFileSync(fp, JSON.stringify(st, null, 2), "utf-8");
      return st;
    },
    async save(userId, state) {
      console.log(`      💾 FileStore: Saving state for user ${userId} - Day ${state.currentDay}`);
      const fp = filePathFor(userId);
      fs.writeFileSync(fp, JSON.stringify(state, null, 2), "utf-8");
      console.log(`      ✓ FileStore: State saved successfully`);
    },
    async reset(userId) {
      console.log(`      🗑️ FileStore: Resetting state for user ${userId}`);
      const fp = filePathFor(userId);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      console.log(`      ✓ FileStore: State reset complete`);
    },
  };
}

function mongoStoreFactory() {
  const UserState = getUserStateModel();
  return {
    async getOrCreate(userId) {
      console.log(`      💾 MongoDB: Loading state for user ${userId}`);
      let doc = await UserState.findOne({ userId }).lean();
      if (!doc) {
        console.log(`      📝 MongoDB: Creating new state for user ${userId}`);
        const st = createEmptyState();
        await UserState.create({ userId, ...st });
        doc = await UserState.findOne({ userId }).lean();
      } else {
        console.log(`      ✓ MongoDB: State loaded - Day ${doc.currentDay}`);
      }
      const { _id, __v, createdAt, updatedAt, ...state } = doc;
      return state;
    },
    async save(userId, state) {
      console.log(`      💾 MongoDB: Saving state for user ${userId} - Day ${state.currentDay}`);
      await UserState.updateOne({ userId }, { $set: { ...state, userId } }, { upsert: true });
      console.log(`      ✓ MongoDB: State saved successfully`);
    },
    async reset(userId) {
      console.log(`      🗑️ MongoDB: Resetting state for user ${userId}`);
      await UserState.deleteOne({ userId });
      console.log(`      ✓ MongoDB: State reset complete`);
    },
  };
}

function stateStoreFactory({ mongoConn }) {
  if (mongoConn && mongoConn.enabled) {
    console.log("📦 Using MongoDB state store");
    return mongoStoreFactory();
  }
  console.log("📦 Using File-based state store");
  return fileStoreFactory();
}

module.exports = {
  stateStoreFactory,
  createEmptyState,
  createEmptyTracker,
};
