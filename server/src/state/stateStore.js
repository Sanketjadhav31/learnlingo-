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
      "Listening (6)": "Pending",
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
      const fp = filePathFor(userId);
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, "utf-8");
        if (raw.trim()) {
          const state = JSON.parse(raw);
          return state;
        }
      }
      const st = createEmptyState();
      fs.writeFileSync(fp, JSON.stringify(st, null, 2), "utf-8");
      return st;
    },
    async save(userId, state) {
      const fp = filePathFor(userId);
      fs.writeFileSync(fp, JSON.stringify(state, null, 2), "utf-8");
    },
    async reset(userId) {
      const fp = filePathFor(userId);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    },
  };
}

function mongoStoreFactory() {
  const UserState = getUserStateModel();
  return {
    async getOrCreate(userId) {
      let doc = await UserState.findOne({ userId }).lean();
      if (!doc) {
        const st = createEmptyState();
        await UserState.create({ userId, ...st });
        doc = await UserState.findOne({ userId }).lean();
      }
      const { _id, __v, createdAt, updatedAt, ...state } = doc;
      return state;
    },
    async save(userId, state) {
      await UserState.updateOne({ userId }, { $set: { ...state, userId } }, { upsert: true });
    },
    async reset(userId) {
      await UserState.deleteOne({ userId });
    },
  };
}

function stateStoreFactory({ mongoConn }) {
  if (mongoConn && mongoConn.enabled) {
    return mongoStoreFactory();
  }
  return fileStoreFactory();
}

module.exports = {
  stateStoreFactory,
  createEmptyState,
  createEmptyTracker,
};
