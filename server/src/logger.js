// Comprehensive logging utility for API and operation monitoring

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function timestamp() {
  return new Date().toISOString().split('T')[1].slice(0, 12);
}

function log(emoji, message, data = null) {
  const ts = timestamp();
  if (data && typeof data === 'object') {
    console.log(`${colors.dim}${ts}${colors.reset} ${emoji} ${message}`, JSON.stringify(data, null, 2));
  } else if (data) {
    console.log(`${colors.dim}${ts}${colors.reset} ${emoji} ${message}`, data);
  } else {
    console.log(`${colors.dim}${ts}${colors.reset} ${emoji} ${message}`);
  }
}

module.exports = {
  // API Request/Response
  apiRequest: (method, path, query, body) => {
    const queryStr = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query)}` : '';
    log('→', `${colors.cyan}${method}${colors.reset} ${path}${queryStr}`);
    if (body && Object.keys(body).length > 0) {
      const sanitized = { ...body };
      if (sanitized.password) sanitized.password = '***';
      if (sanitized.submissionText) sanitized.submissionText = `${sanitized.submissionText.length} chars`;
      log('  ', `Body: ${JSON.stringify(sanitized)}`);
    }
  },
  
  apiResponse: (method, path, status, ms, summary) => {
    const statusColor = status < 300 ? colors.green : status < 400 ? colors.yellow : colors.red;
    log('←', `${colors.cyan}${method}${colors.reset} ${path} ${statusColor}[${status}]${colors.reset} ${ms}ms${summary ? ` - ${summary}` : ''}`);
  },

  // MongoDB
  mongoConnect: (success, type) => {
    if (success) {
      log('✓', `${colors.green}MongoDB connected${colors.reset} (${type || 'default'})`);
    } else {
      log('⚠', `${colors.yellow}MongoDB failed, using file storage${colors.reset}`);
    }
  },

  // Storage operations
  storage: (type) => log('📦', `Storage: ${colors.bright}${type}${colors.reset}`),
  
  stateLoad: (userId, day) => log('📂', `State loaded: user=${userId.slice(0, 8)}..., day=${day}`),
  
  stateSave: (userId, day) => log('💾', `State saved: user=${userId.slice(0, 8)}..., day=${day}`),

  // Day content generation
  dayGenStart: (day, userId) => log('🔄', `${colors.blue}Generating day ${day} content${colors.reset} for user ${userId.slice(0, 8)}...`),
  
  dayGenComplete: (day, data) => {
    const { sentences, questions, vocab, listening } = data;
    log('✓', `${colors.green}Day ${day} generated${colors.reset}: ${sentences} sentences, ${questions} questions, ${vocab} vocab, ${listening} listening`);
  },
  
  dayContentCached: (day, date) => log('✓', `Using cached day ${day} content (generated: ${date})`),

  // Gemini API
  geminiCall: (model, purpose) => log('🤖', `${colors.magenta}Gemini API${colors.reset}: ${model} - ${purpose}`),
  
  geminiResponse: (chars, parseSuccess) => {
    const status = parseSuccess ? colors.green + '✓' : colors.red + '✗';
    log(status, `${colors.reset}Response: ${chars} chars${parseSuccess ? ', parsed OK' : ', parse failed'}`);
  },
  
  geminiError: (error) => log('❌', `${colors.red}Gemini error${colors.reset}: ${error}`),

  // Submission flow
  submitStart: (userId, length, timeSpent) => {
    log('📝', `${colors.blue}Submission${colors.reset}: user=${userId.slice(0, 8)}..., ${length} chars, ${timeSpent}min`);
  },
  
  validation: (ok, reason) => {
    if (ok) {
      log('✓', `${colors.green}Validation passed${colors.reset}`);
    } else {
      log('❌', `${colors.red}Validation failed${colors.reset}: ${reason}`);
    }
  },
  
  evalStart: () => log('🔄', `${colors.blue}Evaluating with AI...${colors.reset}`),
  
  evalComplete: (score, tier, pass, ms) => {
    const passColor = pass ? colors.green : colors.yellow;
    log('✓', `${passColor}Evaluation: ${score}% (${tier})${colors.reset} in ${ms}ms`);
  },
  
  scoreBreakdown: (breakdown) => {
    const { sentencesPercent, questionsPercent, listeningPercent, writingPercent } = breakdown;
    log('📊', `Scores: sentences=${sentencesPercent}%, questions=${questionsPercent}%, listening=${listeningPercent}%, writing=${writingPercent}%`);
  },

  // Day advancement
  dayAdvance: (fromDay, toDay) => log('🎯', `${colors.green}Day advanced${colors.reset}: ${fromDay} → ${toDay}`),
  
  dayRetry: (day, attempt) => log('🔁', `${colors.yellow}Retry day ${day}${colors.reset} (attempt ${attempt})`),
  
  cannotAdvance: (reason) => log('⚠', `${colors.yellow}Cannot advance${colors.reset}: ${reason}`),

  // Draft operations
  draftSave: (userId, day, length) => log('💾', `Draft saved: user=${userId.slice(0, 8)}..., day=${day}, ${length} chars`),

  // Reset operations
  resetFull: (userId) => log('🔄', `${colors.yellow}Full reset${colors.reset}: user=${userId.slice(0, 8)}...`),
  
  resetToday: (userId, day, regenerate) => {
    log('🔄', `${colors.yellow}Reset day ${day}${colors.reset}: user=${userId.slice(0, 8)}...${regenerate ? ' (regenerate content)' : ''}`);
  },

  // Errors
  error: (context, message) => log('❌', `${colors.red}${context} error${colors.reset}: ${message}`),
  
  warn: (message) => log('⚠', `${colors.yellow}${message}${colors.reset}`),

  // Auth
  authSignup: (email) => log('👤', `${colors.green}Signup${colors.reset}: ${email}`),
  
  authLogin: (email) => log('👤', `${colors.green}Login${colors.reset}: ${email}`),
  
  authFailed: (email, reason) => log('❌', `${colors.red}Auth failed${colors.reset}: ${email} - ${reason}`),

  // General info
  info: (message, data) => log('ℹ', message, data),
  
  success: (message) => log('✓', `${colors.green}${message}${colors.reset}`),
};
