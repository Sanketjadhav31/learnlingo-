const { callGeminiJsonWithFallback } = require("./geminiClient");
const logger = require("../logger");

// 10 subjects with their topic pools
const SUBJECTS = {
  Python: [
    "lists", "dicts", "OOP", "decorators", "generators", "comprehensions",
    "asyncio", "GIL", "memory management", "built-in functions", "file handling",
    "error handling", "modules", "lambda", "iterators"
  ],
  NumPy: [
    "ndarray creation", "broadcasting", "indexing/slicing", "reshaping",
    "vectorization", "mathematical ops", "random", "dtype", "memory layout",
    "performance vs lists", "array operations", "linear algebra"
  ],
  Pandas: [
    "DataFrame/Series", "read_csv", "groupby", "merge/join", "apply/map",
    "loc/iloc", "handling NaN", "pivot tables", "time series", "concat",
    "filtering", "sorting", "aggregation", "data cleaning"
  ],
  DSA: [
    "arrays", "linked lists", "stacks", "queues", "trees", "graphs",
    "hashing", "sorting (merge/quick/heap)", "searching (binary)",
    "dynamic programming", "recursion", "time/space complexity", "greedy algorithms"
  ],
  React: [
    "hooks (useState/useEffect/useRef/useMemo)", "lifecycle", "props/state",
    "context", "virtual DOM", "reconciliation", "performance (memo/lazy)",
    "routing", "component patterns", "custom hooks", "error boundaries"
  ],
  Java: [
    "OOP concepts", "Collections framework", "streams API", "multithreading",
    "generics", "exceptions", "JVM internals", "interfaces vs abstract",
    "design patterns", "Spring basics", "JDBC", "annotations"
  ],
  JavaScript: [
    "closures", "promises", "async/await", "event loop", "call stack",
    "prototypes", "ES6+ features", "this keyword", "hoisting",
    "DOM manipulation", "modules", "spread/rest", "destructuring"
  ],
  SQL: [
    "joins (inner/left/right/full)", "subqueries", "indexes", "transactions (ACID)",
    "normalization", "window functions", "GROUP BY/HAVING", "stored procedures",
    "views", "query optimization", "constraints", "triggers"
  ],
  "Node.js": [
    "event loop", "non-blocking I/O", "streams", "Buffer", "modules (CommonJS/ESM)",
    "npm", "clustering", "child processes", "fs/http/path modules",
    "environment variables", "middleware", "error handling"
  ],
  "Express.js": [
    "routing", "middleware chain", "error handling middleware", "REST API design",
    "request/response cycle", "body-parser", "CORS", "authentication patterns",
    "static files", "templating", "route parameters", "query strings"
  ],
};

/**
 * Get last 7 days of tech quiz history for a subject
 */
function getLast7DaysHistory(state, currentDay, subject) {
  const history = state.practiceHistory?.techQuiz?.[subject] || [];
  const cutoffDay = currentDay - 7;
  
  return history
    .filter(entry => entry.day > cutoffDay && entry.day < currentDay)
    .sort((a, b) => b.day - a.day);
}

/**
 * Build avoidance context for tech quiz
 */
function buildAvoidanceContext(history, subject) {
  if (!history || history.length === 0) {
    return "No recent history - cover diverse topics.";
  }
  
  const topicCount = {};
  const recentQuestionIds = [];
  
  history.forEach(entry => {
    entry.topics?.forEach(topic => {
      topicCount[topic] = (topicCount[topic] || 0) + 1;
    });
    entry.questionIds?.forEach(id => recentQuestionIds.push(id));
  });
  
  let context = `RECENT HISTORY for ${subject} (last 7 days):\n`;
  context += `Topics covered: ${JSON.stringify(topicCount)}\n`;
  context += `Avoid these recently used topics: ${Object.keys(topicCount).join(', ')}\n`;
  context += `Prioritize topics not yet covered this week.`;
  
  return context;
}

/**
 * Get language tag for code snippets
 */
function getLanguageTag(subject) {
  const map = {
    Python: "python",
    NumPy: "python",
    Pandas: "python",
    DSA: "python",
    React: "javascript",
    Java: "java",
    JavaScript: "javascript",
    SQL: "sql",
    "Node.js": "javascript",
    "Express.js": "javascript",
  };
  return map[subject] || "javascript";
}

/**
 * Generate 20 tech quiz questions for a subject using Gemini
 */
async function generateTechQuizGemini({ state, dayNumber, subject, userId }) {
  const startTime = Date.now();
  logger.info(`💻 Generating tech quiz for ${subject} on day ${dayNumber}`);
  
  if (!SUBJECTS[subject]) {
    throw new Error(`Invalid subject: ${subject}`);
  }
  
  const topicPool = SUBJECTS[subject];
  const history = getLast7DaysHistory(state, dayNumber, subject);
  const avoidanceContext = buildAvoidanceContext(history, subject);
  const languageTag = getLanguageTag(subject);
  
  const systemPrompt = `You are a senior software engineer and technical interviewer with 15+ years of experience.

You specialize in ${subject} and have interviewed hundreds of candidates at top tech companies.

Your job: Generate 20 realistic technical interview questions for ${subject}.

DIFFICULTY DISTRIBUTION (STRICT):
- Easy: 6 questions (definitions, basic syntax, simple facts)
- Medium: 6 questions (how/why, comparisons, practical usage)
- Hard: 8 questions (deep internals, architecture, tradeoffs, debugging, algorithms)

TOPIC POOL for ${subject}:
${topicPool.map((t, i) => `${i + 1}. ${t}`).join('\n')}

UNIQUENESS REQUIREMENT:
${avoidanceContext}

ANSWER GUIDELINES:
Easy:
- 2-3 sentence answer
- Definition or concept explanation
- Code optional (only if 1-2 lines)

Medium:
- 3-5 sentence answer
- Application, comparison, or practical usage
- Code included when relevant (5-10 lines)

Hard:
- 5-8 sentence answer with depth
- Internal mechanisms, implementation, tradeoffs
- Code MANDATORY (10-20 lines, runnable, realistic)

CODE QUALITY RULES:
- All code must be syntactically correct and runnable
- No pseudocode or placeholder comments
- Use realistic variable names (not a, b, x, y)
- Minimum lines needed to illustrate the concept
- Language: ${languageTag}

OUTPUT RULES:
- Return ONLY valid JSON
- Each question must have: questionId, difficulty, question, answer, codeSnippet (or null), explanation, language, topicTags (2-3 tags)
- Questions must sound like real interview questions
- Explanations should build mental models, not just repeat the answer`;

  const userPrompt = `Generate 20 technical interview questions for ${subject} on Day ${dayNumber}.

STRICT DISTRIBUTION:
- 6 Easy
- 6 Medium  
- 8 Hard

Cover diverse topics from the topic pool. Avoid recently covered topics.

Return JSON array of 20 questions with this structure:
[
  {
    "questionId": "unique_id",
    "difficulty": "Easy|Medium|Hard",
    "question": "Interview-style question",
    "answer": "Best possible answer (2-8 sentences based on difficulty)",
    "codeSnippet": "code here or null",
    "explanation": "Why/how explanation to build understanding",
    "language": "${languageTag}",
    "topicTags": ["tag1", "tag2"]
  }
]`;

  try {
    // Use default models - don't specify custom ones
    const jsonText = await callGeminiJsonWithFallback({
      systemPrompt,
      userPrompt,
      timeoutMs: 45000, // 45 seconds per subject
    });
    
    const questions = JSON.parse(jsonText);
    
    // Validate structure
    if (!Array.isArray(questions) || questions.length !== 20) {
      throw new Error(`Expected 20 questions, got ${questions?.length || 0}`);
    }
    
    // Count by difficulty
    const easyCount = questions.filter(q => q.difficulty === "Easy").length;
    const mediumCount = questions.filter(q => q.difficulty === "Medium").length;
    const hardCount = questions.filter(q => q.difficulty === "Hard").length;
    
    logger.info(`📊 Distribution: ${easyCount} Easy, ${mediumCount} Medium, ${hardCount} Hard`);
    
    // Validate each question
    questions.forEach((q, idx) => {
      if (!q.questionId || !q.difficulty || !q.question || !q.answer || !q.explanation || !Array.isArray(q.topicTags)) {
        throw new Error(`Question ${idx + 1} missing required fields`);
      }
      if (!["Easy", "Medium", "Hard"].includes(q.difficulty)) {
        throw new Error(`Question ${idx + 1} has invalid difficulty: ${q.difficulty}`);
      }
    });
    
    const duration = Date.now() - startTime;
    logger.info(`✅ Tech quiz generated in ${duration}ms`);
    
    return {
      questions,
      generatedAt: new Date().toISOString(),
      dayNumber,
      subject,
      usedTopics: questions.flatMap(q => q.topicTags),
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Tech quiz generation failed after ${duration}ms:`, error.message);
    throw error;
  }
}

/**
 * Update practice history with new tech quiz
 */
function updateTechQuizHistory(state, dayNumber, subject, questions) {
  if (!state.practiceHistory) state.practiceHistory = {};
  if (!state.practiceHistory.techQuiz) state.practiceHistory.techQuiz = {};
  if (!state.practiceHistory.techQuiz[subject]) state.practiceHistory.techQuiz[subject] = [];
  
  const entry = {
    day: dayNumber,
    topics: questions.flatMap(q => q.topicTags),
    questionIds: questions.map(q => q.questionId),
    generatedAt: new Date().toISOString(),
  };
  
  state.practiceHistory.techQuiz[subject].push(entry);
  
  // Keep only last 10 days of history (7 + buffer)
  state.practiceHistory.techQuiz[subject] = state.practiceHistory.techQuiz[subject]
    .filter(e => e.day > dayNumber - 10)
    .sort((a, b) => b.day - a.day);
}

module.exports = {
  generateTechQuizGemini,
  updateTechQuizHistory,
  SUBJECTS,
};
