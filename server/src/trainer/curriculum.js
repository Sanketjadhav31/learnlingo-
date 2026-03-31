/**
 * ENGLISH LEARNING CURRICULUM — 126 DAYS (18 WEEKS)
 * ====================================================
 * Structure:
 *   - 6 learning days per week
 *   - Day 7 of every week = REVISION (covers that week's 6 days)
 *   - 18 weeks total → 126 days
 *   - Levels: beginner (days 1–42), intermediate (days 43–84), advanced (days 85–126)
 *
 * Categories used:
 *   "grammar"      — core grammar rule
 *   "tense"        — specific tense deep-dive
 *   "vocabulary"   — thematic word sets + usage
 *   "speaking"     — spoken fluency, pronunciation, conversation
 *   "writing"      — paragraphs, emails, essays, formal text
 *   "reading"      — comprehension, inference, skimming
 *   "revision"     — weekly test covering previous 6 days only
 *
 * Fields:
 *   day         {number}   — day number (1–126)
 *   topic       {string}   — exact topic name sent to AI brief
 *   category    {string}   — one of the categories above
 *   level       {string}   — "beginner" | "intermediate" | "advanced"
 *   covers      {number[]} — (revision days only) which days this revises
 *   subTopics   {string[]} — specific skills Gemini must include in that day's content
 *   weekNumber  {number}   — which week (1–18)
 *   dayInWeek   {number}   — 1–7 (7 is always revision)
 *   grammarFocus{string}   — (optional) precise grammar point for sentence design
 *   skillFocus  {string}   — "accuracy" | "fluency" | "range" | "mixed"
 */

const CURRICULUM = [

  // ============================================================
  // WEEK 1 — BEGINNER FOUNDATIONS: BASIC SENTENCE BUILDING
  // ============================================================

  {
    day: 1,
    weekNumber: 1, dayInWeek: 1,
    topic: "Present Simple — Statements",
    category: "tense",
    level: "beginner",
    grammarFocus: "Subject + base verb (he/she/it adds -s). Positive and negative forms.",
    subTopics: ["I/you/we/they + verb", "he/she/it + verb+s", "negative with do not / does not", "basic daily routines"],
    skillFocus: "accuracy"
  },
  {
    day: 2,
    weekNumber: 1, dayInWeek: 2,
    topic: "Present Simple — Questions & Short Answers",
    category: "tense",
    level: "beginner",
    grammarFocus: "Do/Does questions. Yes/No and Wh- questions. Short answers.",
    subTopics: ["Do you...? / Does he...?", "What/Where/When/Who questions", "short answers: Yes, I do / No, she doesn't", "question word order"],
    skillFocus: "accuracy"
  },
  {
    day: 3,
    weekNumber: 1, dayInWeek: 3,
    topic: "Articles — a, an, the, zero article",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Indefinite (a/an), definite (the), zero article rules.",
    subTopics: ["a vs an (vowel sounds)", "first mention vs known reference", "the with unique nouns (the sun)", "zero article with plural/uncountable generics"],
    skillFocus: "accuracy"
  },
  {
    day: 4,
    weekNumber: 1, dayInWeek: 4,
    topic: "Nouns — Singular, Plural & Irregular Forms",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Regular plurals (-s/-es/-ies). Irregular plurals. Countable vs uncountable intro.",
    subTopics: ["regular plural rules", "irregular plurals (man→men, child→children)", "always-plural nouns (scissors, trousers)", "uncountable nouns that seem countable"],
    skillFocus: "accuracy"
  },
  {
    day: 5,
    weekNumber: 1, dayInWeek: 5,
    topic: "Pronouns — Personal, Possessive & Object",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Subject pronouns, object pronouns, possessive adjectives vs possessive pronouns.",
    subTopics: ["I/me/my/mine", "he/him/his", "they/them/their/theirs", "reflexive pronoun intro (myself/yourself)"],
    skillFocus: "accuracy"
  },
  {
    day: 6,
    weekNumber: 1, dayInWeek: 6,
    topic: "Vocabulary — Everyday Objects & Places",
    category: "vocabulary",
    level: "beginner",
    grammarFocus: "Using articles and plurals correctly with everyday nouns.",
    subTopics: ["home objects (furniture, appliances)", "places in a city (bank, hospital, market)", "using 'there is / there are'", "prepositions of place: in, on, at, near, between"],
    skillFocus: "range"
  },
  {
    day: 7,
    weekNumber: 1, dayInWeek: 7,
    topic: "REVISION — Week 1",
    category: "revision",
    level: "beginner",
    covers: [1, 2, 3, 4, 5, 6],
    subTopics: ["Present Simple statements + questions", "articles a/an/the", "plural nouns", "pronouns", "everyday vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 2 — BEGINNER: PAST & CONTINUOUS TENSES
  // ============================================================

  {
    day: 8,
    weekNumber: 2, dayInWeek: 1,
    topic: "Past Simple — Regular Verbs",
    category: "tense",
    level: "beginner",
    grammarFocus: "Regular past tense: add -ed. Spelling rules. Positive and negative.",
    subTopics: ["-ed spelling rules (stop→stopped, try→tried)", "negative: did not + base verb", "common regular verbs", "time expressions: yesterday, last week, ago"],
    skillFocus: "accuracy"
  },
  {
    day: 9,
    weekNumber: 2, dayInWeek: 2,
    topic: "Past Simple — Irregular Verbs & Questions",
    category: "tense",
    level: "beginner",
    grammarFocus: "Top 40 irregular verbs. Did questions. Short answers.",
    subTopics: ["go→went, eat→ate, see→saw, take→took (top 40)", "Did you...? questions", "Wh- past questions", "short answers: Yes, I did / No, she didn't"],
    skillFocus: "accuracy"
  },
  {
    day: 10,
    weekNumber: 2, dayInWeek: 3,
    topic: "Present Continuous — Actions Happening Now",
    category: "tense",
    level: "beginner",
    grammarFocus: "am/is/are + verb-ing. Spelling of -ing forms. Stative verbs that don't use continuous.",
    subTopics: ["-ing spelling (run→running, make→making)", "positive / negative / question forms", "stative verbs (know, like, want, have)", "now / at the moment / currently"],
    skillFocus: "accuracy"
  },
  {
    day: 11,
    weekNumber: 2, dayInWeek: 4,
    topic: "Present Simple vs Present Continuous — Contrast",
    category: "tense",
    level: "beginner",
    grammarFocus: "Habit/routine (simple) vs temporary action (continuous). Signal words.",
    subTopics: ["always/usually/often → simple", "now/today/this week → continuous", "meaning change: I think (opinion) vs I am thinking (activity)", "mixed sentence practice"],
    skillFocus: "accuracy"
  },
  {
    day: 12,
    weekNumber: 2, dayInWeek: 5,
    topic: "Future — will & going to",
    category: "tense",
    level: "beginner",
    grammarFocus: "Will for spontaneous decisions/predictions. Going to for plans/intentions.",
    subTopics: ["will: offers, promises, predictions", "going to: plans, evidence-based predictions", "positive / negative / question forms", "time expressions: tomorrow, next week, soon"],
    skillFocus: "accuracy"
  },
  {
    day: 13,
    weekNumber: 2, dayInWeek: 6,
    topic: "Vocabulary — Food, Eating & Daily Routines",
    category: "vocabulary",
    level: "beginner",
    grammarFocus: "Using present simple and continuous to describe routines and current actions with food vocabulary.",
    subTopics: ["meals and food items", "cooking verbs (boil, fry, bake, chop)", "ordering food / restaurant phrases", "adverbs of frequency: always, sometimes, never"],
    skillFocus: "range"
  },
  {
    day: 14,
    weekNumber: 2, dayInWeek: 7,
    topic: "REVISION — Week 2",
    category: "revision",
    level: "beginner",
    covers: [8, 9, 10, 11, 12, 13],
    subTopics: ["Past Simple regular + irregular", "Present Continuous", "Simple vs Continuous contrast", "will vs going to", "food vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 3 — BEGINNER: ADJECTIVES, ADVERBS & COMPARISONS
  // ============================================================

  {
    day: 15,
    weekNumber: 3, dayInWeek: 1,
    topic: "Adjectives — Order, Gradability & Intensifiers",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Adjective order (opinion-size-age-colour-origin-material). Gradable vs ungradable. Intensifiers.",
    subTopics: ["adjective order: a lovely old Italian car", "very/quite/rather/extremely/absolutely", "gradable: hot, big, tired", "ungradable: freezing, enormous, exhausted"],
    skillFocus: "range"
  },
  {
    day: 16,
    weekNumber: 3, dayInWeek: 2,
    topic: "Comparatives & Superlatives",
    category: "grammar",
    level: "beginner",
    grammarFocus: "One-syllable: -er/-est. Multi-syllable: more/most. Irregular: good/better/best.",
    subTopics: ["short adjectives: bigger, the biggest", "long adjectives: more expensive, the most expensive", "irregular: good/better/best, bad/worse/worst, far/further/furthest", "as...as comparisons"],
    skillFocus: "accuracy"
  },
  {
    day: 17,
    weekNumber: 3, dayInWeek: 3,
    topic: "Adverbs — Manner, Frequency & Degree",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Forming adverbs from adjectives (-ly). Adverb position. Frequency adverbs.",
    subTopics: ["adjective → adverb (quick→quickly, good→well)", "irregular adverbs (fast, hard, late)", "position: front / mid / end", "frequency: always, usually, often, sometimes, rarely, never"],
    skillFocus: "accuracy"
  },
  {
    day: 18,
    weekNumber: 3, dayInWeek: 4,
    topic: "Prepositions — Time, Place & Movement",
    category: "grammar",
    level: "beginner",
    grammarFocus: "At/on/in for time. At/on/in for place. Movement prepositions (to, into, out of, past).",
    subTopics: ["at (specific times), on (days/dates), in (months/years/long periods)", "at (address), on (surface), in (enclosed space)", "movement: go to, walk into, come out of, run past, drive through", "common errors: arrive at/in (not arrive to)"],
    skillFocus: "accuracy"
  },
  {
    day: 19,
    weekNumber: 3, dayInWeek: 5,
    topic: "There is / There are + Quantifiers",
    category: "grammar",
    level: "beginner",
    grammarFocus: "There is/are/was/were. Quantifiers: some, any, much, many, a lot of, a few, a little.",
    subTopics: ["there is (singular), there are (plural)", "some (positive), any (negative/question)", "much + uncountable, many + countable", "a few (countable), a little (uncountable)"],
    skillFocus: "accuracy"
  },
  {
    day: 20,
    weekNumber: 3, dayInWeek: 6,
    topic: "Vocabulary — People, Personality & Appearance",
    category: "vocabulary",
    level: "beginner",
    grammarFocus: "Using adjectives correctly to describe people, applying intensifiers and comparatives.",
    subTopics: ["physical appearance words", "personality adjectives (kind, stubborn, generous)", "describing emotions (happy, anxious, proud)", "collocations: get angry, feel nervous, look tired"],
    skillFocus: "range"
  },
  {
    day: 21,
    weekNumber: 3, dayInWeek: 7,
    topic: "REVISION — Week 3",
    category: "revision",
    level: "beginner",
    covers: [15, 16, 17, 18, 19, 20],
    subTopics: ["adjectives + order", "comparatives + superlatives", "adverbs of manner/frequency", "prepositions of time/place/movement", "quantifiers", "people vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 4 — BEGINNER: MODAL VERBS & OBLIGATIONS
  // ============================================================

  {
    day: 22,
    weekNumber: 4, dayInWeek: 1,
    topic: "Modal Verbs — can, can't, could, couldn't",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Can for ability/permission/request. Could for past ability and polite requests.",
    subTopics: ["ability: I can swim / I could swim when I was young", "permission: Can I...? / Could I...?", "request: Can you...? / Could you...?", "can't for impossibility"],
    skillFocus: "fluency"
  },
  {
    day: 23,
    weekNumber: 4, dayInWeek: 2,
    topic: "Modal Verbs — must, have to, need to, mustn't, don't have to",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Obligation (must/have to). No obligation (don't have to). Prohibition (mustn't).",
    subTopics: ["must (internal obligation), have to (external rule)", "mustn't (prohibition) vs don't have to (no obligation)", "need to / don't need to", "past: had to / didn't have to"],
    skillFocus: "accuracy"
  },
  {
    day: 24,
    weekNumber: 4, dayInWeek: 3,
    topic: "Modal Verbs — should, ought to, had better",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Advice and recommendations. Should vs ought to vs had better.",
    subTopics: ["should / shouldn't for advice", "ought to (same as should, more formal)", "had better (warning of consequence)", "giving and asking for advice structures"],
    skillFocus: "fluency"
  },
  {
    day: 25,
    weekNumber: 4, dayInWeek: 4,
    topic: "Modal Verbs — may, might, could (Possibility)",
    category: "grammar",
    level: "beginner",
    grammarFocus: "May/might/could for present and future possibility. Degrees of certainty.",
    subTopics: ["might / may (50% probability)", "could (possible but uncertain)", "must (near certain), can't (near impossible) for deduction", "positive + negative forms of may/might"],
    skillFocus: "accuracy"
  },
  {
    day: 25,
    weekNumber: 4, dayInWeek: 5,
    topic: "Imperative Sentences & Giving Instructions",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Positive and negative imperatives. Polite imperatives with please/let's.",
    subTopics: ["positive: Open the door.", "negative: Don't touch that.", "let's for suggestions", "polite requests vs direct commands"],
    skillFocus: "fluency"
  },
  {
    day: 26,
    weekNumber: 4, dayInWeek: 5,
    topic: "Imperative Sentences & Giving Instructions",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Positive and negative imperatives. Polite imperatives with please/let's.",
    subTopics: ["positive: Open the door.", "negative: Don't touch that.", "let's for suggestions", "polite requests vs direct commands"],
    skillFocus: "fluency"
  },
  {
    day: 27,
    weekNumber: 4, dayInWeek: 6,
    topic: "Vocabulary — Work, Jobs & Daily Schedule",
    category: "vocabulary",
    level: "beginner",
    grammarFocus: "Using modals (must, should, can) in work and schedule contexts.",
    subTopics: ["job titles and workplaces", "work verbs (apply, resign, hire, promote)", "daily schedule phrases (I have to attend, I am responsible for)", "talking about your job in Present Simple"],
    skillFocus: "range"
  },
  {
    day: 28,
    weekNumber: 4, dayInWeek: 7,
    topic: "REVISION — Week 4",
    category: "revision",
    level: "beginner",
    covers: [22, 23, 24, 25, 26, 27],
    subTopics: ["can/could", "must/have to/mustn't/don't have to", "should/ought to/had better", "may/might/could for possibility", "imperatives", "work vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 5 — BEGINNER: QUESTIONS, CONJUNCTIONS & SENTENCE VARIETY
  // ============================================================

  {
    day: 29,
    weekNumber: 5, dayInWeek: 1,
    topic: "Question Forms — All Types",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Yes/No, Wh-, How, Tag questions. Subject vs object questions.",
    subTopics: ["Wh- words: who/what/where/when/why/how/which/whose", "subject question: Who made this? (no auxiliary)", "object question: What did you make?", "tag questions: It's cold, isn't it?"],
    skillFocus: "accuracy"
  },
  {
    day: 30,
    weekNumber: 5, dayInWeek: 2,
    topic: "Conjunctions — Coordinating (FANBOYS) & Subordinating",
    category: "grammar",
    level: "beginner",
    grammarFocus: "For/And/Nor/But/Or/Yet/So. Because/Although/While/When/If/Unless.",
    subTopics: ["coordinating: and, but, or, so, because", "subordinating: although, even though, unless, until", "joining sentences with correct punctuation", "common errors with 'because' and 'so'"],
    skillFocus: "accuracy"
  },
  {
    day: 31,
    weekNumber: 5, dayInWeek: 3,
    topic: "Conditionals — Zero & First Conditional",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Zero: If + present, present (general truth). First: If + present, will (real future).",
    subTopics: ["zero conditional: If you heat water, it boils.", "first conditional: If it rains, I will stay home.", "unless = if not", "when vs if"],
    skillFocus: "accuracy"
  },
  {
    day: 32,
    weekNumber: 5, dayInWeek: 4,
    topic: "Relative Clauses — who, which, that, where",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Defining relative clauses. Who (people), which/that (things), where (places).",
    subTopics: ["The man who lives next door...", "The book that/which I read...", "The place where I grew up...", "omitting relative pronoun when object"],
    skillFocus: "accuracy"
  },
  {
    day: 33,
    weekNumber: 5, dayInWeek: 5,
    topic: "Past Continuous — Actions in Progress",
    category: "tense",
    level: "beginner",
    grammarFocus: "Was/were + verb-ing. Background actions interrupted by past simple.",
    subTopics: ["was/were + -ing form", "interrupted past: I was cooking when the phone rang.", "two simultaneous past actions: while/as", "past continuous for setting a scene"],
    skillFocus: "accuracy"
  },
  {
    day: 34,
    weekNumber: 5, dayInWeek: 6,
    topic: "Vocabulary — Travel, Transport & Directions",
    category: "vocabulary",
    level: "beginner",
    grammarFocus: "Using prepositions of movement and question forms in travel contexts.",
    subTopics: ["transport types and verbs (catch a bus, miss a flight, take a taxi)", "giving and asking for directions", "travel problems (delayed, cancelled, lost luggage)", "booking phrases (reservation, check-in, departure)"],
    skillFocus: "range"
  },
  {
    day: 35,
    weekNumber: 5, dayInWeek: 7,
    topic: "REVISION — Week 5",
    category: "revision",
    level: "beginner",
    covers: [29, 30, 31, 32, 33, 34],
    subTopics: ["all question types", "conjunctions", "zero + first conditionals", "relative clauses", "past continuous", "travel vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 6 — BEGINNER: PRESENT PERFECT INTRODUCTION
  // ============================================================

  {
    day: 36,
    weekNumber: 6, dayInWeek: 1,
    topic: "Present Perfect — Introduction (have/has + past participle)",
    category: "tense",
    level: "beginner",
    grammarFocus: "Form: have/has + past participle. Use: connecting past to present. Ever/never.",
    subTopics: ["regular past participles (-ed)", "irregular past participles (gone, eaten, written)", "ever/never in questions and negatives", "contrast with Past Simple: I have eaten vs I ate"],
    skillFocus: "accuracy"
  },
  {
    day: 37,
    weekNumber: 6, dayInWeek: 2,
    topic: "Present Perfect — already, yet, just, still",
    category: "tense",
    level: "beginner",
    grammarFocus: "Already (sooner than expected), yet (expected but not done), just (very recently), still (continuing).",
    subTopics: ["I have already finished.", "Have you eaten yet? / I haven't eaten yet.", "She has just arrived.", "He still hasn't called."],
    skillFocus: "accuracy"
  },
  {
    day: 38,
    weekNumber: 6, dayInWeek: 3,
    topic: "Present Perfect — for & since (Duration)",
    category: "tense",
    level: "beginner",
    grammarFocus: "For + period of time. Since + starting point. How long questions.",
    subTopics: ["for: for two years, for a long time", "since: since 2020, since Monday, since I was a child", "How long have you...?", "Present perfect continuous preview (I have been waiting)"],
    skillFocus: "accuracy"
  },
  {
    day: 39,
    weekNumber: 6, dayInWeek: 4,
    topic: "Verb Patterns — Gerund vs Infinitive",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Verbs followed by gerund (-ing). Verbs followed by infinitive (to + verb). Both possible.",
    subTopics: ["gerund after: enjoy, finish, mind, suggest, avoid, consider", "infinitive after: want, need, decide, hope, plan, manage, afford", "both (meaning change): stop doing vs stop to do, remember doing vs remember to do", "adjective + infinitive: happy to help, difficult to understand"],
    skillFocus: "accuracy"
  },
  {
    day: 40,
    weekNumber: 6, dayInWeek: 5,
    topic: "Reported Speech — Statements & Questions",
    category: "grammar",
    level: "beginner",
    grammarFocus: "Backshifting tenses. Reported statements (said that). Reported questions (asked if/whether/wh-).",
    subTopics: ["tense backshift: is→was, will→would, have→had", "She said (that) she was tired.", "He asked if I liked coffee.", "Wh- reported questions: She asked where I lived."],
    skillFocus: "accuracy"
  },
  {
    day: 41,
    weekNumber: 6, dayInWeek: 6,
    topic: "Vocabulary — Health, Body & Medical Situations",
    category: "vocabulary",
    level: "beginner",
    grammarFocus: "Using present perfect and modals in health contexts (I have had a headache, you should see a doctor).",
    subTopics: ["body parts and organs", "symptoms and illnesses (fever, cough, sprain)", "at the doctor / pharmacy phrases", "health advice using should/must/had better"],
    skillFocus: "range"
  },
  {
    day: 42,
    weekNumber: 6, dayInWeek: 7,
    topic: "REVISION — Week 6",
    category: "revision",
    level: "beginner",
    covers: [36, 37, 38, 39, 40, 41],
    subTopics: ["Present Perfect form + uses", "already/yet/just/still", "for/since", "gerund vs infinitive", "reported speech", "health vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 7 — INTERMEDIATE: PASSIVE VOICE & COMPLEX GRAMMAR
  // ============================================================

  {
    day: 43,
    weekNumber: 7, dayInWeek: 1,
    topic: "Passive Voice — Present & Past Simple",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Am/is/are + past participle (present passive). Was/were + past participle (past passive).",
    subTopics: ["forming passive in present and past", "by + agent (when important)", "omitting agent when unknown/unimportant", "choosing active vs passive"],
    skillFocus: "accuracy"
  },
  {
    day: 44,
    weekNumber: 7, dayInWeek: 2,
    topic: "Passive Voice — All Tenses",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Passive in: present continuous, present perfect, future with will, modals.",
    subTopics: ["is being done (present continuous passive)", "has been done (present perfect passive)", "will be done (future passive)", "should be done / must be done (modal passive)"],
    skillFocus: "accuracy"
  },
  {
    day: 45,
    weekNumber: 7, dayInWeek: 3,
    topic: "Second Conditional — Hypothetical Present/Future",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "If + past simple, would + base verb. Unreal/hypothetical situations.",
    subTopics: ["If I were rich, I would travel the world.", "were (not was) for all persons in formal/correct use", "I wish + past simple (related structure)", "second vs first conditional comparison"],
    skillFocus: "accuracy"
  },
  {
    day: 46,
    weekNumber: 7, dayInWeek: 4,
    topic: "Third Conditional — Imagining the Past",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "If + past perfect, would have + past participle. Regret and criticism.",
    subTopics: ["If I had studied, I would have passed.", "mixed conditional preview: If I had studied, I would be a doctor now.", "I wish + past perfect (I wish I had gone)", "should have / could have / might have + past participle"],
    skillFocus: "accuracy"
  },
  {
    day: 47,
    weekNumber: 7, dayInWeek: 5,
    topic: "Past Perfect — Actions Before Another Past Action",
    category: "tense",
    level: "intermediate",
    grammarFocus: "Had + past participle. Sequencing past events. Before/after/by the time/when.",
    subTopics: ["I had already eaten when she arrived.", "By the time he called, I had left.", "past perfect vs past simple narrative", "past perfect in reported speech (backshift)"],
    skillFocus: "accuracy"
  },
  {
    day: 48,
    weekNumber: 7, dayInWeek: 6,
    topic: "Vocabulary — Money, Banking & Finance",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Using passive voice and modals in financial contexts.",
    subTopics: ["financial verbs (invest, borrow, lend, budget, afford)", "bank and transaction vocabulary", "discussing prices and costs", "financial phrasal verbs (pay off, save up, cut down on)"],
    skillFocus: "range"
  },
  {
    day: 49,
    weekNumber: 7, dayInWeek: 7,
    topic: "REVISION — Week 7",
    category: "revision",
    level: "intermediate",
    covers: [43, 44, 45, 46, 47, 48],
    subTopics: ["passive voice (all tenses)", "second conditional", "third conditional", "past perfect", "money vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 8 — INTERMEDIATE: PERFECT TENSES & CONTINUOUS FORMS
  // ============================================================

  {
    day: 50,
    weekNumber: 8, dayInWeek: 1,
    topic: "Present Perfect Continuous",
    category: "tense",
    level: "intermediate",
    grammarFocus: "Have/has been + verb-ing. Emphasis on duration and ongoing activity with visible results.",
    subTopics: ["I have been working for hours. (I'm tired)", "How long have you been waiting?", "present perfect simple vs continuous (result vs activity)", "verbs not used in continuous (know, believe, own)"],
    skillFocus: "accuracy"
  },
  {
    day: 51,
    weekNumber: 8, dayInWeek: 2,
    topic: "Past Perfect Continuous",
    category: "tense",
    level: "intermediate",
    grammarFocus: "Had been + verb-ing. Duration of action before another past event.",
    subTopics: ["She had been crying before he arrived.", "He was tired because he had been running.", "past perfect simple vs continuous", "narrative writing with past perfect continuous"],
    skillFocus: "accuracy"
  },
  {
    day: 52,
    weekNumber: 8, dayInWeek: 3,
    topic: "Future Continuous & Future Perfect",
    category: "tense",
    level: "intermediate",
    grammarFocus: "Will be + -ing (activity in progress at future time). Will have + pp (completed before future time).",
    subTopics: ["This time tomorrow, I will be flying.", "By Friday, I will have finished the report.", "future continuous for polite enquiry: Will you be coming?", "by the time + future perfect"],
    skillFocus: "accuracy"
  },
  {
    day: 53,
    weekNumber: 8, dayInWeek: 4,
    topic: "Phrasal Verbs — Most Common Sets",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Separable vs inseparable phrasal verbs. Particles changing meaning.",
    subTopics: ["up (increase/complete): give up, turn up, finish up", "out (away/complete): find out, run out, work out", "on (continue/wear): carry on, put on, get on", "off (away/start): take off, call off, set off"],
    skillFocus: "range"
  },
  {
    day: 54,
    weekNumber: 8, dayInWeek: 5,
    topic: "Wish, If Only & Hypothetical Structures",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Wish + past (present wish), wish + past perfect (past regret), wish + would (irritation).",
    subTopics: ["I wish I spoke French. (present ability)", "I wish I hadn't said that. (past regret)", "I wish you would stop. (irritation about habit)", "If only... (stronger than wish)", "It's time + past simple"],
    skillFocus: "accuracy"
  },
  {
    day: 55,
    weekNumber: 8, dayInWeek: 6,
    topic: "Vocabulary — Technology & The Internet",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Using all tenses and phrasal verbs in tech contexts.",
    subTopics: ["internet and device vocabulary", "tech verbs (upload, download, stream, hack, encrypt)", "discussing technology advantages/disadvantages", "tech phrasal verbs (log in, set up, shut down, back up)"],
    skillFocus: "range"
  },
  {
    day: 56,
    weekNumber: 8, dayInWeek: 7,
    topic: "REVISION — Week 8",
    category: "revision",
    level: "intermediate",
    covers: [50, 51, 52, 53, 54, 55],
    subTopics: ["present perfect continuous", "past perfect continuous", "future continuous + future perfect", "phrasal verbs", "wish/if only", "technology vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 9 — INTERMEDIATE: NOUNS, DETERMINERS & REFERENCE
  // ============================================================

  {
    day: 57,
    weekNumber: 9, dayInWeek: 1,
    topic: "Noun Phrases & Compound Nouns",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Building detailed noun phrases. Compound nouns (noun + noun). Genitive 's vs of.",
    subTopics: ["pre-modification: a tall, dark-haired young man", "compound nouns: bus stop, coffee cup, phone charger", "genitive 's (possession): the teacher's book", "of (relationship/part): the roof of the house"],
    skillFocus: "range"
  },
  {
    day: 58,
    weekNumber: 9, dayInWeek: 2,
    topic: "Determiners — all, both, each, every, either, neither",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Precise use of universal and distributive determiners.",
    subTopics: ["all (the) + plural/uncountable vs every + singular", "both (two), all (three+)", "each (individual focus) vs every (group focus)", "either (one of two), neither (not one of two)"],
    skillFocus: "accuracy"
  },
  {
    day: 59,
    weekNumber: 9, dayInWeek: 3,
    topic: "Cleft Sentences & Emphasis Structures",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "It-clefts (It was X who/that...). Wh-clefts (What I want is...). Do-emphasis.",
    subTopics: ["It was Maria who found the key.", "What I need is a holiday.", "Do / did for emphasis: I do like it!", "fronting for emphasis: That film, I loved."],
    skillFocus: "range"
  },
  {
    day: 60,
    weekNumber: 9, dayInWeek: 4,
    topic: "Non-defining Relative Clauses & Reduced Relatives",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Non-defining (extra info, commas). Reduced relatives (participial phrases).",
    subTopics: ["My brother, who lives in London, is a doctor. (non-defining — commas required)", "which referring to whole clause: She was late, which annoyed everyone.", "The man sitting in the corner... (reduced: who is sitting)", "The letter written last week... (passive reduced relative)"],
    skillFocus: "accuracy"
  },
  {
    day: 61,
    weekNumber: 9, dayInWeek: 5,
    topic: "Inversion & Formal Structures",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Negative adverbials + inversion. Conditional inversion. Formal written style.",
    subTopics: ["Never have I seen such courage.", "Not only did he arrive late, but he also forgot...", "Should you need assistance, please contact us. (formal if)", "Hardly/scarcely/no sooner + inversion"],
    skillFocus: "range"
  },
  {
    day: 62,
    weekNumber: 9, dayInWeek: 6,
    topic: "Vocabulary — Environment & Climate Change",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Using passive voice and complex sentences in environmental discussions.",
    subTopics: ["environment nouns (deforestation, carbon footprint, biodiversity)", "verbs of change (deplete, emit, pollute, conserve)", "discussing causes and effects", "formal opinion phrases: It is widely believed that..."],
    skillFocus: "range"
  },
  {
    day: 63,
    weekNumber: 9, dayInWeek: 7,
    topic: "REVISION — Week 9",
    category: "revision",
    level: "intermediate",
    covers: [57, 58, 59, 60, 61, 62],
    subTopics: ["noun phrases + compound nouns", "determiners", "cleft sentences", "non-defining relatives", "inversion", "environment vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 10 — INTERMEDIATE: DISCOURSE, LINKING & COHESION
  // ============================================================

  {
    day: 64,
    weekNumber: 10, dayInWeek: 1,
    topic: "Discourse Markers & Linking Words",
    category: "writing",
    level: "intermediate",
    grammarFocus: "Addition, contrast, result, reason, sequence, example, concession markers.",
    subTopics: ["addition: furthermore, in addition, moreover, what is more", "contrast: however, nevertheless, on the other hand, in spite of", "result: therefore, consequently, as a result, hence", "concession: although, even though, despite, while, whereas"],
    skillFocus: "range"
  },
  {
    day: 65,
    weekNumber: 10, dayInWeek: 2,
    topic: "Cohesion — Reference, Substitution & Ellipsis",
    category: "writing",
    level: "intermediate",
    grammarFocus: "Text cohesion through pronouns, demonstratives, synonyms, and substitution.",
    subTopics: ["reference: pronouns replacing nouns", "demonstratives as reference: this/that/these/those + noun", "substitution: one/ones/do so", "ellipsis: omitting repeated elements"],
    skillFocus: "range"
  },
  {
    day: 66,
    weekNumber: 10, dayInWeek: 3,
    topic: "Paragraph Writing — Topic Sentence, Supporting Details, Conclusion",
    category: "writing",
    level: "intermediate",
    grammarFocus: "Clear paragraph structure. Unity and coherence. Appropriate register.",
    subTopics: ["topic sentence states the main idea", "supporting sentences provide evidence/examples", "concluding sentence wraps up or transitions", "avoiding repetition using synonyms and reference"],
    skillFocus: "range"
  },
  {
    day: 67,
    weekNumber: 10, dayInWeek: 4,
    topic: "Formal vs Informal Writing — Register & Tone",
    category: "writing",
    level: "intermediate",
    grammarFocus: "Formal: passive, complex vocab, full forms. Informal: contractions, phrasal verbs, simple vocab.",
    subTopics: ["formal: I am writing to inform you that...", "informal: Just wanted to let you know...", "avoiding contractions in formal writing", "formal vocabulary substitutions: obtain=get, commence=start, sufficient=enough"],
    skillFocus: "range"
  },
  {
    day: 68,
    weekNumber: 10, dayInWeek: 5,
    topic: "Reported Speech — Commands, Requests & Suggestions",
    category: "grammar",
    level: "intermediate",
    grammarFocus: "Reported imperatives (told to/not to). Reported suggestions (suggested -ing/that). Reporting verbs.",
    subTopics: ["told me to... / warned me not to...", "suggested (that) + past / suggested -ing", "reporting verbs: advised, reminded, promised, refused, offered", "say vs tell (say + clause, tell + person + clause)"],
    skillFocus: "accuracy"
  },
  {
    day: 69,
    weekNumber: 10, dayInWeek: 6,
    topic: "Vocabulary — Education & Learning",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Using formal writing structures and reported speech in educational contexts.",
    subTopics: ["academic vocabulary (curriculum, assessment, lecture, thesis)", "education verbs (enrol, graduate, revise, submit, cite)", "describing learning experiences", "phrasal verbs in academic contexts (hand in, drop out, fall behind)"],
    skillFocus: "range"
  },
  {
    day: 70,
    weekNumber: 10, dayInWeek: 7,
    topic: "REVISION — Week 10",
    category: "revision",
    level: "intermediate",
    covers: [64, 65, 66, 67, 68, 69],
    subTopics: ["discourse markers", "text cohesion", "paragraph structure", "formal vs informal register", "reported commands/suggestions", "education vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 11 — INTERMEDIATE: SPEAKING FLUENCY & PRONUNCIATION
  // ============================================================

  {
    day: 71,
    weekNumber: 11, dayInWeek: 1,
    topic: "Pronunciation — Vowel Sounds & Minimal Pairs",
    category: "speaking",
    level: "intermediate",
    grammarFocus: "The 20 vowel sounds of English. Minimal pairs. Short vs long vowels.",
    subTopics: ["short vowels: /ɪ/ /e/ /æ/ /ɒ/ /ʌ/ /ʊ/", "long vowels: /iː/ /ɑː/ /ɔː/ /uː/ /ɜː/", "minimal pairs: ship/sheep, pen/pan, full/fool", "common Indian English mispronunciations"],
    skillFocus: "fluency"
  },
  {
    day: 72,
    weekNumber: 11, dayInWeek: 2,
    topic: "Pronunciation — Consonant Clusters & Word Stress",
    category: "speaking",
    level: "intermediate",
    grammarFocus: "Consonant clusters at word start/end. Primary and secondary word stress. Schwa /ə/.",
    subTopics: ["clusters: /str/ /spl/ /nks/ /lts/", "word stress rules: nouns vs verbs (REcord vs reCORD)", "schwa: the most common English vowel sound", "stress in compound nouns: BUSstop vs bus STOP"],
    skillFocus: "fluency"
  },
  {
    day: 73,
    weekNumber: 11, dayInWeek: 3,
    topic: "Connected Speech — Linking, Elision & Assimilation",
    category: "speaking",
    level: "intermediate",
    grammarFocus: "How words connect in natural speech. Linking consonant-vowel. Weak forms.",
    subTopics: ["linking: an apple → /ən_æpl/", "elision: next day → /neks day/ (t dropped)", "assimilation: ten boys → /tem boys/ (n→m)", "weak forms: can /kən/, of /əv/, to /tə/"],
    skillFocus: "fluency"
  },
  {
    day: 74,
    weekNumber: 11, dayInWeek: 4,
    topic: "Conversational Phrases — Agreeing, Disagreeing & Hedging",
    category: "speaking",
    level: "intermediate",
    grammarFocus: "Softening disagreement. Hedging with adverbs. Turn-taking phrases.",
    subTopics: ["agreeing: Exactly, I couldn't agree more, That's a fair point.", "disagreeing politely: I see your point, but... / I'm not sure I agree because...", "hedging: I think, It seems to me, To some extent, arguably", "turn-taking: Actually, / Going back to what you said... / To add to that..."],
    skillFocus: "fluency"
  },
  {
    day: 75,
    weekNumber: 11, dayInWeek: 5,
    topic: "Describing Processes & Sequences — Speaking",
    category: "speaking",
    level: "intermediate",
    grammarFocus: "Using sequencing language and passive voice to describe how things work/happen.",
    subTopics: ["first, then, next, after that, finally", "passive for processes: The water is heated until...", "describing a process clearly and logically", "adding detail: once this is done... / at this point..."],
    skillFocus: "fluency"
  },
  {
    day: 76,
    weekNumber: 11, dayInWeek: 6,
    topic: "Vocabulary — Media, News & Opinion",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Using hedging language and discourse markers in opinion and news contexts.",
    subTopics: ["media vocabulary (headline, article, bias, censorship, broadcast)", "verbs for reporting: claim, argue, state, allege, deny", "giving opinions with appropriate hedging", "critical thinking phrases: This suggests that... / The evidence implies..."],
    skillFocus: "range"
  },
  {
    day: 77,
    weekNumber: 11, dayInWeek: 7,
    topic: "REVISION — Week 11",
    category: "revision",
    level: "intermediate",
    covers: [71, 72, 73, 74, 75, 76],
    subTopics: ["vowel and consonant sounds", "word stress + schwa", "connected speech", "agreeing/disagreeing phrases", "describing processes", "media vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 12 — INTERMEDIATE: ADVANCED VOCABULARY & IDIOMS
  // ============================================================

  {
    day: 78,
    weekNumber: 12, dayInWeek: 1,
    topic: "Collocations — Verb + Noun & Adjective + Noun",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Strong collocations in English. Common errors from direct translation.",
    subTopics: ["make vs do: make a decision, do homework, make progress, do damage", "have vs take: have a bath, take a shower, have a look, take a risk", "strong adjective collocations: heavy rain, strong coffee, hard work", "common errors: *do a mistake → make a mistake"],
    skillFocus: "range"
  },
  {
    day: 79,
    weekNumber: 12, dayInWeek: 2,
    topic: "Idiomatic Expressions — Body, Animals & Nature",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Understanding and using common idiomatic expressions in context.",
    subTopics: ["body idioms: hit the nail on the head, cost an arm and a leg, keep an eye on", "animal idioms: let the cat out of the bag, beat around the bush, a fish out of water", "nature idioms: under the weather, in hot water, weather the storm", "using idioms appropriately (not overusing)"],
    skillFocus: "range"
  },
  {
    day: 80,
    weekNumber: 12, dayInWeek: 3,
    topic: "Prefixes & Suffixes — Building Vocabulary",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Common prefixes (un-, dis-, mis-, over-, under-, re-) and suffixes (-tion, -ness, -ful, -less, -ment, -ity).",
    subTopics: ["negative prefixes: un-, dis-, il-, ir-, im-, in-", "other prefixes: over-, under-, mis-, re-, pre-, post-", "noun suffixes: -tion/-sion, -ment, -ness, -ity, -er/-or", "adjective suffixes: -ful, -less, -ous, -al, -ive, -able/-ible"],
    skillFocus: "range"
  },
  {
    day: 81,
    weekNumber: 12, dayInWeek: 4,
    topic: "Synonyms, Antonyms & Connotation",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Choosing between synonyms based on connotation, register, and precision.",
    subTopics: ["synonym groups with subtle differences: said/claimed/announced/whispered", "positive vs negative connotation: determined vs stubborn, confident vs arrogant", "formal vs informal synonyms: begin/start, purchase/buy, assist/help", "building a more varied writing vocabulary"],
    skillFocus: "range"
  },
  {
    day: 82,
    weekNumber: 12, dayInWeek: 5,
    topic: "Reading Skills — Inference, Implication & Tone",
    category: "reading",
    level: "intermediate",
    grammarFocus: "Reading between the lines. Identifying writer's attitude and purpose from vocabulary choices.",
    subTopics: ["inferring meaning from context clues", "identifying tone: critical, ironic, enthusiastic, neutral", "understanding implicit meaning vs explicit statement", "purpose of a text: to persuade, inform, entertain, criticise"],
    skillFocus: "range"
  },
  {
    day: 83,
    weekNumber: 12, dayInWeek: 6,
    topic: "Vocabulary — Society, Culture & Traditions",
    category: "vocabulary",
    level: "intermediate",
    grammarFocus: "Using advanced vocabulary in social/cultural discussions with appropriate hedging.",
    subTopics: ["social nouns (community, diversity, inequality, integration)", "cultural verbs (celebrate, preserve, adopt, reject, influence)", "discussing social issues with balance", "formal discourse: It can be argued that... / One perspective is..."],
    skillFocus: "range"
  },
  {
    day: 84,
    weekNumber: 12, dayInWeek: 7,
    topic: "REVISION — Week 12",
    category: "revision",
    level: "intermediate",
    covers: [78, 79, 80, 81, 82, 83],
    subTopics: ["collocations", "idioms", "prefixes + suffixes", "synonyms + connotation", "inference in reading", "society vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 13 — ADVANCED: COMPLEX GRAMMAR & NUANCED USE
  // ============================================================

  {
    day: 85,
    weekNumber: 13, dayInWeek: 1,
    topic: "Mixed Conditionals & Conditional Variations",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Mixed conditional (past hypothetical → present result). Variations with could/might/should.",
    subTopics: ["If I had taken that job, I would be rich now.", "If I were braver, I would have spoken up.", "mixed with could/might: I might have known better", "inverted conditionals with should/had/were (formal)"],
    skillFocus: "accuracy"
  },
  {
    day: 86,
    weekNumber: 13, dayInWeek: 2,
    topic: "Advanced Modal Verbs — Deduction, Speculation & Criticism",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Must have / can't have / might have / should have / needn't have + past participle.",
    subTopics: ["deduction about past: She must have left early.", "possibility: He might have forgotten.", "impossibility: It can't have been him.", "criticism: You should have told me. / You needn't have worried."],
    skillFocus: "accuracy"
  },
  {
    day: 87,
    weekNumber: 13, dayInWeek: 3,
    topic: "Subjunctive Mood — Formal & Academic Use",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Present subjunctive (base form) after suggest/insist/recommend/demand/it is essential that.",
    subTopics: ["I suggest that he be informed immediately.", "It is essential that the report be submitted by Friday.", "were-subjunctive: If I were you / Were I to go...", "subjunctive in formal written English vs informal spoken English"],
    skillFocus: "accuracy"
  },
  {
    day: 88,
    weekNumber: 13, dayInWeek: 4,
    topic: "Nominalisation — Academic & Formal Register",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Converting verbs/adjectives to nouns to create formal, dense prose.",
    subTopics: ["verb → noun: decide→decision, analyse→analysis, develop→development", "adjective → noun: important→importance, different→difference", "why nominalisation is used in academic writing", "avoiding overuse: when verbs are clearer"],
    skillFocus: "range"
  },
  {
    day: 89,
    weekNumber: 13, dayInWeek: 5,
    topic: "Advanced Passive — Impersonal & Reporting Passives",
    category: "grammar",
    level: "advanced",
    grammarFocus: "It is said that... / He is believed to... / The problem is thought to be...",
    subTopics: ["It is reported that the economy is recovering.", "He is known to have been in the country.", "The plan is believed to have failed.", "distancing effect of impersonal passive in academic/news writing"],
    skillFocus: "accuracy"
  },
  {
    day: 90,
    weekNumber: 13, dayInWeek: 6,
    topic: "Vocabulary — Business & Professional Communication",
    category: "vocabulary",
    level: "advanced",
    grammarFocus: "Using nominalisation, advanced passives and formal structures in business contexts.",
    subTopics: ["business nouns (stakeholder, revenue, merger, turnover, compliance)", "professional verbs (negotiate, allocate, implement, delegate, oversee)", "formal email and meeting language", "business idioms: cut corners, get the ball rolling, on the same page"],
    skillFocus: "range"
  },
  {
    day: 91,
    weekNumber: 13, dayInWeek: 7,
    topic: "REVISION — Week 13",
    category: "revision",
    level: "advanced",
    covers: [85, 86, 87, 88, 89, 90],
    subTopics: ["mixed conditionals", "advanced modals for deduction/criticism", "subjunctive mood", "nominalisation", "impersonal passive", "business vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 14 — ADVANCED: WRITING CRAFT
  // ============================================================

  {
    day: 92,
    weekNumber: 14, dayInWeek: 1,
    topic: "Essay Writing — Argument Structure & Thesis Statements",
    category: "writing",
    level: "advanced",
    grammarFocus: "Clear argumentation. Thesis statement writing. Logical progression.",
    subTopics: ["strong vs weak thesis statements", "introduction structure: hook, background, thesis", "PEEL paragraph: Point, Evidence, Explanation, Link", "counterargument + rebuttal"],
    skillFocus: "range"
  },
  {
    day: 93,
    weekNumber: 14, dayInWeek: 2,
    topic: "Academic Writing — Hedging & Cautious Language",
    category: "writing",
    level: "advanced",
    grammarFocus: "Using tentative language appropriately. Avoiding overconfident claims.",
    subTopics: ["hedging verbs: suggest, indicate, appear, seem, tend to", "hedging adverbs: possibly, apparently, generally, largely, relatively", "modal hedging: may, might, could (not must)", "contrast: overhedging (weak) vs no hedging (overconfident)"],
    skillFocus: "range"
  },
  {
    day: 94,
    weekNumber: 14, dayInWeek: 3,
    topic: "Formal Email & Letter Writing",
    category: "writing",
    level: "advanced",
    grammarFocus: "Formal opening/closing phrases. Appropriate passive. Clear purpose statements.",
    subTopics: ["formal openings: Dear Mr/Ms..., To Whom It May Concern", "purpose statements: I am writing with regard to... / I am writing to enquire about...", "formal closings: Yours sincerely / faithfully / Best regards", "email types: complaint, enquiry, request, apology, follow-up"],
    skillFocus: "range"
  },
  {
    day: 95,
    weekNumber: 14, dayInWeek: 4,
    topic: "Narrative Writing — Voice, Viewpoint & Tense Control",
    category: "writing",
    level: "advanced",
    grammarFocus: "Narrative techniques: first vs third person. Using past simple / continuous / perfect for timeline.",
    subTopics: ["first person: intimate, subjective, limited perspective", "third person: more flexible, objective possible", "tense consistency in narrative", "showing vs telling: use specific detail not general statements"],
    skillFocus: "range"
  },
  {
    day: 96,
    weekNumber: 14, dayInWeek: 5,
    topic: "Persuasive Writing & Rhetorical Devices",
    category: "writing",
    level: "advanced",
    grammarFocus: "Rhetorical questions, tricolon, anaphora, direct address, concession-rebuttal.",
    subTopics: ["rhetorical question: Is this really the society we want?", "tricolon: We came, we saw, we conquered.", "anaphora: repetition for emphasis", "direct address: You know as well as I do...", "concession: While it is true that... / Admittedly..."],
    skillFocus: "range"
  },
  {
    day: 97,
    weekNumber: 14, dayInWeek: 6,
    topic: "Vocabulary — Science, Research & Critical Thinking",
    category: "vocabulary",
    level: "advanced",
    grammarFocus: "Using academic hedging and nominalisation in science/research contexts.",
    subTopics: ["research nouns (hypothesis, methodology, empirical, variable, correlation)", "critical verbs (examine, evaluate, refute, substantiate, validate)", "discussing data and findings", "logical connectors: consequently, it follows that, this implies"],
    skillFocus: "range"
  },
  {
    day: 98,
    weekNumber: 14, dayInWeek: 7,
    topic: "REVISION — Week 14",
    category: "revision",
    level: "advanced",
    covers: [92, 93, 94, 95, 96, 97],
    subTopics: ["essay structure + thesis", "academic hedging", "formal email/letter", "narrative writing", "persuasive writing", "science vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 15 — ADVANCED: NUANCED GRAMMAR & STYLE
  // ============================================================

  {
    day: 99,
    weekNumber: 15, dayInWeek: 1,
    topic: "Participle Clauses — Present, Past & Perfect",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Condensing two clauses into one using participles. Formal written style.",
    subTopics: ["present: Walking down the street, she noticed a sign. (simultaneous)", "past: Exhausted by the journey, he fell asleep. (passive/result)", "perfect: Having finished the report, she left the office. (sequence)", "dangling participle errors to avoid"],
    skillFocus: "accuracy"
  },
  {
    day: 100,
    weekNumber: 15, dayInWeek: 2,
    topic: "Appositives & Absolute Phrases",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Appositive noun phrases to rename/describe. Absolute phrases for complex style.",
    subTopics: ["appositive: My sister, a cardiologist, advised me...", "essential vs non-essential appositives", "absolute phrase: His hands trembling, he opened the letter.", "using these for sentence variety in formal writing"],
    skillFocus: "range"
  },
  {
    day: 101,
    weekNumber: 15, dayInWeek: 3,
    topic: "Fronting, Topicalisation & Information Structure",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Moving elements to sentence front for emphasis and information flow.",
    subTopics: ["adverbial fronting: In the corner sat a man.", "object fronting: This book, I have read three times.", "theme and rheme in information structure", "given-new principle in cohesive writing"],
    skillFocus: "range"
  },
  {
    day: 102,
    weekNumber: 15, dayInWeek: 4,
    topic: "Advanced Tense Interplay in Narrative",
    category: "tense",
    level: "advanced",
    grammarFocus: "Mixing tenses deliberately for narrative effect. Historical present. Tense shift for commentary.",
    subTopics: ["historical present for dramatic narration: So he walks in and says...", "present for general truths within past narrative", "past perfect for events before the main narrative timeline", "tense shift from narrative to direct speech"],
    skillFocus: "fluency"
  },
  {
    day: 103,
    weekNumber: 15, dayInWeek: 5,
    topic: "Stance & Attitude Markers in Writing and Speech",
    category: "writing",
    level: "advanced",
    grammarFocus: "Expressing certainty, doubt, attitude, and source explicitly.",
    subTopics: ["certainty: clearly, undoubtedly, inevitably, obviously", "doubt: arguably, seemingly, supposedly, allegedly", "attitude: unfortunately, remarkably, surprisingly, crucially", "source markers: according to, based on, as stated by"],
    skillFocus: "range"
  },
  {
    day: 104,
    weekNumber: 15, dayInWeek: 6,
    topic: "Vocabulary — Law, Rights & Politics",
    category: "vocabulary",
    level: "advanced",
    grammarFocus: "Using subjunctive, advanced passives and formal structures in legal/political contexts.",
    subTopics: ["legal nouns (legislation, jurisdiction, plaintiff, verdict, statute)", "political vocabulary (sovereignty, ratify, amendment, veto, constituency)", "discussing rights and responsibilities", "formal conditional structures in legal language"],
    skillFocus: "range"
  },
  {
    day: 105,
    weekNumber: 15, dayInWeek: 7,
    topic: "REVISION — Week 15",
    category: "revision",
    level: "advanced",
    covers: [99, 100, 101, 102, 103, 104],
    subTopics: ["participle clauses", "appositives + absolute phrases", "fronting + topicalisation", "advanced tense interplay", "stance markers", "law + politics vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 16 — ADVANCED: SPOKEN ENGLISH MASTERY
  // ============================================================

  {
    day: 106,
    weekNumber: 16, dayInWeek: 1,
    topic: "Sentence Stress & Intonation Patterns",
    category: "speaking",
    level: "advanced",
    grammarFocus: "Nuclear stress. Falling/rising intonation. Meaning changes through stress shifts.",
    subTopics: ["nuclear stress: SHE didn't take it (not someone else)", "falling intonation: statements, commands, Wh- questions", "rising intonation: yes/no questions, lists (except last item), uncertainty", "tone units and thought groups in fluent speech"],
    skillFocus: "fluency"
  },
  {
    day: 107,
    weekNumber: 16, dayInWeek: 2,
    topic: "Spoken Grammar — Features of Natural Speech",
    category: "speaking",
    level: "advanced",
    grammarFocus: "Vague language, fillers, tails, headers, and repairs in natural conversation.",
    subTopics: ["vague language: sort of, kind of, roughly, around, approximately", "fillers: well, you know, I mean, like, right", "tails: It's expensive, isn't it? / She's nice, your sister.", "headers: That restaurant we went to last week — it's closing down."],
    skillFocus: "fluency"
  },
  {
    day: 108,
    weekNumber: 16, dayInWeek: 3,
    topic: "Advanced Conversation — Debate & Discussion Skills",
    category: "speaking",
    level: "advanced",
    grammarFocus: "Structuring arguments in speech. Responding to counterarguments. Academic spoken discourse.",
    subTopics: ["introducing a point: The way I see it... / My view is that...", "challenging politely: I take your point, but... / Are you suggesting that...?", "conceding: I accept that, however... / You raise a valid concern, but...", "summarising your argument: To sum up, I believe..."],
    skillFocus: "fluency"
  },
  {
    day: 109,
    weekNumber: 16, dayInWeek: 4,
    topic: "Presentations & Public Speaking",
    category: "speaking",
    level: "advanced",
    grammarFocus: "Signposting language. Referencing visuals. Managing questions. Handling nerves linguistically.",
    subTopics: ["opening: Good morning. I'd like to talk to you today about...", "signposting: Turning to the next point... / As I mentioned earlier...", "referencing data: As you can see from this slide... / The graph shows...", "closing: To conclude, I'd like to emphasise... / Are there any questions?"],
    skillFocus: "fluency"
  },
  {
    day: 110,
    weekNumber: 16, dayInWeek: 5,
    topic: "Listening Strategies — Note-taking, Inference & Understanding Accents",
    category: "reading",
    level: "advanced",
    grammarFocus: "Active listening skills. Identifying key information. Understanding reduced speech.",
    subTopics: ["predicting content before listening", "listening for gist vs detail", "identifying speaker attitude from stress and intonation", "recognising reduced forms in fast speech: gonna, wanna, kinda, hafta"],
    skillFocus: "fluency"
  },
  {
    day: 111,
    weekNumber: 16, dayInWeek: 6,
    topic: "Vocabulary — Art, Culture & Aesthetics",
    category: "vocabulary",
    level: "advanced",
    grammarFocus: "Using rhetorical and evaluative language in cultural discussions.",
    subTopics: ["art vocabulary (aesthetic, composition, perspective, contrast, symbolism)", "cultural analysis verbs (interpret, critique, convey, evoke, depict)", "describing emotional response to art and culture", "reviewing and evaluating: This work is remarkable for its..."],
    skillFocus: "range"
  },
  {
    day: 112,
    weekNumber: 16, dayInWeek: 7,
    topic: "REVISION — Week 16",
    category: "revision",
    level: "advanced",
    covers: [106, 107, 108, 109, 110, 111],
    subTopics: ["sentence stress + intonation", "spoken grammar features", "debate + discussion language", "presentation skills", "listening strategies", "art + culture vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 17 — ADVANCED: READING MASTERY & CRITICAL ANALYSIS
  // ============================================================

  {
    day: 113,
    weekNumber: 17, dayInWeek: 1,
    topic: "Critical Reading — Argument Analysis & Logical Fallacies",
    category: "reading",
    level: "advanced",
    grammarFocus: "Identifying claims, evidence, reasoning. Spotting weak arguments and fallacies.",
    subTopics: ["claim vs evidence vs reasoning", "logical fallacies: straw man, ad hominem, false dichotomy, slippery slope", "evaluating source credibility", "distinguishing fact from opinion in text"],
    skillFocus: "range"
  },
  {
    day: 114,
    weekNumber: 17, dayInWeek: 2,
    topic: "Stylistic Devices — Metaphor, Irony & Allusion",
    category: "reading",
    level: "advanced",
    grammarFocus: "Understanding and using literary/stylistic devices for expressive writing.",
    subTopics: ["metaphor and extended metaphor", "irony types: verbal, situational, dramatic", "allusion to history, literature, culture", "hyperbole, understatement, litotes (not uncommon = fairly common)"],
    skillFocus: "range"
  },
  {
    day: 115,
    weekNumber: 17, dayInWeek: 3,
    topic: "Complex Sentence Structures — Embedding & Subordination",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Deep sentence embedding. Multiple levels of subordination without losing clarity.",
    subTopics: ["centre-embedded clauses: The report that the team which won the award submitted was excellent.", "stacked pre-modification: a rapidly accelerating long-term cultural change", "balancing complexity with clarity — when to simplify", "sentence variety: mixing short and long sentences for rhythm"],
    skillFocus: "range"
  },
  {
    day: 116,
    weekNumber: 17, dayInWeek: 4,
    topic: "Discourse Analysis — Cohesion Across a Full Text",
    category: "writing",
    level: "advanced",
    grammarFocus: "Lexical chains, pronoun tracking, thematic progression in a complete text.",
    subTopics: ["lexical cohesion: repetition, synonyms, hyponyms, antonyms as reference", "thematic progression: constant theme, zigzag theme, split rheme", "analysing a sample text for cohesion", "writing a cohesive extended paragraph (300+ words)"],
    skillFocus: "range"
  },
  {
    day: 117,
    weekNumber: 17, dayInWeek: 5,
    topic: "Pragmatics — Speech Acts, Politeness & Implicature",
    category: "speaking",
    level: "advanced",
    grammarFocus: "What sentences do (request/apologise/promise/warn). Indirect speech acts. Grice's maxims.",
    subTopics: ["direct vs indirect speech acts: Can you pass the salt? (request, not ability question)", "politeness strategies: positive face, negative face", "Grice's maxims: quantity, quality, relation, manner", "implicature: what is implied but not stated"],
    skillFocus: "fluency"
  },
  {
    day: 118,
    weekNumber: 17, dayInWeek: 6,
    topic: "Vocabulary — Philosophy, Ethics & Abstract Thinking",
    category: "vocabulary",
    level: "advanced",
    grammarFocus: "Using abstract nouns, stance markers and complex hedging in philosophical contexts.",
    subTopics: ["philosophical nouns (morality, autonomy, consequentialism, epistemic, paradigm)", "ethical adjectives (virtuous, culpable, inalienable, contentious, ambiguous)", "abstract discussion structures: One might argue that... / It is debatable whether...", "expressing nuance: The distinction between X and Y is often overlooked."],
    skillFocus: "range"
  },
  {
    day: 119,
    weekNumber: 17, dayInWeek: 7,
    topic: "REVISION — Week 17",
    category: "revision",
    level: "advanced",
    covers: [113, 114, 115, 116, 117, 118],
    subTopics: ["critical reading + fallacies", "stylistic devices", "complex embedding", "discourse cohesion", "pragmatics + implicature", "philosophy + ethics vocabulary"],
    skillFocus: "mixed"
  },

  // ============================================================
  // WEEK 18 — ADVANCED: MASTERY CONSOLIDATION
  // ============================================================

  {
    day: 120,
    weekNumber: 18, dayInWeek: 1,
    topic: "Register Shifting — Adapting Language for Any Audience",
    category: "writing",
    level: "advanced",
    grammarFocus: "Conscious control of register: formal, semi-formal, informal, academic, professional, creative.",
    subTopics: ["rewriting the same content in 3 registers", "vocabulary, grammar, and sentence structure differences per register", "knowing when to shift (audience, purpose, medium)", "common register errors (too casual in formal writing, too stiff in conversation)"],
    skillFocus: "range"
  },
  {
    day: 121,
    weekNumber: 18, dayInWeek: 2,
    topic: "Advanced Error Analysis — Common Persistent Mistakes",
    category: "grammar",
    level: "advanced",
    grammarFocus: "Deep correction of the most persistent grammar errors in Indian English speakers.",
    subTopics: ["article errors (zero article where the is needed)", "tense errors (present for past narratives)", "preposition errors (discuss about, marry with, cope up with)", "unnecessary progressive (I am understanding vs I understand)"],
    skillFocus: "accuracy"
  },
  {
    day: 122,
    weekNumber: 18, dayInWeek: 3,
    topic: "Spoken Fluency Workshop — Speed, Rhythm & Confidence",
    category: "speaking",
    level: "advanced",
    grammarFocus: "Fluency over accuracy focus. Overcoming hesitation. Using communication strategies.",
    subTopics: ["communication strategies: paraphrasing, approximation, circumlocution", "self-repair without losing fluency: ...or rather... / what I mean is...", "extending answers: not just yes/no but developing ideas", "speaking at natural pace without over-monitoring"],
    skillFocus: "fluency"
  },
  {
    day: 123,
    weekNumber: 18, dayInWeek: 4,
    topic: "Writing a Complete Discursive Essay — End to End",
    category: "writing",
    level: "advanced",
    grammarFocus: "Full integration of all writing skills: structure, hedging, cohesion, register, vocabulary.",
    subTopics: ["planning: 5-minute outline before writing", "introduction with hook, background and thesis", "3 body paragraphs using PEEL + counterargument", "conclusion: synthesis not repetition"],
    skillFocus: "range"
  },
  {
    day: 124,
    weekNumber: 18, dayInWeek: 5,
    topic: "Vocabulary Consolidation — Academic Word List Mastery",
    category: "vocabulary",
    level: "advanced",
    grammarFocus: "High-frequency Academic Word List items used accurately in context.",
    subTopics: ["AWL sublist 1 items: analyse, concept, data, establish, factor, function, identify, indicate, involve, major", "AWL in sentences across multiple academic disciplines", "collocations of AWL words", "using AWL to replace basic vocabulary in formal writing"],
    skillFocus: "range"
  },
  {
    day: 125,
    weekNumber: 18, dayInWeek: 6,
    topic: "Mock Test — All Skills (Capstone Day)",
    category: "writing",
    level: "advanced",
    grammarFocus: "Full-spectrum test of all grammar, vocabulary, writing, speaking and reading skills.",
    subTopics: ["reading comprehension with inference questions", "grammar in context (error correction, gap fill, transformation)", "vocabulary (collocations, register, idioms, AWL)", "writing: discursive paragraph + formal email", "speaking: opinion monologue + discussion response"],
    skillFocus: "mixed"
  },
  {
    day: 126,
    weekNumber: 18, dayInWeek: 7,
    topic: "REVISION — Week 18 (FINAL REVISION)",
    category: "revision",
    level: "advanced",
    covers: [120, 121, 122, 123, 124, 125],
    subTopics: ["register control", "persistent error correction", "fluency strategies", "full essay writing", "academic vocabulary", "capstone test review"],
    skillFocus: "mixed"
  }

];

// ============================================================
// HELPER FUNCTIONS — used by briefBuilder.js (never sent to API)
// ============================================================

/**
 * Get the curriculum entry for a given day number.
 * @param {number} dayNumber
 * @returns {object|undefined}
 */
function getTopicForDay(dayNumber) {
  return CURRICULUM.find(c => c.day === dayNumber);
}

/**
 * Returns true if this day is a revision day (every 7th day).
 * @param {number} dayNumber
 * @returns {boolean}
 */
function isRevisionDay(dayNumber) {
  return dayNumber % 7 === 0;
}

/**
 * Returns the 6 curriculum entries that a revision day covers.
 * @param {number} revisionDayNumber — must be a multiple of 7
 * @returns {object[]}
 */
function getRevisionScope(revisionDayNumber) {
  const start = revisionDayNumber - 6;
  return CURRICULUM.filter(c => c.day >= start && c.day < revisionDayNumber);
}

/**
 * Returns the total number of days in the curriculum.
 * @returns {number}
 */
function getTotalDays() {
  return CURRICULUM.length; // 126
}

/**
 * Returns the level for a given day: "beginner" | "intermediate" | "advanced"
 * @param {number} dayNumber
 * @returns {string}
 */
function getLevelForDay(dayNumber) {
  const entry = getTopicForDay(dayNumber);
  return entry ? entry.level : "beginner";
}

/**
 * Returns all topics covered up to (not including) a given day.
 * Used to build the wordsToAvoid / topicsToAvoid lists.
 * @param {number} dayNumber
 * @returns {string[]}
 */
function getAllPreviousTopics(dayNumber) {
  return CURRICULUM
    .filter(c => c.day < dayNumber && c.category !== "revision")
    .map(c => c.topic);
}

/**
 * Returns the week number for a given day.
 * @param {number} dayNumber
 * @returns {number}
 */
function getWeekNumber(dayNumber) {
  return Math.ceil(dayNumber / 7);
}

/**
 * Returns the upcoming 7 topics (for the progress dashboard).
 * @param {number} currentDay
 * @returns {object[]}
 */
function getUpcomingTopics(currentDay) {
  return CURRICULUM.filter(c => c.day > currentDay && c.day <= currentDay + 7);
}

/**
 * Returns a summary of all topics by category for the dashboard.
 * @returns {object}
 */
function getCurriculumSummary() {
  const summary = { grammar: 0, tense: 0, vocabulary: 0, speaking: 0, writing: 0, reading: 0, revision: 0 };
  CURRICULUM.forEach(c => { summary[c.category] = (summary[c.category] || 0) + 1; });
  return {
    ...summary,
    total: CURRICULUM.length,
    totalWeeks: 18,
    levels: { beginner: 42, intermediate: 42, advanced: 42 }
  };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  CURRICULUM,
  getTopicForDay,
  isRevisionDay,
  getRevisionScope,
  getTotalDays,
  getLevelForDay,
  getAllPreviousTopics,
  getWeekNumber,
  getUpcomingTopics,
  getCurriculumSummary
};