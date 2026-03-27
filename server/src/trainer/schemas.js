const { z } = require("zod");

const WordSchema = z.object({
  word: z.string().min(1),
  pos: z.string().min(1),
  definition: z.string().min(1),
  example: z.string().min(1),
  collocations: z.array(z.string().min(1)).min(2).max(4),
  synonym: z.string(), // Allow empty - Gemini sometimes doesn't provide
  antonym: z.string(), // Allow empty - Gemini sometimes doesn't provide
});

const PronunciationWordSchema = z.object({
  word: z.string().min(1),
  ipa: z.string().min(1),
  stress: z.string(), // Allow empty - not always provided
  mis: z.string().min(1),
  correct: z.string().min(1),
});

const SentencePracticeItemSchema = z.object({
  k: z.number().int().min(1),
  prompt: z.string().min(1),
});

const HindiTranslationItemSchema = z.object({
  k: z.number().int().min(1),
  hindiSentence: z.string().min(1),
});

const QuestionItemSchema = z.object({
  idx: z.number().int().min(1),
  prompt: z.string().min(1),
});

const ListeningQuestionSchema = z.object({
  idx: z.number().int().min(1),
  prompt: z.string(), // Allow empty - will be filtered in UI
});

const DayContentSchema = z.object({
  dayNumber: z.number().int().min(1),
  dayType: z.enum(["normal", "weekly_review"]),
  submissionTemplate: z.object({
    type: z.enum(["normal", "weekly_review"]),
    sentenceCount: z.number().int().min(1),
    hindiTranslationCount: z.number().int().min(1),
    questionCount: z.number().int().min(1),
    listeningCount: z.number().int().min(1),
    reflectionCount: z.number().int().min(1).max(5),
    conversationMinTurns: z.number().int().min(1),
    vocabQuizCount: z.number().int().min(0).optional(),
  }),
  dayTheme: z.string().min(1),
  grammarFocus: z.string().min(1),
  warmUpCorrections: z
    .array(z.object({ wrong: z.string().min(1), correct: z.string().min(1) }))
    .min(3)
    .max(3),
  grammarExplanationText: z.string().min(1),
  sentenceFormationText: z.string().min(1),
  pronunciation: z.object({
    title: z.string().min(1),
    words: z.array(PronunciationWordSchema).length(5),
    tongueTwister: z.string().min(1),
  }),
  vocabAndTracks: z.object({
    wordOfDay: z.array(WordSchema).length(10),
    idiom: z.string().min(1),
    phrasal: z.string().min(1),
  }),
  listening: z.object({
    title: z.string().min(1),
    transcript: z.string().min(1),
    questions: z.array(ListeningQuestionSchema).length(3),
  }),
  speakingTask: z.object({
    prompt: z.string().min(1),
  }),
  writingTask: z.object({
    prompt: z.string().min(1),
    requiredIdiom: z.string().min(1),
    requiredPhrasal: z.string().min(1),
  }),
  conversationTask: z.object({
    prompt: z.string().min(1),
  }),
  sentencePractice: z.object({
    items: z.array(SentencePracticeItemSchema),
  }),
  hindiTranslation: z.object({
    items: z.array(HindiTranslationItemSchema),
  }),
  questions: z.object({
    items: z.array(QuestionItemSchema),
  }),
  vocabQuiz: z
    .object({
      items: z.array(QuestionItemSchema),
    })
    .optional(),
});

const SentenceEvaluationSchema = z.object({
  k: z.number().int().min(1),
  correctness: z.enum(["Correct", "Incorrect"]),
  errorReason: z.string(),
  original: z.string().optional(),
  correctVersion: z.string().min(1),
  naturalVersion: z.string().min(1),
});

const EvaluationSchema = z.object({
  overallPercent: z.number().min(0).max(100),
  tier: z.enum(["Weak", "Medium", "Strong"]),
  passFail: z.enum(["PASS", "FAIL"]),
  scoreBreakdown: z.object({
    sentencesPercent: z.number().min(0).max(100),
    writingPercent: z.number().min(0).max(100),
    speakingPercent: z.number().min(0).max(100),
    conversationPercent: z.number().min(0).max(100),
    questionsPercent: z.number().min(0).max(100),
    listeningPercent: z.number().min(0).max(100),
  }),
  sentenceEvaluations: z.array(SentenceEvaluationSchema),
  writing: z.object({
    scorePercent: z.number().min(0).max(100),
    issues: z.array(z.string()),
    feedback: z.string(),
    improvedVersion: z.string().optional(),
  }),
  speaking: z.object({
    scorePercent: z.number().min(0).max(100),
    issues: z.array(z.string()),
    feedback: z.string(),
    improvedPlan: z.string().optional(),
  }),
  conversation: z.object({
    scorePercent: z.number().min(0).max(100),
    issues: z.array(z.string()),
    feedback: z.string(),
  }),
  questions: z.object({
    scorePercent: z.number().min(0).max(100),
    answers: z.array(
      z.object({
        k: z.number().int().min(1),
        correctness: z.enum(["Correct", "Incorrect"]),
        correctVersion: z.string().optional(),
        errorReason: z.string().optional(),
      })
    ),
  }),
  listening: z.object({
    scorePercent: z.number().min(0).max(100),
    answers: z.array(
      z.object({
        k: z.number().int().min(1),
        correctness: z.enum(["Correct", "Incorrect"]),
        correctVersion: z.string().optional(),
        errorReason: z.string().optional(),
      })
    ),
  }),
  vocabQuiz: z
    .object({
      scorePercent: z.number().min(0).max(100),
      answers: z.array(
        z.object({
          k: z.number().int().min(1),
          correctness: z.enum(["Correct", "Incorrect"]),
          correctVersion: z.string().optional(),
          errorReason: z.string().optional(),
        })
      ),
    })
    .optional(),
  commonMistakesTop3: z.array(z.string()).min(3).max(3),
  weakAreas: z.array(z.string()).min(1).max(10),
  todaySummary: z.object({
    topic: z.string().min(1),
    levelLabel: z.enum(["Beginner", "Intermediate", "Advanced"]),
    dayNumber: z.number().int().min(1),
    keyGrammarPoints: z.array(z.string().min(1)),
    keyVocabulary: z.array(
      z.object({
        word: z.string().min(1),
        partOfSpeech: z.string().min(1),
        meaning: z.string().min(1),
        exampleUse: z.string().min(1),
      })
    ),
    grammarSummary: z.string().min(150), // Minimum 150 words
    topicNotes: z.string().min(150), // Minimum 150 words
    topicUsageTip: z.string().min(1),
    quickRecap: z.array(z.string().min(1)).min(3).max(5),
    reviewReminder: z.string().min(1),
  }),
});

module.exports = {
  DayContentSchema,
  EvaluationSchema,
};

