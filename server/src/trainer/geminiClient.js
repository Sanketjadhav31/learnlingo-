const { GoogleGenerativeAI } = require("@google/generative-ai");

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini timeout after ${ms}ms`)), ms)),
  ]);
}

function getApiVersion() {
  return String(process.env.GEMINI_API_VERSION || "v1beta").trim() || "v1beta";
}

function normalizeGeminiModelName(name) {
  const n = String(name || "").trim();
  return n;
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function getGeminiModelCandidates() {
  const envName = normalizeGeminiModelName(process.env.GEMINI_MODEL);
  // Preferred order requested: 2.5 flash -> 1.5 flash -> 1.5 pro
  return uniq([envName, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]);
}

function isModelNotFoundOrUnsupported(errorMessage) {
  const msg = String(errorMessage || "").toLowerCase();
  const hasModelRef = msg.includes("model") || msg.includes("models/");
  const hasNotFound = msg.includes("404") || msg.includes("not found") || msg.includes("does not exist");
  const hasNotSupported =
    msg.includes("not supported") ||
    msg.includes("unsupported") ||
    msg.includes("not available") ||
    msg.includes("generatecontent");

  // Handle messages like:
  // "models/<name> is not found for API version ... or is not supported for generateContent"
  return hasModelRef && (hasNotFound || hasNotSupported);
}

function extractLikelyJson(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Gemini returned empty response.");

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  if (text.startsWith("{") || text.startsWith("[")) return text;

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  throw new Error("Gemini returned no JSON object.");
}

async function callGeminiJson({
  model,
  systemPrompt,
  userPrompt,
  timeoutMs = 20000,
  responseSchema,
  useResponseMimeType = true,
}) {
  console.log(`      🌐 Calling Gemini API (timeout: ${timeoutMs}ms)...`);
  
  const fullPrompt = [
    systemPrompt.trim(),
    "",
    "Return ONLY valid JSON that matches the schema.",
    userPrompt.trim(),
  ].join("\n");

  const generationConfig = {};
  if (useResponseMimeType) {
    generationConfig.responseMimeType = "application/json";
  }
  if (responseSchema && useResponseMimeType) generationConfig.responseSchema = responseSchema;

  try {
    const res = await withTimeout(
      model.generateContent({
        contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        generationConfig,
      }),
      timeoutMs
    );

    const raw = res.response.text();
    console.log(`      ✓ Gemini API response received (${raw.length} chars)`);

    const jsonText = extractLikelyJson(raw);
    JSON.parse(jsonText);
    return jsonText;
  } catch (error) {
    // Re-throw with more context
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`      ❌ Gemini API error:`, errorMessage);
    
    // Check if it's a quota/rate limit error
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("Too Many Requests")) {
      throw new Error(`Gemini API quota exceeded: ${errorMessage}`);
    }
    throw new Error(`Gemini API call failed: ${errorMessage}`);
  }
}

function getGeminiModel(modelNameOverride, apiVersionOverride) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    console.warn("      ⚠ No Gemini API key found");
    return null;
  }
  const modelName = normalizeGeminiModelName(modelNameOverride || process.env.GEMINI_MODEL || "");
  const finalName = modelName || "gemini-2.5-flash";
  const apiVersion = String(apiVersionOverride || getApiVersion()).trim() || "v1beta";
  console.log(`      🔑 Gemini model initialized: ${finalName} (apiVersion: ${apiVersion})`);
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: finalName }, { apiVersion });
}

async function listModelsThatSupportGenerateContent() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || !String(apiKey).trim()) return [];

  const apiVersion = getApiVersion();
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ListModels failed: HTTP ${res.status} ${res.statusText} ${txt}`.trim());
  }
  const json = await res.json();
  const models = Array.isArray(json.models) ? json.models : [];
  return models
    .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, ""))
    .filter(Boolean);
}

function preferModelOrder(names) {
  const prefs = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  const set = new Set(names);
  for (const p of prefs) if (set.has(p)) return p;
  return names[0] || "";
}

async function callGeminiJsonWithFallback({
  systemPrompt,
  userPrompt,
  timeoutMs = 20000,
  responseSchema,
  modelCandidates,
}) {
  let candidates = Array.isArray(modelCandidates) && modelCandidates.length
    ? uniq(modelCandidates.map(normalizeGeminiModelName))
    : getGeminiModelCandidates();

  const envApiVersion = String(process.env.GEMINI_API_VERSION || getApiVersion()).trim() || "v1beta";
  const apiVersionCandidates = uniq([envApiVersion, "v1beta", "v1"]);

  let lastErr = null;
  let sawQuotaError = false;
  for (const name of candidates) {
    for (const apiVersion of apiVersionCandidates) {
      const model = getGeminiModel(name, apiVersion);
      if (!model) throw new Error("Gemini API key missing. Set GOOGLE_API_KEY in server/.env");

    try {
      console.log(`      🤖 Using Gemini model: ${name} (apiVersion: ${apiVersion})`);
        const useResponseMimeType = apiVersion !== "v1";
        return await callGeminiJson({ model, systemPrompt, userPrompt, timeoutMs, responseSchema, useResponseMimeType });
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // Try next model on quota/rate-limit; quotas are often model-specific.
      if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.includes("Too Many Requests")) {
        sawQuotaError = true;
        console.warn(`      ⚠ Model '${name}' quota/rate-limited. Trying next model...`);
        continue;
      }
      if (
        msg.includes("503") ||
        msg.toLowerCase().includes("service unavailable") ||
        msg.toLowerCase().includes("high demand") ||
        msg.toLowerCase().includes("temporarily unavailable")
      ) {
        console.warn(`      ⚠ Model '${name}' service unavailable/high demand. Trying next model...`);
        continue;
      }
      if (isModelNotFoundOrUnsupported(msg)) {
        console.warn(`      ⚠ Model '${name}' unavailable for generateContent. Trying next...`);
        continue;
      }
      throw e;
    }
    }
  }

  // If all explicit candidates failed due to 404/unsupported, auto-discover supported models and retry once.
  try {
    const discovered = await listModelsThatSupportGenerateContent();
    const pick = preferModelOrder(discovered);
    if (pick && !candidates.includes(pick)) {
      console.warn(`      🔎 Auto-selected model from ListModels: ${pick}`);
      const model = getGeminiModel(pick, envApiVersion);
      if (!model) throw new Error("Gemini API key missing. Set GOOGLE_API_KEY in server/.env");
      const useResponseMimeType = envApiVersion !== "v1";
      return await callGeminiJson({ model, systemPrompt, userPrompt, timeoutMs, responseSchema, useResponseMimeType });
    }
  } catch (e) {
    // ignore and throw original
  }

  if (sawQuotaError) {
    throw new Error(
      `Gemini API blocked by quota/billing (429) for available models. Fix in Google AI Studio: enable billing/quotas or wait for quota reset. Raw error: ${lastErr instanceof Error ? lastErr.message : String(lastErr || "")}`
    );
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "Gemini API call failed"));
}

module.exports = {
  callGeminiJson,
  callGeminiJsonWithFallback,
  getGeminiModel,
  getGeminiModelCandidates,
};

