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
        <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-r from-black/40 via-black/30 to-black/40 backdrop-blur-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                Cumulative Test
              </h1>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <span className="flex items-center gap-1.5">
                  <span>📅</span>
                  <span>Day {test.forDay}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <span>📝</span>
                  <span>Version {test.version}</span>
                </span>
              </div>
            </div>
            
            {!evaluation && (
              <div className="text-right">
                <div className="text-2xl font-bold text-white mb-1">{answeredCount}/20</div>
                <div className="text-xs text-white/60">Questions Answered</div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {!evaluation && (
            <div>
              <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                <span>Progress</span>
                <span>{Math.round((answeredCount / 20) * 100)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${(answeredCount / 20) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Status Indicators */}
          {!evaluation && (
            <div className="flex items-center gap-3 mt-4 text-xs">
              {pendingSaves.size > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving {pendingSaves.size}...</span>
                </div>
              )}
              {failedSaves.size > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{failedSaves.size} unsaved</span>
                </div>
              )}
              {answeredCount === 20 && pendingSaves.size === 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>All questions answered!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Questions */}
        {!evaluation && (
          <div className="space-y-5 mb-6">
            {test.questions.map((q, idx) => {
              const isAnswered = answers[q.questionId] !== undefined && 
                (typeof answers[q.questionId] === 'string' ? answers[q.questionId].trim() !== '' : 
                 Array.isArray(answers[q.questionId]) ? answers[q.questionId].length > 0 : true);
              
              return (
                <div 
                  key={q.questionId} 
                  className={`rounded-xl border-2 transition-all ${
                    isAnswered 
                      ? "border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5" 
                      : "border-white/10 bg-gradient-to-br from-black/40 to-black/20"
                  } p-5 shadow-lg hover:shadow-xl`}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg ${
                      isAnswered 
                        ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white" 
                        : "bg-gradient-to-br from-indigo-500 to-purple-500 text-white"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-base text-white/95 mb-3 leading-relaxed font-medium">{q.prompt}</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 font-medium">
                          {q.type === "mcq" ? "Single Choice" : 
                           q.type === "multi_correct" ? "Multiple Choice" :
                           q.type === "fill_blank" ? "Fill in the Blank" : "Writing"}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full border font-medium ${
                          q.difficulty === "easy" ? "bg-green-500/20 text-green-200 border-green-400/30" :
                          q.difficulty === "medium" ? "bg-amber-500/20 text-amber-200 border-amber-400/30" :
                          "bg-rose-500/20 text-rose-200 border-rose-400/30"
                        }`}>
                          {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium">
                          {q.topic}
                        </span>
                      </div>
                    </div>
                    {isAnswered && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pl-14">
                {q.type === "mcq" && q.options && (
                  <div className="space-y-2.5">
                    {q.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isSelected = answers[q.questionId] === letter;
                      return (
                        <label 
                          key={i} 
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected 
                              ? "border-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/20" 
                              : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? "border-indigo-400 bg-indigo-500" 
                                : "border-white/30"
                            }`}>
                              {isSelected && (
                                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                isSelected 
                                  ? "bg-indigo-400/30 text-indigo-200" 
                                  : "bg-white/10 text-white/60"
                              }`}>
                                {letter}
                              </span>
                            </div>
                            <span className={`text-sm leading-relaxed ${
                              isSelected ? "text-white font-medium" : "text-white/80"
                            }`}>
                              {opt}
                            </span>
                          </div>
                          <input
                            type="radio"
                            name={q.questionId}
                            value={letter}
                            checked={isSelected}
                            onChange={(e) => handleAnswerChange(q.questionId, e.target.value)}
                            className="hidden"
                          />
                        </label>
                      );
                    })}
                  </div>
                )}

                {q.type === "multi_correct" && q.options && (
                  <div className="space-y-2.5">
                    {(() => {
                      const currentAnswers = Array.isArray(answers[q.questionId]) ? answers[q.questionId] : [];
                      return (
                        <>
                          <div className="text-xs text-amber-300 mb-2 flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>Select all correct answers</span>
                          </div>
                          {q.options!.map((opt, i) => {
                            const letter = String.fromCharCode(65 + i);
                            const isSelected = currentAnswers.includes(letter);
                            return (
                              <label 
                                key={i} 
                                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  isSelected 
                                    ? "border-purple-400 bg-purple-500/20 shadow-lg shadow-purple-500/20" 
                                    : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                                }`}
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    isSelected 
                                      ? "border-purple-400 bg-purple-500" 
                                      : "border-white/30"
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      isSelected 
                                        ? "bg-purple-400/30 text-purple-200" 
                                        : "bg-white/10 text-white/60"
                                    }`}>
                                      {letter}
                                    </span>
                                  </div>
                                  <span className={`text-sm leading-relaxed ${
                                    isSelected ? "text-white font-medium" : "text-white/80"
                                  }`}>
                                    {opt}
                                  </span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const newAnswers = e.target.checked
                                      ? [...currentAnswers, letter]
                                      : currentAnswers.filter((a: string) => a !== letter);
                                    handleAnswerChange(q.questionId, newAnswers);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            );
                          })}
                          {currentAnswers.length > 0 && (
                            <div className="text-xs text-purple-300 mt-2">
                              {currentAnswers.length} option{currentAnswers.length !== 1 ? 's' : ''} selected
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {q.type === "fill_blank" && (
                  <div className="relative">
                    <input
                      type="text"
                      value={answers[q.questionId] || ""}
                      onChange={(e) => handleAnswerChange(q.questionId, e.target.value)}
                      onBlur={(e) => handleAnswerChange(q.questionId, e.target.value)}
                      className="w-full rounded-lg border-2 border-white/20 bg-black/40 px-4 py-3 text-sm focus:border-cyan-400 focus:bg-black/60 focus:outline-none transition-all"
                      placeholder="Type your answer here..."
                    />
                    {answers[q.questionId] && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}

                {q.type === "writing" && (
                  <div className="relative">
                    <textarea
                      value={answers[q.questionId] || ""}
                      onChange={(e) => handleAnswerChange(q.questionId, e.target.value)}
                      onBlur={(e) => handleAnswerChange(q.questionId, e.target.value)}
                      className="w-full rounded-lg border-2 border-white/20 bg-black/40 px-4 py-3 text-sm min-h-[120px] focus:border-emerald-400 focus:bg-black/60 focus:outline-none transition-all resize-none"
                      placeholder="Write 2-3 sentences..."
                    />
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className={`${
                        (answers[q.questionId] || "").length >= 10 
                          ? "text-emerald-300" 
                          : "text-white/50"
                      }`}>
                        {(answers[q.questionId] || "").length} characters
                      </span>
                      {(answers[q.questionId] || "").length >= 10 && (
                        <span className="text-emerald-300 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Minimum met
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {validationErrors[q.questionId] && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-lg p-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {validationErrors[q.questionId]}
                  </div>
                )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Evaluation Results */}
        {evaluation && (
          <div className="space-y-6 mb-6">
            {/* Overall Score Card */}
            <div className="rounded-2xl border-2 border-white/20 bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-pink-500/10 p-8 shadow-2xl">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-indigo-500/50 mb-4">
                  <div className="text-5xl font-bold text-white">{evaluation.overallScore}%</div>
                </div>
                <div className={`text-2xl font-bold mb-2 ${evaluation.passed ? "text-emerald-300" : "text-rose-300"}`}>
                  {evaluation.passed ? "🎉 PASSED" : "📚 NEEDS REVIEW"}
                </div>
                <div className="text-white/70 text-lg">
                  {evaluation.correctCount} out of {evaluation.totalQuestions} questions correct
                </div>
                
                {/* Progress Bar */}
                <div className="mt-6 max-w-md mx-auto">
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        evaluation.passed 
                          ? "bg-gradient-to-r from-emerald-500 to-cyan-500" 
                          : "bg-gradient-to-r from-amber-500 to-rose-500"
                      }`}
                      style={{ width: `${evaluation.overallScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {evaluation.overallFeedback && (
                <div className="rounded-xl border border-white/20 bg-black/30 backdrop-blur-sm p-5 mb-5">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">💬</span>
                    <div>
                      <div className="text-sm font-semibold text-white/90 mb-2">Overall Feedback</div>
                      <div className="text-sm text-white/80 leading-relaxed">{evaluation.overallFeedback}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {evaluation.weakTopics.length > 0 && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">📌</span>
                      <div className="text-sm font-semibold text-amber-200">Topics to Review</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {evaluation.weakTopics.map((topic, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-200 border border-amber-400/40">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {evaluation.strongTopics.length > 0 && (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">✨</span>
                      <div className="text-sm font-semibold text-emerald-200">Strong Areas</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {evaluation.strongTopics.map((topic, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Per-question results */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📋</span>
                <h3 className="text-lg font-bold text-white">Detailed Results</h3>
              </div>
              <div className="space-y-4">
                {evaluation.questionResults.map((result, idx) => {
                  const question = test.questions[idx];
                  return (
                    <div 
                      key={result.questionId} 
                      className={`rounded-xl border-2 p-5 transition-all ${
                        result.correct 
                          ? "border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5" 
                          : "border-rose-400/40 bg-gradient-to-br from-rose-500/10 to-orange-500/5"
                      }`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg ${
                          result.correct 
                            ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white" 
                            : "bg-gradient-to-br from-rose-500 to-orange-500 text-white"
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-sm font-bold ${
                              result.correct ? "text-emerald-300" : "text-rose-300"
                            }`}>
                              {result.correct ? "✓ Correct" : "✗ Incorrect"}
                            </span>
                            {question && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                                {question.type === "mcq" ? "Single Choice" : 
                                 question.type === "multi_correct" ? "Multiple Choice" :
                                 question.type === "fill_blank" ? "Fill Blank" : "Writing"}
                              </span>
                            )}
                          </div>
                          
                          {question && (
                            <div className="text-sm text-white/80 mb-3 leading-relaxed">
                              {question.prompt}
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="rounded-lg bg-black/20 border border-white/10 p-3">
                              <div className="text-xs font-semibold text-white/70 mb-1">Your Answer:</div>
                              <div className="text-sm text-white/90">
                                {Array.isArray(result.userAnswer) 
                                  ? result.userAnswer.join(", ") 
                                  : result.userAnswer || "No answer"}
                              </div>
                            </div>
                            
                            {!result.correct && (
                              <>
                                <div className={`rounded-lg border p-3 ${
                                  result.correct 
                                    ? "bg-emerald-500/10 border-emerald-400/30" 
                                    : "bg-cyan-500/10 border-cyan-400/30"
                                }`}>
                                  <div className="text-xs font-semibold text-cyan-200 mb-1">Correct Answer:</div>
                                  <div className="text-sm text-cyan-100">
                                    {Array.isArray(result.correctAnswer) 
                                      ? result.correctAnswer.join(", ") 
                                      : result.correctAnswer}
                                  </div>
                                </div>
                                
                                {result.feedback && (
                                  <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 p-3">
                                    <div className="flex items-start gap-2">
                                      <span className="text-base flex-shrink-0">💡</span>
                                      <div>
                                        <div className="text-xs font-semibold text-amber-200 mb-1">Explanation:</div>
                                        <div className="text-sm text-amber-100 leading-relaxed">{result.feedback}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {!evaluation && (
            <button
              onClick={handleSubmit}
              disabled={submitting || answeredCount < 20 || pendingSaves.size > 0}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-8 py-4 font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-3"
              type="button"
            >
              {submitting ? (
                <>
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-white border-t-transparent"></div>
                  <span>Evaluating Your Test...</span>
                </>
              ) : pendingSaves.size > 0 ? (
                <>
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-white border-t-transparent"></div>
                  <span>Saving Answers...</span>
                </>
              ) : answeredCount < 20 ? (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Answer All Questions ({answeredCount}/20)</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Submit Test for Evaluation</span>
                </>
              )}
            </button>
          )}

          {evaluation && (
            <>
              <button
                onClick={handleRetake}
                disabled={retaking || generating}
                className="flex-1 rounded-xl border-2 border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 disabled:bg-gray-600 disabled:border-gray-600 disabled:cursor-not-allowed px-8 py-4 font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-3"
                type="button"
              >
                {retaking ? (
                  <>
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-white border-t-transparent"></div>
                    <span>Resetting Test...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Retake Same Test</span>
                  </>
                )}
              </button>
              <button
                onClick={handleNewTest}
                disabled={generating || retaking}
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-8 py-4 font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-3"
                type="button"
              >
                {generating ? (
                  <>
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-white border-t-transparent"></div>
                    <span>Generating New Test...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Generate New Test</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
