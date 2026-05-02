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
  
  const systemPrompt = `You are an expert interview coach preparing candidates for REAL job interviews at tech companies.

Your job: Generate 8 realistic interview questions that simulate an ACTUAL INTERVIEW MEETING scenario.

🎯 SCENARIO: The user is sitting in an interview room (or video call) with an interviewer. They need to respond naturally and professionally, as if they're really in the meeting.

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

QUESTION STYLE:
- Write questions as if an interviewer is SPEAKING to the candidate
- Use conversational, natural language (e.g., "So, tell me about...", "I'd like to hear about...", "Can you walk me through...")
- Make it feel like a real meeting conversation, not a written test

ANSWER STYLE:
- Write model answers in FIRST PERSON (I, me, my, we)
- Sound like someone SPEAKING in an interview, not writing an essay
- Use natural speech patterns: "Well, in my previous role...", "So what I did was...", "Looking back..."
- Include conversational connectors: "Actually", "You know", "Basically", "So"
- Make it sound confident but humble, professional but personable

ANSWER COMPLEXITY:
- Beginner (Day 1-30): Simple, clear, 4-5 sentences. Basic vocabulary. Natural pauses.
- Intermediate (Day 31-60): More sophisticated, 5-6 sentences. Professional tone. Smooth flow.
- Advanced (Day 61+): Industry jargon, nuanced, 5-7 sentences. Senior-level depth. Polished delivery.

STAR METHOD (for storytelling questions):
Use STAR (Situation → Task → Action → Result) for: Project, Teamwork, Situational, Achievement, Leadership, Conflict
Do NOT use STAR for: Introduction, Strength, Weakness, Career Goal

OUTPUT RULES:
- Return ONLY valid JSON
- Each question must have: question, type, modelAnswer, keyPoints (exactly 4), deliveryTip
- Model answers must sound like SPOKEN responses in a real interview
- Key points are a checklist of 4 most important things to mention
- Delivery tip focuses on: tone, pace, body language, eye contact, pausing, emphasis`;

  const userPrompt = `Generate 8 interview practice questions for Day ${dayNumber}.

🎯 CONTEXT: Simulate a REAL interview meeting. The candidate is sitting across from the interviewer (or on a video call).

REQUIREMENTS:
- Pick 8 different types from the 10 available types
- Questions should sound like an interviewer SPEAKING (conversational, natural)
- Model answers should be in FIRST PERSON and sound like SPOKEN responses
- Include natural speech patterns: "Well...", "So...", "Actually...", "You know..."
- Make answers sound confident but conversational, not scripted
- Ensure variety and avoid repeating recent questions

EXAMPLE QUESTION STYLE:
❌ Bad: "Describe a time when you demonstrated leadership"
✅ Good: "So, can you tell me about a time when you had to step up and lead a team?"

EXAMPLE ANSWER STYLE:
❌ Bad: "I demonstrated leadership by organizing team meetings and delegating tasks effectively."
✅ Good: "Well, in my last project, I actually had to step up when our team lead was out sick. So what I did was, I organized daily standups to keep everyone aligned, and I made sure to delegate tasks based on each person's strengths. It worked out really well—we delivered on time and the team felt more connected."

Return JSON array of 8 questions with this structure:
[
  {
    "questionId": "day${dayNumber}_q1",
    "type": "Introduction",
    "question": "So, tell me a bit about yourself and your background",
    "modelAnswer": "Well, I'm a software developer with about 2 years of experience. I actually started my career at a startup where I worked on building web applications using React and Node.js. What I really enjoy is solving complex problems and working with teams to create products that users love. Right now, I'm looking to grow my skills and take on more challenging projects.",
    "keyPoints": ["Current role and experience", "Technical skills and stack", "What you enjoy about your work", "Career goals and motivation"],
    "deliveryTip": "Maintain eye contact, speak with confidence but stay humble, and keep it under 2 minutes"
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
