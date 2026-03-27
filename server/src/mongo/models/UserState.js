const mongoose = require("mongoose");

const TrackerSchema = new mongoose.Schema(
  {
    day: Number,
    totalDaysCompleted: Number,
    streak: Number,
    longestStreak: Number,
    totalSubmissions: Number,
    totalTimeSpentMinutes: Number,
    averageScore: Number,
    scoreHistory: { type: mongoose.Schema.Types.Mixed, default: [] },
    todayWorkStatus: mongoose.Schema.Types.Mixed,
    finalStatus: String,
    confidenceScore: mongoose.Schema.Types.Mixed,
    commonMistakes: [String],
  },
  { _id: false }
);

const UserStateSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, unique: true, required: true },
    currentDay: { type: Number, required: true },
    dayContent: { type: mongoose.Schema.Types.Mixed, default: null },
    dayType: { type: String, default: "normal" },
    tracker: { type: TrackerSchema, required: true },
    dayProgress: { type: mongoose.Schema.Types.Mixed, default: {} },
    errorPatternLog: { type: mongoose.Schema.Types.Mixed, required: true },
    scoreHistory: { type: mongoose.Schema.Types.Mixed, default: [] },
    vocabByDay: { type: mongoose.Schema.Types.Mixed, default: {} },
    grammarCoveredByDay: { type: mongoose.Schema.Types.Mixed, default: {} },
    weakAreas: { type: mongoose.Schema.Types.Mixed, default: [] },
    weakGrammarAreas: { type: mongoose.Schema.Types.Mixed, default: [] },
    weakVocabAreas: { type: mongoose.Schema.Types.Mixed, default: [] },
    confidentTopics: { type: mongoose.Schema.Types.Mixed, default: [] },
    attemptsByDay: { type: mongoose.Schema.Types.Mixed, default: {} },
    dailyAnalytics: { type: mongoose.Schema.Types.Mixed, default: {} },
    streakShieldUsed: { type: Boolean, default: false },
    consecutiveFailsOnCurrentDay: { type: Number, default: 0 },
    catchUpMode: { type: Boolean, default: false },
    lastSubmissionParsed: { type: mongoose.Schema.Types.Mixed, default: null },
    lastEvaluation: { type: mongoose.Schema.Types.Mixed, default: null },
    currentTest: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

function getUserStateModel() {
  return mongoose.models.UserState || mongoose.model("UserState", UserStateSchema);
}

module.exports = { getUserStateModel };

