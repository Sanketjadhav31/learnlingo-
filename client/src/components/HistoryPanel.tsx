import { useEffect, useState } from "react";
import { fetchHistory } from "../lib/api";
import { EvaluationPanel } from "./EvaluationPanel";
import type { Evaluation } from "../lib/types";

type HistoryEntry = {
  dayNumber: number;
  date: string;
  overallPercent: number;
  tier: string;
  passFail: string;
  scoreBreakdown: {
    sentencesPercent: number;
    writingPercent: number;
    speakingPercent: number;
    conversationPercent: number;
    questionsPercent: number;
    listeningPercent: number;
  };
  theme: string;
  grammarFocus: string;
  fullEvaluation: Evaluation | null;
};

export function HistoryPanel() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ currentDay: 0, totalDaysCompleted: 0, streak: 0 });
  const [selectedDay, setSelectedDay] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      const data = await fetchHistory();
      setHistory(data.history);
      setStats({
        currentDay: data.currentDay,
        totalDaysCompleted: data.totalDaysCompleted,
        streak: data.streak,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4">
        <div className="text-rose-200">Error: {error}</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-8 text-center">
        <div className="text-4xl mb-3">📚</div>
        <div className="text-white/80 font-medium mb-2">No History Yet</div>
        <div className="text-white/50 text-sm">Complete your first day to see your progress history here</div>
      </div>
    );
  }

  // If a day is selected, show its full evaluation
  if (selectedDay) {
    return (
      <div className="space-y-4">
        {/* Back button */}
        <button
          onClick={() => setSelectedDay(null)}
          className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
          type="button"
        >
          <span>←</span>
          <span>Back to History</span>
        </button>

        {/* Day info banner - compact */}
        <div className="rounded-lg border border-indigo-400/30 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-indigo-200">Day {selectedDay.dayNumber}</span>
              {selectedDay.theme !== "Unknown" && (
                <span className="text-sm text-white/70">{selectedDay.theme}</span>
              )}
              {selectedDay.grammarFocus !== "Unknown" && (
                <span className="text-xs text-white/50">• {selectedDay.grammarFocus}</span>
              )}
            </div>
            <div className="text-xs text-white/40">{new Date(selectedDay.date).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Full evaluation - show directly */}
        {selectedDay.fullEvaluation ? (
          <EvaluationPanel evaluation={selectedDay.fullEvaluation} />
        ) : (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <div className="text-amber-200 font-medium mb-1">Detailed Evaluation Not Available</div>
                <div className="text-amber-200/70 text-sm">
                  This day was completed before detailed evaluation storage was implemented. 
                  Only score breakdown is available for historical days.
                </div>
                <div className="text-amber-200/70 text-sm mt-2">
                  💡 New submissions will include full evaluation details (sentence corrections, feedback, etc.)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // History list view
  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-3">
          <div className="text-xs text-blue-300/80 mb-1">Current Day</div>
          <div className="text-2xl font-bold text-white">{stats.currentDay}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-3">
          <div className="text-xs text-emerald-300/80 mb-1">Completed</div>
          <div className="text-2xl font-bold text-white">{stats.totalDaysCompleted}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-orange-500/10 to-amber-500/10 p-3">
          <div className="text-xs text-orange-300/80 mb-1">Streak 🔥</div>
          <div className="text-2xl font-bold text-white">{stats.streak}</div>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-white/70 mb-3">📜 Past Days (Click to view details)</div>
        {history.slice().reverse().map((entry) => (
          <button
            key={entry.dayNumber}
            onClick={() => setSelectedDay(entry)}
            className="w-full rounded-lg border border-white/10 bg-black/20 p-4 hover:bg-black/30 hover:border-white/20 transition-all cursor-pointer text-left"
            type="button"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-indigo-300">Day {entry.dayNumber}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      entry.passFail === "PASS"
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                        : "border-rose-400/50 bg-rose-500/20 text-rose-200"
                    }`}
                  >
                    {entry.passFail}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      entry.tier === "Strong"
                        ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                        : entry.tier === "Medium"
                        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                        : "border-rose-400/30 bg-rose-500/10 text-rose-200"
                    }`}
                  >
                    {entry.tier}
                  </span>
                </div>
                <div className="text-sm text-white/70">{entry.theme}</div>
                <div className="text-xs text-white/50">{entry.grammarFocus}</div>
                <div className="text-xs text-white/40 mt-1">{new Date(entry.date).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{entry.overallPercent}%</div>
                <div className="text-xs text-white/50">Overall</div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">Grammar</div>
                <div className="text-sm font-bold text-white">{entry.scoreBreakdown.sentencesPercent}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">Writing</div>
                <div className="text-sm font-bold text-white">{entry.scoreBreakdown.writingPercent}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">Speaking</div>
                <div className="text-sm font-bold text-white">{entry.scoreBreakdown.speakingPercent}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">Conversation</div>
                <div className="text-sm font-bold text-white">{entry.scoreBreakdown.conversationPercent}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">Questions</div>
                <div className="text-sm font-bold text-white">{entry.scoreBreakdown.questionsPercent}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">Listening</div>
                <div className="text-sm font-bold text-white">{entry.scoreBreakdown.listeningPercent}%</div>
              </div>
            </div>
            
            {/* Click hint */}
            <div className="text-xs text-white/40 mt-3 text-center">Click to view full evaluation →</div>
          </button>
        ))}
      </div>
    </div>
  );
}
