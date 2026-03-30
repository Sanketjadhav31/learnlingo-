import { useEffect, useMemo, useRef, useState } from "react";
import { TrackerPanel } from "./components/TrackerPanel";
import { LessonPanel } from "./components/LessonPanel";
import { SubmissionEditor } from "./components/SubmissionEditor";
import { EvaluationPanel } from "./components/EvaluationPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Toast, type ToastType } from "./components/Toast";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { clearAuthToken, fetchDay, login, resetToday, resetUser, setAuthToken, signup, submitDay, updateSectionProgress, verifySession } from "./lib/api";
import type { DayContent, DayProgress, Evaluation, Tracker } from "./lib/types";

type LoadingState = {
  isLoading: boolean;
  message: string;
  submessage?: string;
};

type ConfirmState = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: "warning" | "danger";
  onConfirm: () => void;
};

export default function App() {
  const [authUser, setAuthUser] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [day, setDay] = useState<DayContent | null>(null);
  const [dayProgress, setDayProgress] = useState<DayProgress | null>(null);
  const [submission, setSubmission] = useState("");
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true, message: "Initializing..." });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    type: "warning",
    onConfirm: () => {},
  });
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const header = useMemo(() => {
    const d = day?.dayNumber ?? tracker?.day ?? 1;
    const theme = day?.dayTheme ?? "Loading...";
    return { d, theme };
  }, [day, tracker]);

  const canSubmit = !!day && !!submission.trim() && !submitting && !!dayProgress?.canSubmit;

  async function load() {
    if (!authUser) return;
    console.log(`🔄 [Frontend] Loading day for user: ${authUser.userId}`);
    setLoadingState({ isLoading: true, message: "Loading your lesson...", submessage: "Fetching day content and progress" });
    try {
      console.log(`📡 [Frontend] Fetching day data...`);
      const data = await fetchDay();
      console.log(`✓ [Frontend] Day data received:`, {
        day: data.dayContent?.dayNumber,
        theme: data.dayContent?.dayTheme,
        trackerStatus: data.tracker?.finalStatus
      });
      setTracker(data.tracker);
      setDay(data.dayContent);
      setDayProgress(data.dayProgress || null);
      // Load saved draft if available
      console.log(`💾 [Frontend] Draft received:`, {
        hasDraft: !!data.submissionDraft,
        length: data.submissionDraft?.length || 0,
        preview: data.submissionDraft?.substring(0, 100) || 'empty'
      });
      if (data.submissionDraft && data.submissionDraft.trim().length > 0) {
        console.log(`💾 [Frontend] Loading saved draft (${data.submissionDraft.length} chars)`);
        setSubmission(data.submissionDraft);
        setIsDraftLoaded(true);
      } else {
        console.log(`💾 [Frontend] No draft to load, marking as loaded`);
        setIsDraftLoaded(true); // Mark as loaded even if empty
      }
      // If evaluation state is lost (page refresh / day advance), restore from backend.
      if (!evaluation && data.lastEvaluation) {
        setEvaluation(data.lastEvaluation);
      }
      console.log(`✓ [Frontend] State updated successfully`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Failed to load";
      console.error(`❌ [Frontend] Load failed:`, errorMsg);
      showToast("error", friendlyError(errorMsg));
    } finally {
      setLoadingState({ isLoading: false, message: "" });
      console.log(`✓ [Frontend] Loading complete`);
    }
  }

  useEffect(() => {
    setLoadingState({ isLoading: true, message: "Verifying session...", submessage: "Please wait" });
    verifySession()
      .then((v) => {
        setAuthUser(v.user);
      })
      .catch(() => {
        clearAuthToken();
      })
      .finally(() => setLoadingState({ isLoading: false, message: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.userId]);

  function showToast(type: ToastType, message: string) {
    setToast({ type, message });
  }

  function friendlyError(msg: string) {
    const m = String(msg || "");
    if (m.includes("429") || m.toLowerCase().includes("quota") || m.toLowerCase().includes("billing")) {
      return "Gemini quota/billing is blocked (429). Enable billing in Google AI Studio for real AI feedback.";
    }
    if (m.length > 180) return m.slice(0, 180) + "…";
    return m;
  }

  async function onSubmit() {
    if (!day) return;
    // Prevent double-click / duplicate submits before React state updates.
    if (submittingRef.current) return;
    console.log(`📝 [Frontend] Submitting for day ${day.dayNumber}`);
    console.log(`📏 [Frontend] Submission length: ${submission.length} characters`);
    submittingRef.current = true;
    setSubmitting(true);
    setLoadingState({ 
      isLoading: true, 
      message: "Evaluating your work...", 
      submessage: "AI is analyzing your submission. This may take 30-60 seconds." 
    });
    try {
      console.log(`📡 [Frontend] Sending submission...`);
      const res = await submitDay(submission);
      console.log(`✓ [Frontend] Submission response:`, {
        score: res.evaluation.overallPercent,
        tier: res.evaluation.tier,
        action: res.next.action,
        trackerStatus: res.tracker.todayWorkStatus
      });
      setTracker(res.tracker);
      setDayProgress(res.dayProgress || null);
      setEvaluation(res.evaluation);
      
      // Automatically switch to evaluation tab to show results
      setActiveTab("evaluation");

      // Show appropriate message based on advancement
      if (res.next.action === "advance") {
        showToast(
          "success",
          `🎉 Excellent! Day ${res.next.day - 1} completed! Moving to Day ${res.next.day}...`
        );
      } else {
        showToast(
          "info",
          `📊 Evaluation complete! Score: ${Math.round(res.evaluation.overallPercent)}%. ${res.evaluation.passFail === "PASS" ? "Already advanced today - come back tomorrow!" : "Try again to improve your score!"}`
        );
      }
      
      // If advanced to next day, reload after showing results
      if (res.next.action === "advance") {
        setLoadingState({ isLoading: true, message: "Loading next day...", submessage: "Preparing your next lesson" });
        setTimeout(() => load(), 2000);
      } else {
        // Reload tracker to ensure fresh data
        setTimeout(() => load(), 500);
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Submit failed";
      console.error(`❌ [Frontend] Submit failed:`, errorMsg);
      const friendly = friendlyError(errorMsg);
      showToast("error", friendly);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
      setLoadingState({ isLoading: false, message: "" });
      console.log(`✓ [Frontend] Submit process complete`);
    }
  }

  async function onResetAll() {
    // Show custom confirmation dialog
    setConfirmState({
      isOpen: true,
      title: "Reset All Progress",
      message: "This will permanently delete:\n\n• All completed days\n• Your streak and history\n• All submissions and evaluations\n• All progress data\n\nYou will start from Day 1.\n\nAre you sure you want to continue?",
      confirmText: "Reset All",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        setConfirmState({ ...confirmState, isOpen: false });
        console.log("🔄 [Frontend] Resetting all progress");
        setLoadingState({ isLoading: true, message: "Resetting all progress...", submessage: "This will clear all your data" });
        try {
          console.log(`📡 [Frontend] Sending full reset request...`);
          await resetUser();
          console.log(`✓ [Frontend] Full reset successful, reloading...`);
          showToast("success", "All progress reset successfully");
          await load();
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Reset failed";
          console.error(`❌ [Frontend] Reset all failed:`, errorMsg);
          showToast("error", friendlyError(errorMsg));
        } finally {
          setLoadingState({ isLoading: false, message: "" });
        }
      },
    });
  }

  async function onResetToday() {
    // Show custom confirmation dialog
    setConfirmState({
      isOpen: true,
      title: "Reset Today's Work?",
      message: "This will clear:\n\n• Today's submission\n• Today's evaluation\n• Today's draft\n• Section progress\n\nYour overall progress (streak, completed days) will NOT be affected.\n\nContinue?",
      confirmText: "Reset Today",
      cancelText: "Cancel",
      type: "warning",
      onConfirm: async () => {
        setConfirmState({ ...confirmState, isOpen: false });
        console.log("🔄 [Frontend] Resetting today's work");
        setLoadingState({ isLoading: true, message: "Resetting today...", submessage: "Clearing today's submission and evaluation" });
        try {
          console.log(`📡 [Frontend] Sending reset today request...`);
          await resetToday();
          console.log(`✓ [Frontend] Reset today successful, reloading...`);
          showToast("success", "Today's work reset successfully");
          await load();
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : "Reset today failed";
          console.error(`❌ [Frontend] Reset today failed:`, errorMsg);
          showToast("error", friendlyError(errorMsg));
        } finally {
          setLoadingState({ isLoading: false, message: "" });
        }
      },
    });
  }

  const [activeTab, setActiveTab] = useState<"progress" | "lesson" | "submission" | "evaluation" | "history">("progress");

  async function onToggleSectionDone(sectionId: string, done: boolean) {
    try {
      const res = await updateSectionProgress(sectionId, done);
      setDayProgress(res.dayProgress);
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Failed to update progress");
    }
  }

  async function onAuthSubmit() {
    try {
      const res = authMode === "signup"
        ? await signup(authForm.name, authForm.email, authForm.password)
        : await login(authForm.email, authForm.password);
      setAuthToken(res.token);
      setAuthUser(res.user);
      setAuthForm({ name: "", email: "", password: "" });
      showToast("success", authMode === "signup" ? "Signup successful" : "Login successful");
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Authentication failed");
    }
  }

  function onLogout() {
    clearAuthToken();
    setAuthUser(null);
    setTracker(null);
    setDay(null);
    setDayProgress(null);
    setSubmission("");
    setEvaluation(null);
  }

  if (!authUser) {
    if (loadingState.isLoading) {
      return <LoadingSpinner message={loadingState.message} submessage={loadingState.submessage} size="lg" fullScreen />;
    }
    
    return (
      <div className="h-screen bg-[#0a0e1a] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 p-6 space-y-4">
          <div className="text-xl font-bold">{authMode === "signup" ? "Create account" : "Login"}</div>
          {authMode === "signup" && (
            <input value={authForm.name} onChange={(e) => setAuthForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="w-full rounded border border-white/20 bg-black/40 px-3 py-2" />
          )}
          <input value={authForm.email} onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="w-full rounded border border-white/20 bg-black/40 px-3 py-2" />
          <input type="password" value={authForm.password} onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password (min 8)" className="w-full rounded border border-white/20 bg-black/40 px-3 py-2" />
          <button onClick={onAuthSubmit} className="w-full rounded bg-indigo-500 px-3 py-2 font-semibold" type="button">{authMode === "signup" ? "Signup" : "Login"}</button>
          <button onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))} className="w-full text-sm text-indigo-300" type="button">
            {authMode === "login" ? "Need an account? Signup" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1629] to-[#0a0e1a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-black/40 via-black/30 to-black/40 backdrop-blur-xl shrink-0">
        <div className="mx-auto max-w-7xl px-2 sm:px-4 py-2">
          <div className="flex flex-col gap-2">
            {/* Top row - Logo, Title, User */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 flex-shrink-0">
                  <span className="text-xl sm:text-2xl">🎓</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] sm:text-xs font-medium text-indigo-300/80 tracking-wide uppercase truncate">AI English Trainer</div>
                  <div className="text-sm sm:text-xl font-bold text-white flex items-center gap-1 flex-wrap">
                    <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                      Day {header.d}
                    </span>
                    <span className="text-white/40 hidden xs:inline">•</span>
                    <span className="text-white/90 text-xs sm:text-xl truncate">{header.theme}</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] sm:text-sm text-white/80 px-1 whitespace-nowrap flex items-center gap-1">
                <span className="hidden xs:inline">👤</span>
                <span className="hidden sm:inline">{authUser.name}</span>
                <span className="sm:hidden">{authUser.name.split(' ')[0]}</span>
              </div>
            </div>
            
            {/* Bottom row - Action buttons in grid */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
              <button
                onClick={load}
                className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm px-2 py-1.5 text-[10px] sm:text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 flex items-center justify-center gap-1"
                type="button"
              >
                <span className="text-sm">🔄</span>
                <span>Reload</span>
              </button>
              <button
                onClick={onResetToday}
                className="rounded-lg border border-amber-400/30 bg-amber-500/10 backdrop-blur-sm px-2 py-1.5 text-[10px] sm:text-sm font-medium text-amber-100 hover:bg-amber-500/20 hover:border-amber-400/50 transition-all duration-200 flex items-center justify-center gap-1"
                type="button"
              >
                <span className="text-sm">🔄</span>
                <span className="hidden xs:inline">Reset Today</span>
                <span className="xs:hidden">Today</span>
              </button>
              <button
                onClick={onResetAll}
                className="rounded-lg border border-rose-400/30 bg-rose-500/10 backdrop-blur-sm px-2 py-1.5 text-[10px] sm:text-sm font-medium text-rose-100 hover:bg-rose-500/20 hover:border-rose-400/50 transition-all duration-200 flex items-center justify-center gap-1"
                type="button"
              >
                <span className="text-sm">🗑️</span>
                <span className="hidden xs:inline">Reset All</span>
                <span className="xs:hidden">All</span>
              </button>
              <button 
                onClick={onLogout} 
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] sm:text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-1" 
                type="button"
              >
                <span className="text-sm">🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm shrink-0 overflow-x-auto">
        <div className="mx-auto max-w-7xl px-2 sm:px-4">
          <div className="flex gap-0.5 sm:gap-1 min-w-max">
            {[
              { id: "progress", icon: "📊", label: "Progress", color: "from-blue-500 to-cyan-500" },
              { id: "lesson", icon: "📚", label: "Lesson", color: "from-indigo-500 to-purple-500" },
              { id: "submission", icon: "✍️", label: "Submit Work", shortLabel: "Submit", color: "from-purple-500 to-pink-500" },
              { id: "evaluation", icon: "📈", label: "Evaluation", shortLabel: "Eval", color: "from-emerald-500 to-teal-500" },
              { id: "history", icon: "📜", label: "History", color: "from-amber-500 to-orange-500" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`relative px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-white/60 hover:text-white/80"
                }`}
                type="button"
              >
                <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                  <span className="text-sm sm:text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{(tab as any).shortLabel || tab.label}</span>
                </span>
                {activeTab === tab.id && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${tab.color} opacity-20 rounded-t-lg`} />
                )}
                <div
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tab.color} transition-all duration-200 ${
                    activeTab === tab.id ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden min-h-0">
        {/* Global Loading Overlay */}
        {loadingState.isLoading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gradient-to-br from-black/80 to-black/60 border border-white/20 rounded-2xl p-8 shadow-2xl">
              <LoadingSpinner 
                message={loadingState.message} 
                submessage={loadingState.submessage} 
                size="lg" 
              />
            </div>
          </div>
        )}
        
        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          type={confirmState.type}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
        />
        
        {/* Toast Notification */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
            duration={2000}
          />
        )}
        
        <div className="mx-auto max-w-7xl px-2 sm:px-4 py-2 h-full">
          <div className="h-full transition-all duration-300">
            {activeTab === "progress" && (
              <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-auto">
                <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-3 sm:p-6 shadow-2xl">
                  <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20">
                      <span className="text-lg sm:text-xl">📊</span>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">Progress Tracker</h2>
                      <p className="text-xs sm:text-sm text-white/60">Monitor your learning journey</p>
                    </div>
                  </div>
                  {tracker ? <TrackerPanel tracker={tracker} dayProgress={dayProgress} /> : (
                    <div className="text-center py-8 sm:py-12 text-white/70">
                      <div className="text-3xl sm:text-4xl mb-3">📊</div>
                      <div className="text-sm sm:text-base">No progress data available</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "lesson" && (
              <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-2 sm:p-3 shadow-2xl h-full flex flex-col">
                  <div className="flex-1 overflow-auto pr-1 sm:pr-2 custom-scrollbar">
                    {day ? (
                      <LessonPanel day={day} dayProgress={dayProgress} onToggleSectionDone={onToggleSectionDone} />
                    ) : (
                      <div className="text-center py-8 sm:py-12 text-white/70">
                        <div className="text-3xl sm:text-4xl mb-3">📚</div>
                        <div className="text-sm sm:text-base">No lesson loaded</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "submission" && (
              <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {day ? (
                  <>
                    <SubmissionEditor
                      day={day}
                      value={submission}
                      onChange={setSubmission}
                      onSubmit={onSubmit}
                      submitting={submitting}
                      canSubmit={canSubmit}
                      isDraftLoaded={isDraftLoaded}
                    />
                    {dayProgress && !dayProgress.canSubmit && (
                      <div className="mt-2 text-xs sm:text-sm text-amber-300 px-2">
                        Complete at least {dayProgress.requiredSections} sections before submitting.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-4 sm:p-6 shadow-2xl h-full flex items-center justify-center">
                    <div className="text-center text-white/70">
                      <div className="text-3xl sm:text-4xl mb-3">✍️</div>
                      <div className="text-sm sm:text-base">Load the day first to submit work</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "evaluation" && (
              <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-3 sm:p-6 shadow-2xl h-full flex flex-col">
                  <div className="flex-1 overflow-auto pr-1 sm:pr-2 custom-scrollbar">
                    <EvaluationPanel evaluation={evaluation} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-3 sm:p-6 shadow-2xl h-full flex flex-col">
                  <div className="flex-1 overflow-auto pr-1 sm:pr-2 custom-scrollbar">
                    <HistoryPanel />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
