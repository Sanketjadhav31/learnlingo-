const { callGeminiJsonWithFallback } = require("./geminiClient");
const logger = require("../logger");

// 10 interview question types
const QUESTION_TYPES = [
  "Introduction",
  "Strength",
  "Weakness",
  "Project",
  "Teamwork",
  "Situational",
  "Career Goal",
  "Achievement",
  "Leadership",
  "Conflict"
];

/**
 * Get last 7 days of interview history for uniqueness
 */
function getLast7DaysHistory(state, currentDay) {
  const history = state.practiceHistory?.interview || [];
  const cutoffDay = currentDay - 7;
  
  return history
    .filter(entry => entry.day > cutoffDay && entry.day < currentDay)
    .sort((a, b) => b.day - a.day);
}

/**
 * Build context for Gemini prompt - what to avoid
 */
function buildAvoidanceContext(history) {
  if (!history || history.length === 0) {
    return "No recent history - generate fresh questions.";
  }
  
  const typeCount = {};
  const recentQuestions = [];
  
  history.forEach(entry => {
    entry.types?.forEach(type => {
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    entry.questionTexts?.forEach(q => recentQuestions.push(q));
  });
  
  let context = "RECENT HISTORY (last 7 days):\n";
  context += `Types used: ${JSON.stringify(typeCount)}\n`;
  context += `Recent questions:\n${recentQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
  
  return context;
}

/**
 * Generate 8 interview questions for a day using Gemini
 */
async function generateInterviewQuestionsGemini({ state, dayNumber, userId }) {
  const startTime = Date.now();
  logger.info(`🎤 Generating interview questions for day ${dayNumber}`);
  
  // Get history for uniqueness
  const history = getLast7DaysHistory(state, dayNumber);
  const avoidanceContext = buildAvoidanceContext(history);
  
  // Determine learner level based on day number
  let level = "Beginner";
  if (dayNumber > 60) level = "Advanced";
  else if (dayNumber > 30) level = "Intermediate";
  
  const systemPrompt = `You are an expert interview coach who has helped 1000+ software developers get jobs at top tech companies.

You know exactly what HR and behavioral questions are frequently asked in real interviews at companies like Google, Microsoft, Amazon, startups, and Indian IT companies.

Your job: Generate 8 realistic interview questions that sound like they come from an actual interviewer.

LEARNER CONTEXT:
- Day: ${dayNumber}
- Level: ${level}
- English proficiency: ${level}

QUESTION TYPES (generate exactly 1 of each, pick 8 from these 10):
${QUESTION_TYPES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

UNIQUENESS REQUIREMENT:
${avoidanceContext}

Your questions MUST be different in:
1. Exact wording/phrasing
2. The specific aspect of the topic being tested
3. The angle of approach

ANSWER COMPLEXITY:
- Beginner (Day 1-30): Simple, clear, 4-5 sentences. Basic vocabulary.
- Intermediate (Day 31-60): More sophisticated, 5-6 sentences. Professional tone.
- Advanced (Day 61+): Industry jargon, nuanced, 5-7 sentences. Senior-level depth.

STAR METHOD:
Use STAR (Situation → Task → Action → Result) for: Project, Teamwork, Situational, Achievement, Leadership, Conflict
Do NOT use STAR for: Introduction, Strength, Weakness, Career Goal

OUTPUT RULES:
- Return ONLY valid JSON
- Each question must have: question, type, modelAnswer, keyPoints (exactly 4), deliveryTip
- Model answers must sound natural, like a confident developer speaking
- Key points are a checklist of 4 most important things to cover
- Delivery tip is 1 practical sentence about how to deliver the answer (pause, use numbers, smile, etc.)`;

  const userPrompt = `Generate 8 interview practice questions for Day ${dayNumber}.

Pick 8 different types from the 10 available types.
Ensure variety and avoid repeating recent questions.

Return JSON array of 8 questions with this structure:
[
  {
    "questionId": "unique_id",
    "type": "Introduction",
    "question": "Tell me about yourself",
    "modelAnswer": "4-6 sentence natural answer using STAR if applicable",
    "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
    "deliveryTip": "One practical tip for delivery"
  }
]`;

  try {
    // Don't specify models - use default from geminiClient
    const jsonText = await callGeminiJsonWithFallback({
      systemPrompt,
      userPrompt,
      timeoutMs: 25000,
    });
    
    const questions = JSON.parse(jsonText);
    
    // Validate structure
    if (!Array.isArray(questions) || questions.length !== 8) {
      throw new Error(`Expected 8 questions, got ${questions?.length || 0}`);
    }
    
    // Validate each question
    questions.forEach((q, idx) => {
      if (!q.questionId || !q.type || !q.question || !q.modelAnswer || !Array.isArray(q.keyPoints) || !q.deliveryTip) {
        throw new Error(`Question ${idx + 1} missing required fields`);
      }
      if (q.keyPoints.length !== 4) {
        throw new Error(`Question ${idx + 1} must have exactly 4 key points`);
      }
    });
    
    const duration = Date.now() - startTime;
    logger.info(`✅ Interview questions generated in ${duration}ms`);
    
    return {
      questions,
      generatedAt: new Date().toISOString(),
      dayNumber,
      usedTypes: questions.map(q => q.type),
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Interview generation failed after ${duration}ms:`, error.message);
    throw error;
  }
}

/**
 * Update practice history with new questions
 */
function updateInterviewHistory(state, dayNumber, questions) {
  if (!state.practiceHistory) state.practiceHistory = {};
  if (!state.practiceHistory.interview) state.practiceHistory.interview = [];
  
  const entry = {
    day: dayNumber,
    types: questions.map(q => q.type),
    questionTexts: questions.map(q => q.question),
    generatedAt: new Date().toISOString(),
  };
  
  state.practiceHistory.interview.push(entry);
  
  // Keep only last 10 days of history (7 + buffer)
  state.practiceHistory.interview = state.practiceHistory.interview
    .filter(e => e.day > dayNumber - 10)
    .sort((a, b) => b.day - a.day);
}

module.exports = {
  generateInterviewQuestionsGemini,
  updateInterviewHistory,
  QUESTION_TYPES,
};
