// Smoke test: login -> fetch current day -> mark sections -> submit.
// Usage:
//   TEST_EMAIL=... TEST_PASSWORD=... node smoke-submit.js

async function main() {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const email = process.env.TEST_EMAIL || "";
  const password = process.env.TEST_PASSWORD || "";
  if (!email || !password) throw new Error("Set TEST_EMAIL and TEST_PASSWORD for smoke test.");

  const loginStart = Date.now();
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginJson)}`);
  const token = loginJson.token;
  const authHeaders = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
  console.log("login_ms:", Date.now() - loginStart);

  const dayStart = Date.now();
  const dayRes = await fetch(`${baseUrl}/api/day`, { headers: { Authorization: `Bearer ${token}` } });
  const dayJson = await dayRes.json();
  if (!dayRes.ok) {
    throw new Error(`GET /api/day failed: ${dayRes.status} ${JSON.stringify(dayJson)}`);
  }
  console.log("day_ms:", Date.now() - dayStart);

  const day = dayJson.dayContent;
  const t = day.submissionTemplate;

  const lines = [];
  lines.push(`DAY ${day.dayNumber} SUBMISSION${day.dayType === "weekly_review" ? " (WEEKLY REVIEW)" : ""}`);
  lines.push("");
  lines.push("1. Writing Task:");
  lines.push(
    "I practice English once in a blue moon, but now I am building a strong daily routine. Every morning I review vocabulary, read a short article, and write a paragraph about my day. In the evening, I record my voice, listen carefully, and correct pronunciation mistakes. I also speak with friends for ten minutes and ask follow-up questions. This plan helps me improve grammar, confidence, and fluency step by step."
  );
  lines.push("");
  lines.push("2. Speaking Task:");
  lines.push("I will speak about my daily routine, my current English level, and my goals for this month. I will describe my strengths and weaknesses, explain what mistakes I repeat, and share how I plan to fix them. I will also talk about my family, work, and hobbies to practice natural fluency.");
  lines.push("");
  lines.push("3. Conversation Practice:");
  for (let i = 0; i < t.conversationMinTurns; i++) {
    lines.push(`${i % 2 === 0 ? "A" : "B"}: Turn ${i + 1}: my plan.`);
  }
  lines.push("");
  lines.push(day.dayType === "weekly_review" ? "4. Sentence Practice (30):" : "4. Sentence Practice:");
  for (let i = 1; i <= t.sentenceCount; i++) {
    lines.push(`${i}. Sentence ${i} is clear and correct.`);
  }
  lines.push("");
  lines.push("5. Questions:");
  for (let i = 1; i <= t.questionCount; i++) {
    lines.push(`${i}. Answer to question ${i} in 1-2 sentences.`);
  }
  lines.push("");
  lines.push("6. Listening Comprehension:");
  for (let i = 1; i <= t.listeningCount; i++) {
    lines.push(`${i}. Listening answer ${i}.`);
  }
  lines.push("");
  if (day.dayType === "weekly_review") {
    lines.push("7. Vocabulary Quiz:");
    const vocabN = t.vocabQuizCount || 0;
    for (let i = 1; i <= vocabN; i++) {
      lines.push(`${i}. I can use this weekly word (${i}).`);
    }
    lines.push("");
    lines.push("8. Reflection (required, not graded):");
  } else {
    lines.push("7. Reflection (required, not graded):");
  }
  for (let i = 1; i <= t.reflectionCount; i++) {
    lines.push(`${i}. Reflection item ${i} done.`);
  }

  const submissionText = lines.join("\n");

  for (const sectionId of ["warmup", "grammar", "pronunciation", "vocabulary", "listening"]) {
    await fetch(`${baseUrl}/api/day/progress`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ sectionId, done: true }),
    });
  }

  const submitStart = Date.now();
  const submitRes = await fetch(`${baseUrl}/api/submit`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ submissionText }),
  });
  const submitJson = await submitRes.json().catch(() => ({}));
  console.log("submit_ms:", Date.now() - submitStart);

  console.log("POST /api/submit status:", submitRes.status);
  console.log(
    "evaluation:",
    submitJson.evaluation
      ? {
          tier: submitJson.evaluation.tier,
          passFail: submitJson.evaluation.passFail,
          overallPercent: submitJson.evaluation.overallPercent,
          warning: (submitJson.evaluation.__warning ? String(submitJson.evaluation.__warning).slice(0, 80) : undefined),
        }
      : submitJson
  );
  console.log(
    "tracker:",
    submitJson.tracker
      ? { day: submitJson.tracker.day, finalStatus: submitJson.tracker.finalStatus, mistakes: submitJson.tracker.commonMistakes }
      : undefined
  );
  console.log("next:", submitJson.next);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

