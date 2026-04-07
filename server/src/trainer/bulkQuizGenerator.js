const { callGeminiJsonWithFallback } = require("./geminiClient");
const logger = require("../logger");

const SUBJECTS = {
  Python: ["lists", "dicts", "OOP", "decorators", "generators", "comprehensions", "asyncio", "GIL", "memory management", "built-in functions", "file handling", "error handling", "modules", "lambda", "iterators"],
  NumPy: ["ndarray creation", "broadcasting", "indexing/slicing", "reshaping", "vectorization", "mathematical ops", "random", "dtype", "memory layout", "performance vs lists", "array operations", "linear algebra"],
  Pandas: ["DataFrame/Series", "read_csv", "groupby", "merge/join", "apply/map", "loc/iloc", "handling NaN", "pivot tables", "time series", "concat", "filtering", "sorting", "aggregation", "data cleaning"],
  DSA: ["arrays", "linked lists", "stacks", "queues", "trees", "graphs", "hashing", "sorting (merge/quick/heap)", "searching (binary)", "dynamic programming", "recursion", "time/space complexity", "greedy algorithms"],
  React: ["hooks (useState/useEffect/useRef/useMemo)", "lifecycle", "props/state", "context", "virtual DOM", "reconciliation", "performance (memo/lazy)", "routing", "component patterns", "custom hooks", "error boundaries"],
  Java: ["OOP concepts", "Collections framework", "streams API", "multithreading", "generics", "exceptions", "JVM internals", "interfaces vs abstract", "design patterns", "Spring basics", "JDBC", "annotations"],
  JavaScript: ["closures", "promises", "async/await", "event loop", "call stack", "prototypes", "ES6+ features", "this keyword", "hoisting", "DOM manipulation", "modules", "spread/rest", "destructuring"],
  SQL: ["joins (inner/left/right/full)", "subqueries", "indexes", "transactions (ACID)", "normalization", "window functions", "GROUP BY/HAVING", "stored procedures", "views", "query optimization", "constraints", "triggers"],
  "Node.js": ["event loop", "non-blocking I/O", "streams", "Buffer", "modules (CommonJS/ESM)", "npm", "clustering", "child processes", "fs/http/path modules", "environment variables", "middleware", "error handling"],
  "Express.js": ["routing", "middleware chain", "error handling middleware", "REST API design", "request/response cycle", "body-parser", "CORS", "authentication patterns", "static files", "templating", "route parameters", "query strings"],
};

/**
 * Generate ALL subjects (20 questions total) in ONE Gemini call
 */
async function generateAllSubjectsBulk({ state, dayNumber, userId }) {
  const startTime = Date.now();
  logger.info(`💻 Generating tech quiz for ALL subjects (20 questions total) for day ${dayNumber}`);
  
  const systemPrompt = `Generate 20 unique technical interview questions (2 per subject) in strict JSON format.

CRITICAL: All code snippets MUST be properly escaped for JSON (use \\n for newlines, \\" for quotes).

Subjects: Python, NumPy, Pandas, DSA, React, Java, JavaScript, SQL, Node.js, Express.js

Example question with code:
{
  "questionId": "python_1",
  "difficulty": "Medium",
  "question": "Explain list comprehension in Python",
  "answer": "List comprehension provides a concise way to create lists",
  "codeSnippet": "[x**2 for x in range(5)]",
  "explanation": "More readable than traditional loops",
  "language": "python",
  "topicTags": ["comprehensions"]
}

Return ONLY this JSON structure (no markdown, no extra text):
{
  "Python": [2 questions],
  "NumPy": [2 questions],
  "Pandas": [2 questions],
  "DSA": [2 questions],
  "React": [2 questions],
  "Java": [2 questions],
  "JavaScript": [2 questions],
  "SQL": [2 questions],
  "Node.js": [2 questions],
  "Express.js": [2 questions]
}`;

  const userPrompt = `Create 20 ORIGINAL questions (2 per subject). Keep answers brief. Return ONLY valid JSON (no markdown).`;

  try {
    // Use default model from .env (gemini-2.5-flash)
    const jsonText = await callGeminiJsonWithFallback({
      systemPrompt,
      userPrompt,
      timeoutMs: 180000, // 3 minutes
    });
    
    const allSubjects = JSON.parse(jsonText);
    
    // Validate structure
    const subjectNames = Object.keys(SUBJECTS);
    const results = {};
    
    for (const subject of subjectNames) {
      if (!allSubjects[subject] || !Array.isArray(allSubjects[subject])) {
        logger.error(`❌ Missing or invalid data for ${subject}`);
        continue;
      }
      
      const questions = allSubjects[subject];
      
      if (questions.length !== 2) {
        logger.warn(`⚠️  ${subject} has ${questions.length} questions instead of 2`);
      }
      
      // Validate each question
      const validQuestions = questions.filter(q => {
        return q.questionId && q.difficulty && q.question && q.answer && 
               q.explanation && Array.isArray(q.topicTags);
      });
      
      if (validQuestions.length < questions.length) {
        logger.warn(`⚠️  ${subject}: ${questions.length - validQuestions.length} invalid questions removed`);
      }
      
      results[subject] = {
        questions: validQuestions,
        generatedAt: new Date().toISOString(),
        dayNumber,
        subject,
        usedTopics: validQuestions.flatMap(q => q.topicTags),
      };
      
      logger.info(`✓ ${subject}: ${validQuestions.length} questions`);
    }
    
    const duration = Date.now() - startTime;
    const totalQuestions = Object.values(results).reduce((sum, r) => sum + r.questions.length, 0);
    logger.info(`✅ Bulk generation complete: ${totalQuestions} questions in ${duration}ms`);
    
    return results;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`❌ Bulk generation failed after ${duration}ms:`, error.message);
    throw error;
  }
}

module.exports = {
  generateAllSubjectsBulk,
  SUBJECTS,
};
