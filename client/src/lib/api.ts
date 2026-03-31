import type { DayContent, Evaluation, Tracker } from "./types";

const AUTH_TOKEN_KEY = "english_trainer_token";
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function authHeaders(extra?: Record<string, string>) {
  const token = getToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function fetchDay() {
  console.log("📡 [API] fetchDay called");
  const url = `${API_BASE_URL}/api/day`;
  console.log(`📡 [API] Fetching: ${url}`);
  
  const res = await fetch(url, { headers: authHeaders() });
  console.log(`📡 [API] Response status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ [API] fetchDay failed:`, errorText);
    try {
      const parsed = JSON.parse(errorText);
      const msg = parsed?.reject?.message || parsed?.message;
      if (msg) throw new Error(msg);
    } catch {
      // ignore parse error
    }
    throw new Error(`Failed to load day: ${res.status}`);
  }
  
  const data = await res.json();
  console.log(`✓ [API] fetchDay success - Day ${data.dayContent?.dayNumber}`);
  return data as { tracker: Tracker; dayContent: DayContent; dayProgress: any; lastEvaluation?: Evaluation | null; submissionDraft?: string };
}

export async function saveDraft(draftText: string) {
  const url = `${API_BASE_URL}/api/day/draft`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ draftText }),
  });
  if (!res.ok) throw new Error("Failed to save draft");
  return res.json();
}

export async function submitDay(submissionText: string) {
  console.log("📡 [API] submitDay called");
  console.log(`📏 [API] Submission length: ${submissionText.length} chars`);
  const preview = String(submissionText || "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  console.log(`🧾 [API] Submission preview: "${preview}${submissionText.length > 80 ? "..." : ""}"`);
  
  const url = `${API_BASE_URL}/api/submit`;
  console.log(`📡 [API] Posting to: ${url}`);
  console.log(`🔐 [API] Auth header present: ${Boolean(getToken())}`);
  
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ submissionText }),
  });
  
  console.log(`📡 [API] Response status: ${res.status} ${res.statusText}`);
  const data = await res.json();
  
  if (!res.ok) {
    console.error(`❌ [API] submitDay failed:`, data?.reject?.message);
    throw new Error(data?.reject?.message || "Submission rejected");
  }
  // Compact eval summary for debugging.
  const ev = data?.evaluation;
  const sent = Array.isArray(ev?.sentenceEvaluations) ? ev!.sentenceEvaluations : [];
  const sentCorrect = sent.filter((s: any) => s?.correctness === "Correct").length;
  const sentIncorrect = sent.length - sentCorrect;
  console.log(
    `✅ [API] submitDay success: overall=${ev?.overallPercent}% tier=${ev?.tier} passFail=${ev?.passFail} ` +
      `grammar(sent)=${ev?.scoreBreakdown?.sentencesPercent}% sentencesCorrect=${sentCorrect} sentencesIncorrect=${sentIncorrect}`
  );
  
  console.log(`✓ [API] submitDay success - Score: ${data.evaluation?.overallPercent}%`);
  return data as {
    ok: true;
    evaluation: Evaluation;
    tracker: Tracker;
    dayProgress: any;
    next: { action: "advance" | "retry"; day: number };
  };
}

export async function updateSectionProgress(sectionId: string, done: boolean) {
  const res = await fetch(`${API_BASE_URL}/api/day/progress`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ sectionId, done }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.reject?.message || "Progress update failed");
  return data as { ok: true; dayProgress: any };
}

export async function resetUser() {
  console.log("📡 [API] resetUser called");
  const url = `${API_BASE_URL}/api/reset`;
  console.log(`📡 [API] Posting to: ${url}`);
  
  const res = await fetch(url, { method: "POST", headers: authHeaders() });
  console.log(`📡 [API] Response status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    console.error(`❌ [API] resetUser failed`);
    throw new Error("Reset failed");
  }
  
  const data = await res.json();
  console.log(`✓ [API] resetUser success`);
  return data as { ok: true };
}

export async function resetToday(forceRegenerate = false) {
  console.log(`📡 [API] resetToday called${forceRegenerate ? ' (force regenerate)' : ''}`);
  const url = `${API_BASE_URL}/api/reset/today`;
  console.log(`📡 [API] Posting to: ${url}`);
  
  const res = await fetch(url, { 
    method: "POST", 
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ forceRegenerate }),
  });
  console.log(`📡 [API] Response status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    console.error(`❌ [API] resetToday failed`);
    throw new Error("Reset today failed");
  }
  
  const data = await res.json();
  console.log(`✓ [API] resetToday success`);
  return data as { ok: true; message?: string };
}

export async function fetchHistory() {
  console.log("📡 [API] fetchHistory called");
  const url = `${API_BASE_URL}/api/history`;
  console.log(`📡 [API] Fetching: ${url}`);
  
  const res = await fetch(url, { headers: authHeaders() });
  console.log(`📡 [API] Response status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    console.error(`❌ [API] fetchHistory failed`);
    throw new Error("Failed to load history");
  }
  
  const data = await res.json();
  console.log(`✓ [API] fetchHistory success - ${data.history?.length || 0} days`);
  return data as {
    ok: true;
    history: Array<{
      dayNumber: number;
      date: string;
      overallPercent: number;
      tier: string;
      passFail: string;
      scoreBreakdown: any;
      theme: string;
      grammarFocus: string;
      fullEvaluation: any;
    }>;
    currentDay: number;
    totalDaysCompleted: number;
    streak: number;
  };
}

export async function signup(name: string, email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.reject?.message || "Signup failed");
  return data as { ok: true; token: string; user: { userId: string; name: string; email: string } };
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.reject?.message || "Login failed");
  return data as { ok: true; token: string; user: { userId: string; name: string; email: string } };
}

export async function verifySession() {
  const res = await fetch(`${API_BASE_URL}/api/auth/verify`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.reject?.message || "Session invalid");
  return data as { ok: true; user: { userId: string; name: string; email: string } };
}

