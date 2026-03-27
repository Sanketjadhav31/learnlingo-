import { useEffect, useState, useRef } from "react";
import { Toast, type ToastType } from "./Toast";

// Auth token helpers
const AUTH_TOKEN_KEY = "english_trainer_token";

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

interface Question {
  questionId: string;
  type: "mcq" | "multi_correct" | "fill_blank" | "writing";
  difficulty: string;
  topic: string;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  correctAnswers?: string[];
  correctFillBlank?: string;
  modelAnswer?: string;
  criteria?: string[];
}

interface Test {
  testId: string;
  forDay: number;
  generatedAt: string;
  version: number;
  status: "pending" | "submitted" | "evaluated";
  questions: Question[];
  userAnswers: Record<string, any>;
  result?: TestEvaluation;
}

interface TestEvaluation {
  overallScore: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  questionResults: Array<{
    questionId: string;
    correct: boolean;
    userAnswer: any;
    correctAnswer: any;
    feedback: string;
  }>;
  overallFeedback: string;
  weakTopics: string[];
  strongTopics: string[];
}

export function TestRoute() {
  const [test, setTest] = useState<Test | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<TestEvaluation | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());
  const [failedSaves, setFailedSaves] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTest();
    
    // Cleanup debounce timers on unmount
    return () => {
      debouncedAutoSave.current.forEach((timer: ReturnType<typeof setTimeout>) => clearTimeout(timer));
      debouncedAutoSave.current.clear();
    };
  }, []);

  function showToast(type: ToastType, message: string) {
    setToast({ type, message });
  }

  function getErrorMessage(error: any, context: string): string {
    // Network failure
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return "Network connection failed. Please check your internet connection.";
    }

    // Parse error response
    if (error.response) {
      const status = error.response.status;
      
      // Quota exceeded (429)
      if (status === 429) {
        return "AI service is temporarily busy. Please wait a moment and try again.";
      }
      
      // Timeout (504)
      if (status === 504) {
        return "Request timed out. The server took too long to respond. Please try again.";
      }
      
      // Service unavailable (503)
      if (status === 503) {
        return "AI evaluation service is temporarily unavailable. Please try again in a few moments.";
      }
      
      // Server error (500)
      if (status === 500) {
        return `Server error during ${context}. Please try again.`;
      }
      
      // Unauthorized (401)
      if (status === 401) {
        return "Your session has expired. Please login again.";
      }
      
      // Bad request (400)
      if (status === 400 && error.response.data?.reject?.message) {
        return error.response.data.reject.message;
      }
    }

    // Generic error with message
    if (error.message) {
      return `${context} failed: ${error.message}`;
    }

    // Fallback
    return `${context} failed. Please try again.`;
  }

  async function loadTest() {
    try {
      const token = getToken();
      if (!token) {
        showToast("error", "Please login first");
        setTimeout(() => window.close(), 2000);
        return;
      }

      const res = await fetch("/api/test", {
        headers: authHeaders()
      });
      
      if (!res.ok) {
        const errorMsg = getErrorMessage({ response: { status: res.status, data: await res.json() } }, "Loading test");
        showToast("error", errorMsg);
        setLoading(false);
        return;
      }
      
      const data = await res.json();

      if (data.status === "no_test") {
        // Generate new test
        await generateTest();
      } else {
        setTest(data.test);
        setAnswers(data.test.userAnswers || {});
        if (data.test.status === "evaluated") {
          setEvaluation(data.test.result);
        }
      }
    } catch (error) {
      console.error("Failed to load test:", error);
      const errorMsg = getErrorMessage(error, "Loading test");
      showToast("error", errorMsg);
    } finally {
      setLoading(false);
    }
  }

  async function generateTest() {
    setGenerating(true);
    try {
      const res = await fetch("/api/test/generate", {
        method: "POST",
        headers: authHeaders()
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = getErrorMessage({ response: { status: res.status, data: errorData } }, "Generating test");
        showToast("error", errorMsg);
        return;
      }
      
      const data = await res.json();

      if (!data.ok) {
        showToast("error", data.reject?.message || "Failed to generate test");
        return;
      }

      setTest(data.test);
      setAnswers({});
      showToast("success", "Test generated successfully!");
    } catch (error) {
      console.error("Failed to generate test:", error);
      const errorMsg = getErrorMessage(error, "Generating test");
      showToast("error", errorMsg);
    } finally {
      setGenerating(false);
    }
  }

  // Debounced auto-save with optimized delay
  const debouncedAutoSave = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  async function performAutoSave(questionId: string, answer: any) {
    // Track pending save
    setPendingSaves(prev => new Set(prev).add(questionId));
    setFailedSaves(prev => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });

    // Auto-save to backend with retry
    const maxRetries = 2;
    let attempt = 0;
    let saved = false;

    while (attempt < maxRetries && !saved) {
      try {
        const res = await fetch("/api/test/answer", {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ questionId, answer })
        });

        if (res.ok) {
          saved = true;
          setPendingSaves(prev => {
            const next = new Set(prev);
            next.delete(questionId);
            return next;
          });
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (error) {
        attempt++;
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        } else {
          // All retries failed
          console.warn(`Auto-save failed for question ${questionId}:`, error);
          setFailedSaves(prev => new Set(prev).add(questionId));
          setPendingSaves(prev => {
            const next = new Set(prev);
            next.delete(questionId);
            return next;
          });
          showToast("warning", "Answer auto-save failed. Will retry on submission.");
        }
      }
    }
  }

  function handleAnswerChange(questionId: string, answer: any) {
    // Update local state immediately
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    // Clear existing debounce timer for this question
    const existingTimer = debouncedAutoSave.current.get(questionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer (300ms for optimal balance)
    const timer = setTimeout(() => {
      performAutoSave(questionId, answer);
      debouncedAutoSave.current.delete(questionId);
    }, 300);

    debouncedAutoSave.current.set(questionId, timer);
  }

  function validateSubmission() {
    const errors: Record<string, string> = {};

    test?.questions.forEach(q => {
      const answer = answers[q.questionId];

      if (!answer || (typeof answer === "string" && answer.trim() === "")) {
        errors[q.questionId] = "Answer required";
      } else if (q.type === "writing" && String(answer).trim().length < 10) {
        errors[q.questionId] = "Writing answer must be at least 10 characters";
      } else if (q.type === "multi_correct" && (!Array.isArray(answer) || answer.length === 0)) {
        errors[q.questionId] = "Select at least one option";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    // Retry any failed saves before submission
    if (failedSaves.size > 0) {
      showToast("info", `Retrying ${failedSaves.size} failed auto-saves...`);
      
      const retryPromises = Array.from(failedSaves).map(async (questionId) => {
        try {
          const res = await fetch("/api/test/answer", {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ questionId, answer: answers[questionId] })
          });
          
          if (res.ok) {
            setFailedSaves(prev => {
              const next = new Set(prev);
              next.delete(questionId);
              return next;
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      });
      
      const results = await Promise.all(retryPromises);
      const successCount = results.filter(r => r).length;
      
      if (successCount < failedSaves.size) {
        showToast("warning", `${failedSaves.size - successCount} answers still failed to save. Continuing with submission...`);
      }
    }

    if (!validateSubmission()) {
      showToast("error", "Please answer all questions before submitting");
      return;
    }

    if (!confirm("Submit test for evaluation? You cannot change answers after submission.")) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/test/submit", {
        method: "POST",
        headers: authHeaders()
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = getErrorMessage({ response: { status: res.status, data: errorData } }, "Submitting test");
        showToast("error", errorMsg);
        return;
      }
      
      const data = await res.json();

      if (!data.ok) {
        showToast("error", data.reject?.message || "Failed to submit test");
        return;
      }

      setEvaluation(data.evaluation);
      setTest(data.test);
      showToast("success", `Test evaluated! Score: ${data.evaluation.overallScore}%`);
    } catch (error) {
      console.error("Submit failed:", error);
      const errorMsg = getErrorMessage(error, "Submitting test");
      showToast("error", errorMsg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetake() {
    setRetaking(true);
    try {
      const res = await fetch("/api/test/retake", {
        method: "POST",
        headers: authHeaders()
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = getErrorMessage({ response: { status: res.status, data: errorData } }, "Retaking test");
        showToast("error", errorMsg);
        return;
      }
      
      const data = await res.json();

      setTest(data.test);
      setAnswers({});
      setEvaluation(null);
      setValidationErrors({});
      setFailedSaves(new Set());
      setPendingSaves(new Set());
      showToast("success", "Test reset for retake");
    } catch (error) {
      console.error("Retake failed:", error);
      const errorMsg = getErrorMessage(error, "Retaking test");
      showToast("error", errorMsg);
    } finally {
      setRetaking(false);
    }
  }

  async function handleNewTest() {
    setGenerating(true);
    try {
      const res = await fetch("/api/test/new", {
        method: "POST",
        headers: authHeaders()
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = getErrorMessage({ response: { status: res.status, data: errorData } }, "Generating new test");
        showToast("error", errorMsg);
        return;
      }
      
      const data = await res.json();

      setTest(data.test);
      setAnswers({});
      setEvaluation(null);
      setValidationErrors({});
      setFailedSaves(new Set());
      setPendingSaves(new Set());
      showToast("success", "New test generated!");
    } catch (error) {
      console.error("New test failed:", error);
      const errorMsg = getErrorMessage(error, "Generating new test");
      showToast("error", errorMsg);
    } finally {
      setGenerating(false);
    }
  }

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1629] to-[#0a0e1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent mb-4"></div>
          <div className="text-lg font-semibold mb-2">{generating ? "Generating test..." : "Loading test..."}</div>
          <div className="text-sm text-white/60">
            {generating ? "Creating personalized questions for you" : "Retrieving your test data"}
          </div>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1629] to-[#0a0e1a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📝</div>
          <div className="text-lg">No test available</div>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1629] to-[#0a0e1a] text-white">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Cumulative Test - Day {test.forDay}</h1>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <span>Version {test.version}</span>
            <span>•</span>
            <span>Progress: {answeredCount}/20</span>
            {pendingSaves.size > 0 && (
              <>
                <span>•</span>
                <span className="text-blue-300">Saving {pendingSaves.size}...</span>
              </>
            )}
            {failedSaves.size > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-300">⚠ {failedSaves.size} unsaved</span>
              </>
            )}
          </div>
        </div>

        {/* Questions */}
        {!evaluation && (
          <div className="space-y-6 mb-6">
            {test.questions.map((q, idx) => (
              <div key={q.questionId} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-200 text-sm font-bold flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-white/90 mb-2">{q.prompt}</div>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">{q.type}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">{q.difficulty}</span>
                    </div>
                  </div>
                </div>

                {/* Question input based on type */}
                {q.type === "mcq" && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={q.questionId}
                          value={String.fromCharCode(65 + i)}
                          checked={answers[q.questionId] === String.fromCharCode(65 + i)}
                          onChange={(e) => handleAnswerChange(q.questionId, e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{String.fromCharCode(65 + i)}. {opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === "multi_correct" && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const currentAnswers = Array.isArray(answers[q.questionId]) ? answers[q.questionId] : [];
                      return (
                        <label key={i} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentAnswers.includes(letter)}
                            onChange={(e) => {
                              const newAnswers = e.target.checked
                                ? [...currentAnswers, letter]
                                : currentAnswers.filter((a: string) => a !== letter);
                              handleAnswerChange(q.questionId, newAnswers);
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{letter}. {opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.type === "fill_blank" && (
                  <input
                    type="text"
                    value={answers[q.questionId] || ""}
                    onChange={(e) => handleAnswerChange(q.questionId, e.target.value)}
                    onBlur={(e) => handleAnswerChange(q.questionId, e.target.value)}
                    className="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm"
                    placeholder="Your answer..."
                  />
                )}

                {q.type === "writing" && (
                  <textarea
                    value={answers[q.questionId] || ""}
                    onChange={(e) => handleAnswerChange(q.questionId, e.target.value)}
                    onBlur={(e) => handleAnswerChange(q.questionId, e.target.value)}
                    className="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm min-h-[100px]"
                    placeholder="Write 2-3 sentences..."
                  />
                )}

                {validationErrors[q.questionId] && (
                  <div className="mt-2 text-xs text-rose-300">{validationErrors[q.questionId]}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Evaluation Results */}
        {evaluation && (
          <div className="space-y-6 mb-6">
            <div className="rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 p-6">
              <div className="text-center mb-4">
                <div className="text-4xl font-bold mb-2">{evaluation.overallScore}%</div>
                <div className={`text-lg font-semibold ${evaluation.passed ? "text-emerald-300" : "text-rose-300"}`}>
                  {evaluation.passed ? "PASSED ✓" : "FAILED ✗"}
                </div>
                <div className="text-sm text-white/70 mt-2">
                  {evaluation.correctCount} / {evaluation.totalQuestions} correct
                </div>
              </div>

              {evaluation.overallFeedback && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4 mb-4">
                  <div className="text-sm text-white/90">{evaluation.overallFeedback}</div>
                </div>
              )}

              {evaluation.weakTopics.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-semibold text-amber-200 mb-2">Topics to review:</div>
                  <div className="flex flex-wrap gap-2">
                    {evaluation.weakTopics.map((topic, i) => (
                      <span key={i} className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-200">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {evaluation.strongTopics.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-emerald-200 mb-2">Strong areas:</div>
                  <div className="flex flex-wrap gap-2">
                    {evaluation.strongTopics.map((topic, i) => (
                      <span key={i} className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-200">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Per-question results */}
            <div className="space-y-3">
              {evaluation.questionResults.map((result, idx) => (
                <div key={result.questionId} className={`rounded-lg border p-4 ${
                  result.correct 
                    ? "border-emerald-400/30 bg-emerald-500/10" 
                    : "border-rose-400/30 bg-rose-500/10"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${
                      result.correct 
                        ? "bg-emerald-500/20 text-emerald-200" 
                        : "bg-rose-500/20 text-rose-200"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold mb-1">
                        {result.correct ? "✓ Correct" : "✗ Incorrect"}
                      </div>
                      <div className="text-xs text-white/70 mb-2">
                        Your answer: {JSON.stringify(result.userAnswer)}
                      </div>
                      {!result.correct && (
                        <>
                          <div className="text-xs text-white/70 mb-2">
                            Correct answer: {JSON.stringify(result.correctAnswer)}
                          </div>
                          {result.feedback && (
                            <div className="text-xs text-white/80">{result.feedback}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {!evaluation && (
            <button
              onClick={handleSubmit}
              disabled={submitting || answeredCount < 20 || pendingSaves.size > 0}
              className="flex-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold transition-colors flex items-center justify-center gap-2"
              type="button"
            >
              {submitting ? (
                <>
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                  <span>Evaluating...</span>
                </>
              ) : pendingSaves.size > 0 ? (
                <>
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                  <span>Saving answers...</span>
                </>
              ) : (
                "Submit Test"
              )}
            </button>
          )}

          {evaluation && (
            <>
              <button
                onClick={handleRetake}
                disabled={retaking || generating}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 disabled:bg-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold transition-colors flex items-center justify-center gap-2"
                type="button"
              >
                {retaking ? (
                  <>
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                    <span>Resetting...</span>
                  </>
                ) : (
                  "Retake Test"
                )}
              </button>
              <button
                onClick={handleNewTest}
                disabled={generating || retaking}
                className="flex-1 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 disabled:cursor-not-allowed px-6 py-3 font-semibold transition-colors flex items-center justify-center gap-2"
                type="button"
              >
                {generating ? (
                  <>
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  "New Test"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
