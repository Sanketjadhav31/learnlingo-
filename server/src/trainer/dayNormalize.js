function ensureArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    const isNumericKeys = keys.length > 0 && keys.every(k => !isNaN(parseInt(k)));
    if (isNumericKeys) {
      return keys.sort((a, b) => parseInt(a) - parseInt(b)).map(k => v[k]);
    }
  }
  return [];
}

function nonEmpty(s, fallback = "—") {
  const t = String(s ?? "").trim();
  return t.length ? t : fallback;
}

function asString(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed.length ? trimmed : "";
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const t =
      (typeof v.text === "string" ? v.text : undefined) ||
      (typeof v.value === "string" ? v.value : undefined) ||
      (typeof v.idiom === "string" ? v.idiom : undefined) ||
      (typeof v.phrasal === "string" ? v.phrasal : undefined) ||
      (typeof v.term === "string" ? v.term : undefined) ||
      (typeof v.content === "string" ? v.content : undefined);
    return t ? t.trim() : "";
  }
  return "";
}

function mapIdiomsField(v) {
  if (!v) return "—";
  if (typeof v === "string") return asString(v);
  if (typeof v === "object") {
    return (
      asString(v.text) ||
      asString(v.idiom) ||
      asString(v.phrase) ||
      asString(v.value) ||
      asString(v.term)
    );
  }
  return asString(v);
}

/**
 * Extract raw items from ANY shape Gemini may return:
 *   - [...] plain array
 *   - { items: [...] }
 *   - { questions: [...] }
 *   - { sentences: [...] }
 *   - { prompts: [...] }
 *   - { words: [...] }
 *   - { 0: ..., 1: ..., ... } numeric-keyed object
 *   - { prompt: "single string" } single-item object (wrap in array)
 */
function extractItems(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;

  if (typeof raw === "object") {
    for (const field of ["items", "questions", "sentences", "prompts", "words", "list", "data"]) {
      const candidate = raw[field];
      if (Array.isArray(candidate) && candidate.length > 0) return candidate;
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        const arr = ensureArray(candidate);
        if (arr.length > 0) return arr;
      }
    }

    // Numeric-keyed object fallback
    const asArr = ensureArray(raw);
    if (asArr.length > 0) return asArr;

    // Single prompt field - wrap in array
    if (typeof raw.prompt === "string" && raw.prompt.trim().length > 0) {
      return [{ prompt: raw.prompt }];
    }
  }

  return [];
}

/**
 * Extract pronunciation words from whatever shape Gemini returns.
 * Handles: { words:[...] }, { items:[...] }, numeric-keyed, plain array,
 * or a single word object at top level.
 */
function extractPronunciationWords(pronRaw) {
  if (!pronRaw) return [];

  const candidates = [
    pronRaw.words,
    pronRaw.items,
    pronRaw.list,
    pronRaw.examples,
    pronRaw.pronunciation,
    pronRaw.focusWords,
    pronRaw.rules, // Gemini sometimes returns rules array
  ];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    
    
    if (Array.isArray(c) && c.length > 0) {
      
      
      // If it's a rules array, extract words from exampleWords
      if (c[0] && c[0].exampleWords && Array.isArray(c[0].exampleWords)) {

        const extracted = [];
        for (const rule of c) {
          if (rule.exampleWords && Array.isArray(rule.exampleWords)) {

            for (const wordStr of rule.exampleWords) {
              // Parse "walks /wɔːks/ (sounds like 's')" format
              const match = String(wordStr).match(/^(\w+)\s+\/([\w\s:ːɔɪʊəæɛʌɑɒʃʒθðŋ]+)\//);

              if (match) {
                extracted.push({
                  word: match[1],
                  ipa: match[2],
                  tip: rule.rule || rule.exampleSentence || '',
                });
              }
            }
          }
        }

        if (extracted.length > 0) return extracted;
      }
      
      // Otherwise return the array as-is
      
      return c;
    }
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const arr = ensureArray(c);
      if (arr.length > 0) {
        
        return arr;
      }
    }
  }

  const asArr = ensureArray(pronRaw);
  if (asArr.length > 0) {
    
    return asArr;
  }

  // pronRaw itself is a single word entry
  if (pronRaw.word || pronRaw.ipa || pronRaw.phonetic) {

    return [pronRaw];
  }

  return [];
}

/**
 * Extract wordOfDay items from whatever shape Gemini returns.
 * Handles: { wordOfDay:[...] }, { words:[...] }, { vocabulary:[...] },
 * { keyVocabulary:[...] }, { newWords:[...] }, numeric-keyed objects, plain arrays.
 */
function extractWordOfDay(vocabRaw) {
  if (!vocabRaw) return [];

  const candidates = [
    vocabRaw.wordOfDay,
    vocabRaw.newWords,        // NEW: Gemini uses this
    vocabRaw.keyVocabulary,   // NEW: Gemini sometimes uses this
    vocabRaw.words,
    vocabRaw.vocabulary,
    vocabRaw.items,
    vocabRaw.list,
    vocabRaw.vocabList,
  ];

  

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (Array.isArray(c) && c.length > 0) {

      
      return c;
    }
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const arr = ensureArray(c);
      if (arr.length > 0) {

        return arr;
      }
    }
  }

  const asArr = ensureArray(vocabRaw);
  if (asArr.length > 0) {

    return asArr;
  }

  return [];
}

function normalizeDayContent(raw, { dayNumber, dayType, sentenceCount, questionCount, vocabQuizCount }) {



  
  
  
  
  

  const pronRaw = raw?.pronunciation || {};
  const vocabRaw = raw?.vocabAndTracks || raw?.vocab || {};
  const listeningRaw = raw?.listening || {};
  const sentencePracticeRaw = raw?.sentencePractice || {};
  const questionsRaw = raw?.questions || {};
  const writingTaskRaw = raw?.writingTask || {};
  const speakingTaskRaw = raw?.speakingTask || {};
  const conversationTaskRaw = raw?.conversationTask || {};

  // ── wordOfDay ────────────────────────────────────────────────────────────────
  const wordOfDayIn = extractWordOfDay(vocabRaw).filter(Boolean);
  

  const wordOfDay = Array.from({ length: 10 }, (_, i) => {
    const x = wordOfDayIn[i] || {};
    const collIn = ensureArray(x.collocations);
    const coll =
      collIn.length > 0
        ? collIn.map((c) => asString(c)).filter(Boolean)
        : typeof x.collocations === "string"
          ? x.collocations.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
          : [];
    const filledColl =
      coll.length >= 2
        ? coll.slice(0, 4)
        : ["learn", "practice"].slice(0, Math.max(2, coll.length || 2));

    const word = asString(x.word || x.term || x.vocab || "");
    const definition = asString(x.definition || x.meaning || x.def || x.description || "");
    const example = asString(x.example || x.exampleSentence || x.exampleUse || x.usage || x.sentence || "");
    const hindiMeaning = asString(x.hindiMeaning || x.hindi || x.hindiTranslation || "");
    
    // Extract examples array
    const examplesIn = ensureArray(x.examples);
    const examples = examplesIn.length > 0 
      ? examplesIn.map((e) => asString(e)).filter(Boolean).slice(0, 3)
      : [];

    // Only create entry if we have at least a word
    if (!word || word.length === 0) {
      return {
        word: `word${i + 1}`,
        pos: "noun",
        definition: "Definition not available",
        example: "Example not available",
        hindiMeaning: "",
        examples: [],
        collocations: filledColl.slice(0, 4),
        synonym: "",
        antonym: "",
      };
    }

    return {
      word: word,
      pos: asString(x.pos || x.partOfSpeech || x.type || "noun"),
      definition: definition || "Definition not available",
      example: example || `Example sentence with ${word}.`,
      hindiMeaning: hindiMeaning,
      examples: examples,
      collocations: filledColl.slice(0, 4),
      synonym: asString(x.synonym || x.syn || x.similar || ""),
      antonym: asString(x.antonym || x.ant || x.opposite || ""),
    };
  });
  

  // ── pronunciation ────────────────────────────────────────────────────────────
  const pronWordsIn = extractPronunciationWords(pronRaw);
  

  if (pronWordsIn.length > 0) {
    
  }

  const pronunciationWords = Array.from({ length: 5 }, (_, i) => {
    const x = pronWordsIn[i] || {};
    let ipa = asString(
      x.ipa || 
      x.ipaText || 
      x.phonetic || 
      x.pronunciation || 
      x.transcription || 
      ""
    );
    // Clean up IPA: remove extra slashes if Gemini adds them
    ipa = ipa.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    
    const word = asString(x.word || x.term || x.vocab || x.text || "");
    const mis = asString(
      x.mis || 
      x.commonMispronunciation || 
      x.mispronunciation ||
      x.wrong || 
      x.mistake || 
      x.incorrect || 
      x.commonMistake ||
      x.tip || // Gemini sometimes puts guidance in 'tip'
      ""
    );
    const correct = asString(
      x.correct || 
      x.correctPronunciation || 
      x.correctVersion || 
      x.right || 
      x.tip || 
      x.guidance ||
      x.howTo ||
      x.advice ||
      ""
    );
    const hindiMeaning = asString(x.hindiMeaning || x.hindi || x.hindiTranslation || "");
    const exampleSentence = asString(x.exampleSentence || x.example || x.sentence || "");
    
    // Extract examples array
    const examplesIn = ensureArray(x.examples);
    const examples = examplesIn.length > 0 
      ? examplesIn.map((e) => asString(e)).filter(Boolean).slice(0, 3)
      : [];

    // Don't create fallback entries - return null if no valid data
    if (!word || word.length === 0) {

      return null;
    }

    const result = {
      word: word,
      ipa: ipa || "/unknown/",
      stress: asString(x.stress || x.syllableStress || x.stressPattern || "") || "single",
      hindiMeaning: hindiMeaning,
      examples: examples,
      exampleSentence: exampleSentence,
      mis: mis || "No common mispronunciation noted",
      correct: correct || "Pronounce clearly",
    };

    return result;
  }).filter(Boolean); // Remove null entries

  // ── warmUpCorrections ────────────────────────────────────────────────────────
  const warmUpCorrectionsIn = ensureArray(raw?.warmUpCorrections).filter(Boolean);
  

  const warmUpCorrections = Array.from({ length: 3 }, (_, i) => {
    const x = warmUpCorrectionsIn[i] || {};
    const wrong = asString(
      x.wrong || 
      x.incorrectSentence || 
      x.incorrect || 
      x.mistake || 
      x.error || 
      x.original || 
      x.before || 
      ""
    );
    const correct = asString(
      x.correct || 
      x.correctSentence || 
      x.correctVersion || 
      x.correction || 
      x.fixed || 
      x.right || 
      x.after || 
      x.corrected || 
      ""
    );
    const explanation = asString(x.explanation || x.reason || x.why || "");
    
    // Provide fallback if fields are empty
    if (!wrong || wrong.length === 0 || !correct || correct.length === 0) {
      return {
        wrong: `Example incorrect sentence ${i + 1}`,
        correct: `Example correct sentence ${i + 1}`,
        explanation: "",
      };
    }

    return {
      wrong: wrong,
      correct: correct,
      explanation: explanation,
    };
  });

  // ── listeningQuestions ───────────────────────────────────────────────────────
  const listeningQuestionsIn = extractItems(listeningRaw.questions || listeningRaw);
  const listeningQuestions = Array.from({ length: 6 }, (_, i) => {
    const x = listeningQuestionsIn[i] || {};
    const idxCandidate =
      typeof x.idx === "number" && x.idx >= 1
        ? x.idx
        : typeof x.k === "number" && x.k >= 1
          ? x.k
          : i + 1;
    return {
      idx: idxCandidate,
      prompt: asString(x.prompt || x.question || x.text || x.q || ""),
    };
  });

  // ── sentencePractice ─────────────────────────────────────────────────────────
  const rawSentenceItems = extractItems(sentencePracticeRaw);

  if (rawSentenceItems.length > 0) {
    
  }

  const sentencePractice = Array.from({ length: sentenceCount }, (_, i) => {
    const x = rawSentenceItems[i];
    let kCandidate = i + 1;
    let prompt = "";

    if (typeof x === "string") {
      prompt = x;
    } else if (x && typeof x === "object") {
      if (typeof x.k === "number") {
        kCandidate = x.k >= 1 ? x.k : i + 1;
      }
      prompt = asString(
        x.prompt ||
        x.instruction ||
        x.english ||
        x.blankedEnglish ||
        x.text ||
        x.sentence ||
        x.question ||
        x.task ||
        ""
      );
    }

    return {
      k: kCandidate,
      prompt:
        prompt && prompt !== "—"
          ? prompt
          : `Write a sentence using the grammar from today's lesson (${i + 1})`,
    };
  });

  // ── hindiTranslation ─────────────────────────────────────────────────────────
  const hindiTranslationRaw = raw?.hindiTranslation || {};
  const rawHindiItems = extractItems(hindiTranslationRaw);

  const hindiTranslation = Array.from({ length: 20 }, (_, i) => {
    const x = rawHindiItems[i];
    let kCandidate = i + 1;
    let hindiSentence = "";

    if (typeof x === "string") {
      hindiSentence = x;
    } else if (x && typeof x === "object") {
      if (typeof x.k === "number") {
        kCandidate = x.k >= 1 ? x.k : i + 1;
      }
      hindiSentence = asString(
        x.hindiSentence ||
        x.hindi ||
        x.sentence ||
        x.text ||
        ""
      );
    }

    return {
      k: kCandidate,
      hindiSentence:
        hindiSentence && hindiSentence !== "—"
          ? hindiSentence
          : `यह एक उदाहरण वाक्य है ${i + 1}`,
    };
  });

  // ── questions ────────────────────────────────────────────────────────────────
  const rawQuestionItems = extractItems(questionsRaw);

  const questions = Array.from({ length: questionCount }, (_, i) => {
    const x = rawQuestionItems[i];
    let idxCandidate = i + 1;
    let prompt = "";

    if (typeof x === "string") {
      prompt = x;
    } else if (x && typeof x === "object") {
      if (typeof x.idx === "number") {
        idxCandidate = x.idx >= 1 ? x.idx : i + 1;
      } else if (typeof x.k === "number") {
        idxCandidate = x.k >= 1 ? x.k : i + 1;
      }
      prompt = asString(x.prompt || x.question || x.text || x.instruction || x.q || "");
    }

    return {
      idx: idxCandidate,
      prompt:
        prompt && prompt !== "—"
          ? prompt
          : `Answer question ${i + 1} based on today's lesson`,
    };
  });

  // ── idiom / phrasal ──────────────────────────────────────────────────────────
  const idiom = mapIdiomsField(vocabRaw.idiom);
  const phrasal = mapIdiomsField(vocabRaw.phrasal || vocabRaw.phrasalVerb);

  const writingTaskPrompt = asString(writingTaskRaw.prompt || writingTaskRaw.task || raw?.writingPrompt || "");
  const requiredIdiom = asString(writingTaskRaw.requiredIdiom || idiom);
  const requiredPhrasal = asString(writingTaskRaw.requiredPhrasal || phrasal);

  return {
    dayNumber,
    dayType,
    submissionTemplate: {
      type: dayType,
      sentenceCount,
      hindiTranslationCount: 20,
      questionCount,
      listeningCount: 6,
      reflectionCount: 2,
      conversationMinTurns: 8,
      vocabQuizCount,
    },
    dayTheme: asString(raw?.dayTheme || raw?.theme || raw?.topic || ""),
    grammarFocus: asString(raw?.grammarFocus || raw?.grammar || raw?.focus || ""),
    warmUpCorrections,
    grammarExplanationText: asString(raw?.grammarExplanationText || raw?.grammarExplanation || raw?.explanation || ""),
    sentenceFormationText: asString(raw?.sentenceFormationText || raw?.sentenceFormation || ""),
    pronunciation: {
      title: asString(pronRaw.title || "Pronunciation"),
      words: pronunciationWords,
      tongueTwister: asString(pronRaw.tongueTwister || pronRaw.twister || pronRaw.practice || "—"),
    },
    vocabAndTracks: {
      wordOfDay,
      idiom: idiom || "—",
      phrasal: phrasal || "—",
    },
    listening: {
      title: asString(listeningRaw.title || "Listening"),
      transcript: asString(listeningRaw.transcript || listeningRaw.text || listeningRaw.passage || ""),
      questions: listeningQuestions,
    },
    speakingTask: { prompt: asString(speakingTaskRaw.prompt || speakingTaskRaw.task || "") },
    writingTask: {
      prompt: writingTaskPrompt,
      requiredIdiom: requiredIdiom || "—",
      requiredPhrasal: requiredPhrasal || "—",
    },
    conversationTask: { prompt: asString(conversationTaskRaw.prompt || conversationTaskRaw.task || "") },
    sentencePractice: { items: sentencePractice },
    hindiTranslation: { items: hindiTranslation },
    questions: { items: questions },
    vocabQuiz:
      dayType === "weekly_review"
        ? {
            items: Array.from({ length: vocabQuizCount }, (_, i) => ({
              idx: i + 1,
              prompt:
                asString(raw?.vocabQuiz?.items?.[i]?.prompt) ||
                asString(raw?.vocabQuiz?.items?.[i]?.text) ||
                asString(raw?.vocabQuiz?.items?.[i]?.question),
            })),
          }
        : undefined,
  };
}

module.exports = { normalizeDayContent };
