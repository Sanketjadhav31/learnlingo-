import type { Tracker, DayProgress } from "../lib/types";

function badgeClass(value: string) {
  switch (value) {
    case "Checked":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-400/20";
    case "Done":
      return "bg-green-500/15 text-green-200 border-green-400/20";
    case "Submitted":
      return "bg-amber-500/15 text-amber-200 border-amber-400/20";
    default:
      return "bg-slate-500/15 text-slate-200 border-slate-400/20";
  }
}

function statusClass(value: string) {
  switch (value) {
    case "Completed":
      return "bg-emerald-500/20 text-emerald-200 border-emerald-400/30";
    case "Failed":
      return "bg-rose-500/20 text-rose-200 border-rose-400/30";
    case "Under Review":
      return "bg-amber-500/20 text-amber-200 border-amber-400/30";
    default:
      return "bg-slate-500/15 text-slate-200 border-slate-400/20";
  }
}

export function TrackerPanel({ tracker, dayProgress }: { tracker: Tracker; dayProgress: DayProgress | null }) {
  const work = tracker.todayWorkStatus || {};
  const cleanedMistakes = (tracker.commonMistakes || [])
    .map((m) => {
      // Handle both old string format and new object format
      if (typeof m === 'string') {
        return m;
      } else if (typeof m === 'object' && m !== null && 'mistake' in m) {
        return m.mistake;
      }
      return String(m);
    })
    .filter((m) => !/gemini unavailable/i.test(String(m)))
    .filter((m) => !/⚠️ AI evaluation unavailable/i.test(String(m)))
    .filter(Boolean);

  // Map lesson sections to work items
  const sectionsRead = dayProgress?.sectionsRead || {};
  const items = [
    ["Grammar", sectionsRead["grammar"] ? "Done" : work["Grammar"] || "Pending"],
    ["Speaking", work["Speaking"] || "Pending"],
    ["Writing", work["Writing"] || "Pending"],
    ["Conversation", work["Conversation"] || "Pending"],
    ["Sentences (20)", sectionsRead["sentences"] ? "Done" : work["Sentences (20)"] || "Pending"],
    ["Questions", sectionsRead["questions"] ? "Done" : work["Questions"] || "Pending"],
    ["Listening (3)", sectionsRead["listening"] ? "Done" : work["Listening (3)"] || "Pending"],
    ["Reflection", work["Reflection"] || "Pending"],
  ] as const;

  const progressPercent = Math.round((tracker.totalDaysCompleted / tracker.day) * 100);

  return (
    <div className="space-y-3">
      {/* Top Row: Stats + Progress */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-3">
          <div className="text-xs text-blue-300/80 mb-1">Current Day</div>
          <div className="text-2xl font-bold text-white">{tracker.day}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-3">
          <div className="text-xs text-emerald-300/80 mb-1">Completed</div>
          <div className="text-2xl font-bold text-white">{tracker.totalDaysCompleted}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-orange-500/10 to-amber-500/10 p-3">
          <div className="text-xs text-orange-300/80 mb-1">Streak 🔥</div>
          <div className="text-2xl font-bold text-white">{tracker.streak}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/60 mb-1">Overall Progress</div>
          <div className="text-2xl font-bold text-indigo-300">{progressPercent}%</div>
          <div className="mt-2 h-1.5 rounded-full bg-white/5">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Middle Row: Status + Confidence */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white/70">Status</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(tracker.finalStatus)}`}>
              {tracker.finalStatus}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs font-medium text-white/60 mb-2">Confidence Scores</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Grammar", value: tracker.confidenceScore.Grammar },
              { label: "Speaking", value: tracker.confidenceScore.Speaking },
              { label: "Writing", value: tracker.confidenceScore.Writing },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-xs text-white/50">{item.label}</div>
                <div className="text-lg font-bold text-indigo-300">{item.value}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Today's Work (horizontal) */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="text-xs font-semibold text-white/70 mb-2">Today's Work</div>
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          {items.map(([name, value]) => (
            <div key={name} className="flex-shrink-0 rounded-lg border border-white/10 bg-black/10 px-3 py-2 min-w-[140px]">
              <div className="text-xs text-white/80 mb-1">{name}</div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass(value || "Pending")}`}>
                {value || "Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Common Mistakes (horizontal if exists) */}
      {cleanedMistakes.length > 0 && (
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span>⚠️</span>
            <div className="text-xs font-semibold text-white/70">Common Mistakes</div>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-thin">
            {cleanedMistakes.slice(0, 3).map((m, i) => (
              <div key={i} className="flex-shrink-0 text-xs text-rose-200 bg-rose-500/10 border border-rose-400/20 rounded px-3 py-2 min-w-[200px]">
                {i + 1}. {m}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

