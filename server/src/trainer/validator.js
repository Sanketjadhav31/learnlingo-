function trimLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
}

function isEmptyLine(line) {
  return !line || !String(line).trim().length;
}

function findFirstNonEmptyIndex(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (!isEmptyLine(lines[i])) return i;
  }
  return -1;
}

function parseHeader(lines) {
  const firstIdx = findFirstNonEmptyIndex(lines);
  if (firstIdx === -1) return { ok: false, reason: "Submission is empty." };
  const header = lines[firstIdx].trim();
  const mNormal = header.match(/^DAY\s+(\d+)\s+SUBMISSION\s*$/);
  const mWeekly = header.match(/^DAY\s+(\d+)\s+SUBMISSION\s*\(WEEKLY REVIEW\)\s*$/i);
  if (mNormal) return { ok: true, dayNumber: Number(mNormal[1]), dayType: "normal" };
  if (mWeekly) return { ok: true, dayNumber: Number(mWeekly[1]), dayType: "weekly_review" };
  return { ok: false, reason: `Invalid submission header: "${header}"` };
}

function findLabelLineIndex(lines, label) {
  return lines.findIndex((l) => l.trim() === label);
}

function parseNumberedListBlock(lines, startIdx, endIdx) {
  const itemsByNum = new Map();
  const extraNonEmptyLines = [];
  let lastItemNum = null;

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    if (isEmptyLine(line)) continue;
    const m = line.match(/^(\d+)\.\s*(.*)$/);
    if (!m) {
      // Allow wrapped multi-line answers by appending to previous numbered item.
      if (lastItemNum !== null && itemsByNum.has(lastItemNum)) {
        const prev = String(itemsByNum.get(lastItemNum) || "");
        itemsByNum.set(lastItemNum, `${prev} ${String(line).trim()}`.trim());
      } else {
        extraNonEmptyLines.push({ i, line });
      }
      continue;
    }
    const n = Number(m[1]);
    const content = (m[2] || "").trim();
    itemsByNum.set(n, content);
    lastItemNum = n;
  }
  return { itemsByNum, extraNonEmptyLines };
}

function validateReflection(reflectionMap, reflectionCount) {
  for (let n = 1; n <= reflectionCount; n++) {
    const v = reflectionMap.get(n);
    if (v === undefined) return `Reflection missing item ${n}.`;
    if (!String(v).trim() || String(v).trim() === "-") return `Reflection item ${n} is empty/invalid.`;
  }
  return null;
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasMostlyCopiedPrompt(answer, prompt) {
  const a = String(answer || "").trim().toLowerCase();
  const p = String(prompt || "").trim().toLowerCase();
  if (!a || !p) return false;
  if (a === p) return true;
  return a.length > 20 && p.length > 20 && a.includes(p.slice(0, Math.min(40, p.length)));
}

function uniqueRatio(values) {
  const normalized = values.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
  if (!normalized.length) return 1;
  return new Set(normalized).size / normalized.length;
}

function parseAndValidateSubmission({ submissionText, dayContent }) {

  const expected = dayContent.submissionTemplate;
  const lines = trimLines(submissionText);

  const headerParsed = parseHeader(lines);
  if (!headerParsed.ok) {

    return { ok: false, reason: headerParsed.reason, details: [] };
  }

  if (headerParsed.dayNumber !== dayContent.dayNumber) {

    return {
      ok: false,
      reason: `You are on Day ${dayContent.dayNumber}, but your submission header says Day ${headerParsed.dayNumber}.`,
      details: [],
    };
  }

  if (headerParsed.dayType !== dayContent.dayType) {

    return {
      ok: false,
      reason: `Submission dayType mismatch. Expected ${dayContent.dayType}, got ${headerParsed.dayType}.`,
      details: [],
    };
  }

  const labelsNormal = [
    { key: "writing", label: "1. Writing Task:" },
    { key: "speaking", label: "2. Speaking Task:" },
    { key: "conversation", label: "3. Conversation Practice:" },
    { key: "sentences", label: "4. Sentence Practice:" },
    { key: "hindiTranslation", label: "5. Hindi to English Translation:" },
    { key: "questions", label: "6. Questions:" },
    { key: "listening", label: "7. Listening Comprehension:" },
    { key: "reflection", label: "8. Reflection (required, not graded):" },
  ];

  const labelsWeekly = [
    { key: "writing", label: "1. Writing Task:" },
    { key: "speaking", label: "2. Speaking Task:" },
    { key: "conversation", label: "3. Conversation Practice:" },
    { key: "sentences", label: "4. Sentence Practice (30):" },
    { key: "hindiTranslation", label: "5. Hindi to English Translation:" },
    { key: "questions", label: "6. Questions:" },
    { key: "listening", label: "7. Listening Comprehension:" },
    { key: "vocabQuiz", label: "8. Vocabulary Quiz:" },
    { key: "reflection", label: "9. Reflection (required, not graded):" },
  ];

  const labels = dayContent.dayType === "weekly_review" ? labelsWeekly : labelsNormal;
  const labelIndices = {};

  for (const item of labels) {
    const idx = findLabelLineIndex(lines, item.label);
    if (idx === -1) {

      return { ok: false, reason: `Missing/incorrect label: "${item.label}"`, details: [] };
    }
    labelIndices[item.key] = idx;
  }

  // order validation

  for (let i = 0; i < labels.length - 1; i++) {
    if (labelIndices[labels[i].key] > labelIndices[labels[i + 1].key]) {

      return { ok: false, reason: "Section order is incorrect.", details: [] };
    }
  }

  function blockBetween(aKey, bKey) {
    const text = lines.slice(labelIndices[aKey] + 1, labelIndices[bKey]).join("\n").trim();
    return text;
  }

  const writingTask = blockBetween("writing", "speaking");
  const speakingTask = blockBetween("speaking", "conversation");
  const conversationPractice = blockBetween("conversation", "sentences");
  if (countWords(writingTask) < 40) {
    return { ok: false, reason: "Writing task must contain at least 60 words.", details: [] };
  }
  if (countWords(speakingTask) < 20) {
    return { ok: false, reason: "Speaking task must contain at least 40 words.", details: [] };
  }
  if (hasMostlyCopiedPrompt(writingTask, dayContent.writingTask?.prompt)) {
    return { ok: false, reason: "Writing task looks copied from prompt. Please write your own answer.", details: [] };
  }
  if (hasMostlyCopiedPrompt(speakingTask, dayContent.speakingTask?.prompt)) {
    return { ok: false, reason: "Speaking task looks copied from prompt. Please write your own answer.", details: [] };
  }

  const sentenceStart = labelIndices.sentences + 1;
  const sentenceEnd = labelIndices.hindiTranslation;
  const sentenceCount = expected.sentenceCount;

  const sentenceBlock = parseNumberedListBlock(lines, sentenceStart, sentenceEnd);
  if (sentenceBlock.extraNonEmptyLines.length) {
    return {
      ok: false,
      reason: `Sentence Practice has unexpected non-empty lines.`,
      details: sentenceBlock.extraNonEmptyLines.slice(0, 5).map((x) => x.line),
    };
  }
  for (let n = 1; n <= sentenceCount; n++) {
    const v = sentenceBlock.itemsByNum.get(n);
    if (v === undefined || !String(v).trim() || String(v).trim() === "-") {
      return { ok: false, reason: `Sentence Practice sentence ${n} is empty/invalid.`, details: [] };
    }
    if (countWords(v) < 2) {
      return { ok: false, reason: `Sentence Practice sentence ${n} must be at least 4 words.`, details: [] };
    }
  }
  const sentenceValues = Array.from({ length: sentenceCount }, (_, i) => sentenceBlock.itemsByNum.get(i + 1));
  if (uniqueRatio(sentenceValues) < 0.6) {
    return { ok: false, reason: "Too many repeated sentences. Please provide unique answers.", details: [] };
  }

  const hindiStart = labelIndices.hindiTranslation + 1;
  const hindiEnd = labelIndices.questions;
  const hindiCount = 20;

  const hindiBlock = parseNumberedListBlock(lines, hindiStart, hindiEnd);
  if (hindiBlock.extraNonEmptyLines.length) {
    return {
      ok: false,
      reason: `Hindi to English Translation has unexpected non-empty lines.`,
      details: hindiBlock.extraNonEmptyLines.slice(0, 5).map((x) => x.line),
    };
  }
  for (let n = 1; n <= hindiCount; n++) {
    const v = hindiBlock.itemsByNum.get(n);
    if (v === undefined || !String(v).trim() || String(v).trim() === "-") {
      return { ok: false, reason: `Hindi translation ${n} is empty/invalid.`, details: [] };
    }
    if (countWords(v) < 2) {
      return { ok: false, reason: `Hindi translation ${n} must be at least 3 words.`, details: [] };
    }
  }

  const questionStart = labelIndices.questions + 1;
  const questionEnd = labelIndices.listening;
  const questionCount = expected.questionCount;

  const questionBlock = parseNumberedListBlock(lines, questionStart, questionEnd);
  if (questionBlock.extraNonEmptyLines.length) {
    return {
      ok: false,
      reason: `Questions has unexpected non-empty lines.`,
      details: questionBlock.extraNonEmptyLines.slice(0, 5).map((x) => x.line),
    };
  }
  for (let n = 1; n <= questionCount; n++) {
    const v = questionBlock.itemsByNum.get(n);
    if (v === undefined || !String(v).trim() || String(v).trim() === "-") {
      return { ok: false, reason: `Questions item ${n} is empty/invalid.`, details: [] };
    }
    if (countWords(v) < 2) {
      return { ok: false, reason: `Questions item ${n} must be at least 3 words.`, details: [] };
    }
  }

  const listeningStart = labelIndices.listening + 1;
  const actualListeningEnd =
    dayContent.dayType === "weekly_review" ? labelIndices.vocabQuiz : labelIndices.reflection;
  const listeningBlock = parseNumberedListBlock(lines, listeningStart, actualListeningEnd);
  if (listeningBlock.extraNonEmptyLines.length) {
    return {
      ok: false,
      reason: `Listening Comprehension has unexpected non-empty lines.`,
      details: listeningBlock.extraNonEmptyLines.slice(0, 5).map((x) => x.line),
    };
  }
  const listeningCount = expected.listeningCount;
  for (let n = 1; n <= listeningCount; n++) {
    const v = listeningBlock.itemsByNum.get(n);
    if (v === undefined || !String(v).trim() || String(v).trim() === "-") {
      return { ok: false, reason: `Listening item ${n} is empty/invalid.`, details: [] };
    }
    if (countWords(v) < 1) {
      return { ok: false, reason: `Listening item ${n} must be at least 2 words.`, details: [] };
    }
  }

  let vocabQuiz = null;
  if (dayContent.dayType === "weekly_review") {
    const vocabStart = labelIndices.vocabQuiz + 1;
    const vocabEnd = labelIndices.reflection;
    const vocabBlock = parseNumberedListBlock(lines, vocabStart, vocabEnd);
    if (vocabBlock.extraNonEmptyLines.length) {
      return { ok: false, reason: `Vocabulary Quiz has unexpected non-empty lines.`, details: [] };
    }
    const vocabQuizCount = expected.vocabQuizCount || 0;
    for (let n = 1; n <= vocabQuizCount; n++) {
      const v = vocabBlock.itemsByNum.get(n);
      if (v === undefined || !String(v).trim() || String(v).trim() === "-") {
        return { ok: false, reason: `Vocabulary Quiz item ${n} is empty/invalid.`, details: [] };
      }
    }
    vocabQuiz = {
      items: Array.from({ length: vocabQuizCount }, (_, i) => ({
        k: i + 1,
        text: vocabBlock.itemsByNum.get(i + 1),
      })),
    };
  }

  const reflectionStart = labelIndices.reflection + 1;
  const reflectionEnd = lines.length;
  const reflectionBlock = parseNumberedListBlock(lines, reflectionStart, reflectionEnd);
  const reflectionError = validateReflection(reflectionBlock.itemsByNum, expected.reflectionCount);
  if (reflectionError) return { ok: false, reason: reflectionError, details: [] };

  const turnLines = String(conversationPractice || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("A:") || l.startsWith("B:"));
  if (turnLines.length < expected.conversationMinTurns) {
    return {
      ok: false,
      reason: `Conversation Practice must contain at least ${expected.conversationMinTurns} exchanges. Found ${turnLines.length}.`,
      details: [],
    };
  }
  for (const [idx, line] of turnLines.entries()) {
    const text = line.replace(/^[AB]:\s*/i, "");
    if (countWords(text) < 2) {
      return {
        ok: false,
        reason: `Conversation turn ${idx + 1} must have at least 5 words.`,
        details: [],
      };
    }
  }

  const parsed = {
    dayNumber: dayContent.dayNumber,
    writingTask,
    speakingTask,
    conversationPractice,
    sentencePractice: Array.from({ length: sentenceCount }, (_, i) => ({
      k: i + 1,
      text: sentenceBlock.itemsByNum.get(i + 1),
    })),
    hindiTranslation: Array.from({ length: hindiCount }, (_, i) => ({
      k: i + 1,
      text: hindiBlock.itemsByNum.get(i + 1),
    })),
    questions: Array.from({ length: questionCount }, (_, i) => ({
      k: i + 1,
      text: questionBlock.itemsByNum.get(i + 1),
    })),
    listening: Array.from({ length: listeningCount }, (_, i) => ({
      k: i + 1,
      text: listeningBlock.itemsByNum.get(i + 1),
    })),
    reflection: Array.from({ length: expected.reflectionCount }, (_, i) => ({
      k: i + 1,
      text: reflectionBlock.itemsByNum.get(i + 1),
    })),
    vocabQuiz,
  };

  return { ok: true, parsed };
}

module.exports = { parseAndValidateSubmission };

