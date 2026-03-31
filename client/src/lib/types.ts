export type WorkStatusValue = "Pending" | "Submitted" | "Checked";

export type Tracker = {
  day: number;
  totalDaysCompleted: number;
  streak: number;
  todayWorkStatus: Record<string, WorkStatusValue>;
  finalStatus: "Not Started" | "Waiting for Submission" | "Under Review" | "Completed" | "Failed";
  confidenceScore: {
    Grammar: number;
    Speaking: number;
    Writing: number;
  };
  commonMistakes: (string | { mistake: string; example: string; correction: string })[];
};

export type DayContent = {
  dayNumber: number;
  dayType: "normal" | "weekly_review";
  dayTheme: string;
  grammarFocus: string;
  warmUpCorrections: { wrong: string; correct: string }[];
  submissionTemplate: {
    type: "normal" | "weekly_review";
    sentenceCount: number;
    hindiTranslationCount: number;
    questionCount: number;
    listeningCount: number;
    reflectionCount: number;
    conversationMinTurns: number;
    vocabQuizCount?: number;
  };
  grammarExplanationText: string;
  sentenceFormationText: string;
  pronunciation: {
    title: string;
    words: { 
      word: string; 
      ipa: string; 
      stress: string; 
      hindiMeaning?: string; 
      examples?: string[];
      exampleSentence?: string; // Keep for backward compatibility
      mis?: string; // Keep for backward compatibility
      correct: string;
    }[];
    tongueTwister: string;
  };
  vocabAndTracks: {
    wordOfDay: {
      word: string;
      pos: string;
      definition: string;
      hindiMeaning?: string;
      examples?: string[];
      example?: string; // Keep for backward compatibility
      collocations?: string[]; // Keep for backward compatibility
      synonym?: string; // Keep for backward compatibility
      antonym?: string; // Keep for backward compatibility
    }[];
    idiom: string;
    phrasal: string;
  };
  listening: {
    title: string;
    transcript: string;
    questions: { idx: number; prompt: string }[];
  };
  speakingTask: { prompt: string };
  writingTask: { prompt: string; requiredIdiom: string; requiredPhrasal: string };
  conversationTask: { prompt: string };
  sentencePractice: { items: { k: number; prompt: string }[] };
  hindiTranslation: { items: { k: number; hindiSentence: string }[] };
  questions: { items: { idx: number; prompt: string }[] };
  vocabQuiz?: { items: { idx: number; prompt: string }[] };
};

export type SentenceEvaluation = {
  k: number;
  correctness: "Correct" | "Incorrect" | "Partially Correct";
  errorReason: string;
  errorType?: string;
  tip?: string;
  original?: string;
  correctVersion: string;
  naturalVersion: string;
  penalties?: {
    capitalization?: number;
    punctuation?: number;
    spelling?: number;
    grammar?: number;
    total?: number;
  };
};

export type Evaluation = {
  overallPercent: number;
  tier: "Weak" | "Medium" | "Strong";
  passFail: "PASS" | "FAIL";
  motivationalMessage?: string;
  strengths?: string[];
  improvementFocus?: string;
  scoreBreakdown: {
    sentencesPercent: number;
    hindiTranslationPercent?: number;
    writingPercent: number;
    speakingPercent: number;
    conversationPercent: number;
    questionsPercent: number;
    listeningPercent: number;
  };
  sentenceEvaluations: SentenceEvaluation[];
  hindiTranslation?: {
    scorePercent: number;
    answers: {
      k: number;
      correctness: "Correct" | "Incorrect" | "Partially Correct";
      correctVersion?: string;
      errorReason?: string;
      feedback?: string;
      original?: string;
    }[];
  };
  writing: { 
    scorePercent: number; 
    issues: string[]; 
    feedback: string; 
    improvedVersion?: string;
    original?: string;
    corrected?: string;
    improvements?: string[];
  };
  speaking: { 
    scorePercent: number; 
    issues: string[]; 
    feedback: string; 
    improvedPlan?: string;
    original?: string;
    corrected?: string;
    improvements?: string[];
  };
  conversation: { 
    scorePercent: number; 
    issues: string[]; 
    feedback: string;
    original?: string;
    corrected?: string;
    improvements?: string[];
  };
  questions: { 
    scorePercent: number; 
    answers: { 
      k: number; 
      correctness: "Correct" | "Incorrect" | "Partially Correct"; 
      original?: string;
      correctVersion?: string; 
      errorReason?: string;
      feedback?: string;
    }[] 
  };
  listening: { 
    scorePercent: number; 
    answers: { 
      k: number; 
      correctness: "Correct" | "Incorrect" | "Partially Correct"; 
      original?: string;
      correctVersion?: string; 
      errorReason?: string;
      feedback?: string;
    }[] 
  };
  commonMistakesTop3: { mistake: string; example: string; correction: string }[];
  weakAreas: string[];
  todaySummary?: {
    topic: string;
    levelLabel?: string;
    dayNumber?: number;
    keyGrammarPoints: string[];
    keyVocabulary: { word: string; partOfSpeech: string; meaning: string; exampleUse: string }[];
    grammarSummary: string;
    topicNotes: string;
    quickRecap: string[];
    topicUsageTip?: string;
    reviewReminder?: string;
  };
};

export type DayProgress = {
  dayNumber: number;
  sectionsRead: Record<string, boolean>;
  sectionsReadCount: number;
  totalSections: number;
  readPercentage: number;
  submissionStatus: "not_started" | "submitted" | "evaluated";
  evaluationResult: null | { overallPercent: number; tier: "Weak" | "Medium" | "Strong"; passFail: "PASS" | "FAIL" };
  dayCompleted: boolean;
  dayAdvanced: boolean;
  canSubmit: boolean;
  requiredSections: number;
};

