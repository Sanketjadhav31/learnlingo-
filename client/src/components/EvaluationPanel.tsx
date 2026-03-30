import { useMemo, useState } from "react";
import type { Evaluation } from "../lib/types";

type Tab = "All" | "Correct" | "Partial" | "Incorrect";

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// Helper function to format text with **bold** and `code` markdown
function formatText(text: string): React.ReactNode {
  if (!text) return text;
  
  // Split by both **bold** and `code` patterns
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const boldText = part.slice(2, -2);
          return (
            <span key={i} className="font-semibold text-amber-200 bg-amber-500/10 px-1 rounded">
              {boldText}
            </span>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          const codeText = part.slice(1, -1);
          return (
            <code key={i} className="font-mono text-cyan-200 bg-cyan-500/15 px-1.5 py-0.5 rounded text-sm border border-cyan-400/20">
              {codeText}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function EvaluationPanel({ evaluation }: { evaluation: Evaluation | null }) {
  const [tab, setTab] = useState<Tab>("All");
  const [selectedK, setSelectedK] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string>("sentences");

  const EVAL_SECTIONS = useMemo(() => {
    const sections: Array<[string, string]> = [
      ["sentences", "Sentence Corrections"],
    ];
    
    // Show Hindi→English tab if hindiTranslation exists and has answers
    if (evaluation?.hindiTranslation && 
        evaluation.hindiTranslation.answers && 
        Array.isArray(evaluation.hindiTranslation.answers) && 
        evaluation.hindiTranslation.answers.length > 0) {
      sections.push(["hindi", "Hindi→English"]);
    }
    
    // Show Questions tab if questions exists and has answers
    if (evaluation?.questions && 
        evaluation.questions.answers && 
        Array.isArray(evaluation.questions.answers) && 
        evaluation.questions.answers.length > 0) {
      sections.push(["questions", "Questions"]);
    }
    
    sections.push(
      ["writing", "Writing Feedback"],
      ["speaking", "Speaking Feedback"],
      ["conversation", "Conversation Feedback"],
      ["mistakes", "Common Mistakes"]
    );
    
    if (evaluation?.todaySummary) {
      sections.push(["summary", "📚 Learning Summary"]);
    }
    
    return sections;
  }, [evaluation]);

  const filtered = useMemo(() => {
    if (!evaluation) return [];
    const list = evaluation.sentenceEvaluations || [];
    if (tab === "All") return list;
    if (tab === "Correct") return list.filter((s) => s.correctness === "Correct");
    if (tab === "Partial") return list.filter((s) => s.correctness === "Partially Correct");
    return list.filter((s) => s.correctness === "Incorrect");
  }, [evaluation, tab]);

  // Check if this is a fallback evaluation (no AI feedback)
  const isFallback = evaluation && (evaluation as any).__warning;

  if (!evaluation) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-center">
        <div className="text-sm text-white/60">Submit your work to see evaluation results.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isFallback && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⚠️</span>
            <div className="text-sm font-semibold text-amber-200">AI Evaluation Unavailable</div>
          </div>
          <div className="text-xs text-amber-100/80">
            {(evaluation as any).__warning}
          </div>
        </div>
      )}
      
      {/* Overall Result Card - Stack vertically on mobile */}
      <div className="rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 p-2 sm:p-3">
        {/* Top row - badges and score */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-[10px] sm:text-xs text-white/70">Overall</div>
            <span className={cn(
              "px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold",
              evaluation.passFail === "PASS" ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"
            )}>
              {evaluation.passFail}
            </span>
            <span className="px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs bg-purple-500/20 text-purple-200">
              {evaluation.tier}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">{Math.round(evaluation.overallPercent)}%</div>
        </div>

        {/* Score Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          <div className="rounded border border-white/10 bg-black/20 p-1.5 sm:p-2 text-center">
            <div className="text-[9px] sm:text-xs text-white/60 mb-0.5">Grammar</div>
            <div className="text-sm sm:text-base font-semibold text-white">{Math.round(evaluation.scoreBreakdown.sentencesPercent || 0)}%</div>
          </div>
          {evaluation.hindiTranslation && evaluation.hindiTranslation.answers && evaluation.hindiTranslation.answers.length > 0 && (
            <div className="rounded border border-white/10 bg-black/20 p-1.5 sm:p-2 text-center">
              <div className="text-[9px] sm:text-xs text-white/60 mb-0.5">Hindi→Eng</div>
              <div className="text-sm sm:text-base font-semibold text-white">{Math.round(evaluation.hindiTranslation.scorePercent || 0)}%</div>
            </div>
          )}
          <div className="rounded border border-white/10 bg-black/20 p-1.5 sm:p-2 text-center">
            <div className="text-[9px] sm:text-xs text-white/60 mb-0.5">Writing</div>
            <div className="text-sm sm:text-base font-semibold text-white">{Math.round(evaluation.writing.scorePercent || 0)}%</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-1.5 sm:p-2 text-center">
            <div className="text-[9px] sm:text-xs text-white/60 mb-0.5">Speaking</div>
            <div className="text-sm sm:text-base font-semibold text-white">{Math.round(evaluation.speaking.scorePercent || 0)}%</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-1.5 sm:p-2 text-center">
            <div className="text-[9px] sm:text-xs text-white/60 mb-0.5">Conversation</div>
            <div className="text-sm sm:text-base font-semibold text-white">{Math.round(evaluation.conversation.scorePercent || 0)}%</div>
          </div>
          {evaluation.questions && evaluation.questions.answers && evaluation.questions.answers.length > 0 && (
            <div className="rounded border border-white/10 bg-black/20 p-1.5 sm:p-2 text-center">
              <div className="text-[9px] sm:text-xs text-white/60 mb-0.5">Questions</div>
              <div className="text-sm sm:text-base font-semibold text-white">{Math.round(evaluation.questions.scorePercent || 0)}%</div>
            </div>
          )}
          {evaluation.listening && evaluation.listening.answers && evaluation.listening.answers.length > 0 && (
            <div className="rounded border border-white/10 bg-black/20 p-1.5 sm:p-2 text-center">
              <div className="text-[9px] sm:text-xs text-white/60 mb-0.5">Listening</div>
              <div className="text-sm sm:text-base font-semibold text-white">{Math.round(evaluation.listening.scorePercent || 0)}%</div>
            </div>
          )}
        </div>

        {/* Motivational Message */}
        {evaluation.motivationalMessage && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 mt-2">
            <div className="text-xs italic text-emerald-200">{formatText(evaluation.motivationalMessage)}</div>
          </div>
        )}

        {/* Day Advancement Status */}
        {evaluation.passFail === "PASS" && evaluation.overallPercent >= 70 && (
          <div className="rounded-lg border border-indigo-400/40 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 p-3 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎉</span>
              <span className="text-sm font-semibold text-indigo-200">Day Completed!</span>
            </div>
            <div className="text-xs text-indigo-100/80">
              Great job! You've passed this day. The system will automatically advance you to the next day if it's a new calendar day (IST timezone).
            </div>
          </div>
        )}

        {evaluation.passFail === "FAIL" && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">💪</span>
              <span className="text-sm font-semibold text-amber-200">Keep Practicing!</span>
            </div>
            <div className="text-xs text-amber-100/80">
              You need 70% or higher to advance to the next day. Review the feedback below and try again!
            </div>
          </div>
        )}

        {/* Take Test Button - Show if passed with ≥70% */}
        {evaluation.passFail === "PASS" && evaluation.overallPercent >= 70 && (
          <div className="mt-2">
            <button
              onClick={() => window.open('/test', '_blank')}
              className="w-full rounded-lg border border-purple-400/50 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 p-3 transition-all flex items-center justify-center gap-2 group"
              type="button"
            >
              <span className="text-lg">📝</span>
              <span className="text-sm font-semibold text-purple-200 group-hover:text-purple-100">
                Take Cumulative Test
              </span>
              <span className="text-xs text-purple-300/80">(Opens in new tab)</span>
            </button>
          </div>
        )}
      </div>

      {/* Strengths Pills */}
      {evaluation.strengths && evaluation.strengths.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-white/70">Strengths Today</div>
          <div className="flex flex-wrap gap-1.5">
            {evaluation.strengths.map((strength, i) => (
              <span key={i} className="px-2 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
                ✓ {formatText(strength)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Focus */}
      {evaluation.improvementFocus && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2.5">
          <div className="text-xs font-semibold text-amber-200 mb-1">Focus next on:</div>
          <div className="text-xs text-amber-100">{formatText(evaluation.improvementFocus)}</div>
        </div>
      )}

      {/* Horizontal Section Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2" style={{scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent'}}>
        {EVAL_SECTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`rounded-lg border px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0 ${
              activeSection === id 
                ? "border-indigo-400/60 bg-indigo-500/20 text-white font-semibold" 
                : "border-white/10 bg-white/5 text-white/80"
            }`}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
        {activeSection === "writing" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✍️</span>
              <div className="text-sm font-semibold text-white/90">Writing Feedback</div>
            </div>
            
            {evaluation.writing.original && (
              <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-3">
                <div className="text-xs text-red-300 font-semibold mb-2">❌ Your Original:</div>
                <div className="text-sm text-white/85 leading-relaxed">{formatText(evaluation.writing.original)}</div>
              </div>
            )}
            
            {evaluation.writing.corrected && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                <div className="text-xs text-emerald-300 font-semibold mb-2">✅ Corrected Version:</div>
                <div className="text-sm text-white/85 leading-relaxed">{formatText(evaluation.writing.corrected)}</div>
              </div>
            )}
            
            {evaluation.writing.issues && evaluation.writing.issues.length > 0 && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                <div className="text-xs text-amber-300 font-semibold mb-2">🔍 Issues Found:</div>
                <ul className="space-y-1">
                  {evaluation.writing.issues.map((issue, i) => (
                    <li key={i} className="text-sm text-white/85 flex gap-2">
                      <span className="text-amber-400">•</span>
                      <span>{formatText(issue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {evaluation.writing.improvements && evaluation.writing.improvements.length > 0 && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
                <div className="text-xs text-blue-300 font-semibold mb-2">💡 Improvements:</div>
                <ul className="space-y-1">
                  {evaluation.writing.improvements.map((improvement, i) => (
                    <li key={i} className="text-sm text-white/85 flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>{formatText(improvement)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60 font-semibold mb-2">📝 Overall Feedback:</div>
              <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{formatText(evaluation.writing.feedback)}</div>
            </div>
          </div>
        )}

        {activeSection === "speaking" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🗣️</span>
              <div className="text-sm font-semibold text-white/90">Speaking Feedback</div>
            </div>
            
            {evaluation.speaking.original && (
              <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-3">
                <div className="text-xs text-red-300 font-semibold mb-2">❌ Your Original:</div>
                <div className="text-sm text-white/85 leading-relaxed">{formatText(evaluation.speaking.original)}</div>
              </div>
            )}
            
            {evaluation.speaking.corrected && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                <div className="text-xs text-emerald-300 font-semibold mb-2">✅ Corrected Version:</div>
                <div className="text-sm text-white/85 leading-relaxed">{formatText(evaluation.speaking.corrected)}</div>
              </div>
            )}
            
            {evaluation.speaking.issues && evaluation.speaking.issues.length > 0 && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                <div className="text-xs text-amber-300 font-semibold mb-2">🔍 Issues Found:</div>
                <ul className="space-y-1">
                  {evaluation.speaking.issues.map((issue, i) => (
                    <li key={i} className="text-sm text-white/85 flex gap-2">
                      <span className="text-amber-400">•</span>
                      <span>{formatText(issue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {evaluation.speaking.improvements && evaluation.speaking.improvements.length > 0 && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
                <div className="text-xs text-blue-300 font-semibold mb-2">💡 Improvements:</div>
                <ul className="space-y-1">
                  {evaluation.speaking.improvements.map((improvement, i) => (
                    <li key={i} className="text-sm text-white/85 flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>{formatText(improvement)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60 font-semibold mb-2">📝 Overall Feedback:</div>
              <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{formatText(evaluation.speaking.feedback)}</div>
            </div>
          </div>
        )}

        {activeSection === "conversation" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💬</span>
              <div className="text-sm font-semibold text-white/90">Conversation Feedback</div>
            </div>
            
            {evaluation.conversation.original && (
              <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-3">
                <div className="text-xs text-red-300 font-semibold mb-2">❌ Your Original:</div>
                <div className="text-sm text-white/85 leading-relaxed whitespace-pre-line">{formatText(evaluation.conversation.original)}</div>
              </div>
            )}
            
            {evaluation.conversation.corrected && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                <div className="text-xs text-emerald-300 font-semibold mb-2">✅ Corrected Version:</div>
                <div className="text-sm text-white/85 leading-relaxed whitespace-pre-line">{formatText(evaluation.conversation.corrected)}</div>
              </div>
            )}
            
            {evaluation.conversation.issues && evaluation.conversation.issues.length > 0 && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                <div className="text-xs text-amber-300 font-semibold mb-2">🔍 Issues Found:</div>
                <ul className="space-y-1">
                  {evaluation.conversation.issues.map((issue, i) => (
                    <li key={i} className="text-sm text-white/85 flex gap-2">
                      <span className="text-amber-400">•</span>
                      <span>{formatText(issue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {evaluation.conversation.improvements && evaluation.conversation.improvements.length > 0 && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
                <div className="text-xs text-blue-300 font-semibold mb-2">💡 Improvements:</div>
                <ul className="space-y-1">
                  {evaluation.conversation.improvements.map((improvement, i) => (
                    <li key={i} className="text-sm text-white/85 flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>{formatText(improvement)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60 font-semibold mb-2">📝 Overall Feedback:</div>
              <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{formatText(evaluation.conversation.feedback)}</div>
            </div>
          </div>
        )}

        {activeSection === "mistakes" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚠️</span>
              <div className="text-sm font-semibold text-white/90">Common Mistakes</div>
            </div>
            {evaluation.commonMistakesTop3 && evaluation.commonMistakesTop3.length > 0 ? (
              <div className="space-y-3">
                {evaluation.commonMistakesTop3.map((item, i) => (
                  <div key={i} className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500/20 text-rose-200 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="text-xs font-semibold text-rose-200">Common Mistake</div>
                    </div>
                    <div className="text-sm text-rose-100 leading-relaxed font-medium">{formatText(item.mistake)}</div>
                    
                    {item.example && (
                      <div className="rounded border border-red-400/30 bg-red-500/10 p-2">
                        <div className="text-xs font-semibold text-red-200 mb-1">❌ Your Example:</div>
                        <div className="text-sm text-red-100 leading-relaxed">{formatText(item.example)}</div>
                      </div>
                    )}
                    
                    {item.correction && (
                      <div className="rounded border border-green-400/30 bg-green-500/10 p-2">
                        <div className="text-xs font-semibold text-green-200 mb-1">✅ Correction:</div>
                        <div className="text-sm text-green-100 leading-relaxed">{formatText(item.correction)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/60 text-center py-4">No common mistakes identified.</div>
            )}
            {evaluation.weakAreas && evaluation.weakAreas.length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="text-xs font-semibold text-white/70 mb-2">Weak Areas to Focus On:</div>
                <div className="flex flex-wrap gap-1.5">
                  {evaluation.weakAreas.map((area, i) => (
                    <span key={i} className="px-2 py-1 rounded-full text-xs bg-orange-500/15 text-orange-200 border border-orange-400/30">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "summary" && evaluation.todaySummary && (
          <LearningSummaryContent summary={evaluation.todaySummary} />
        )}

        {activeSection === "hindi" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🇮🇳</span>
              <div className="text-sm font-semibold text-white/90">Hindi to English Translation</div>
              {evaluation.hindiTranslation && evaluation.hindiTranslation.scorePercent !== undefined && (
                <div className="ml-auto text-sm text-white/70">Score: {Math.round(evaluation.hindiTranslation.scorePercent)}%</div>
              )}
            </div>
            
            {(() => {
              // Debug logging
              console.log('🔍 FRONTEND DEBUG: hindiTranslation exists?', !!evaluation.hindiTranslation);
              console.log('🔍 FRONTEND DEBUG: hindiTranslation.answers exists?', !!evaluation.hindiTranslation?.answers);
              console.log('🔍 FRONTEND DEBUG: hindiTranslation.answers length:', evaluation.hindiTranslation?.answers?.length);
              if (evaluation.hindiTranslation?.answers && evaluation.hindiTranslation.answers.length > 0) {
                console.log('🔍 FRONTEND DEBUG: First 3 answers:', evaluation.hindiTranslation.answers.slice(0, 3));
              }
              return null;
            })()}
            
            {evaluation.hindiTranslation && evaluation.hindiTranslation.answers && evaluation.hindiTranslation.answers.length > 0 ? (
              <div className="space-y-2.5">
                {evaluation.hindiTranslation.answers.map((answer) => {
                  const hasDetailedFeedback = answer.original || answer.correctVersion || answer.errorReason || answer.feedback;
                  
                  return (
                    <div key={answer.k} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-bold flex items-center justify-center">
                          {answer.k}
                        </div>
                        <div className={cn(
                          "text-xs font-semibold px-2.5 py-0.5 rounded whitespace-nowrap",
                          answer.correctness === "Correct" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30" :
                          answer.correctness === "Partially Correct" ? "bg-amber-500/20 text-amber-200 border border-amber-400/30" :
                          "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                        )}>
                          {answer.correctness}
                        </div>
                      </div>
                      
                      {!hasDetailedFeedback && (
                        <div className="text-xs text-white/50 italic">
                          Detailed feedback not available for this evaluation. Submit again to get full feedback.
                        </div>
                      )}
                      
                      {answer.original && (
                        <div className="rounded-lg bg-red-500/10 border border-red-400/20 p-2 mb-2">
                          <div className="text-xs font-semibold text-red-200 mb-1">❌ Your Translation:</div>
                          <div className="text-sm text-red-100 leading-relaxed">{formatText(answer.original)}</div>
                        </div>
                      )}
                      
                      {answer.correctVersion && answer.correctness !== "Correct" && (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 p-2 mb-2">
                          <div className="text-xs font-semibold text-emerald-200 mb-1">✅ Correct Translation:</div>
                          <div className="text-sm text-emerald-100 leading-relaxed">{formatText(answer.correctVersion)}</div>
                        </div>
                      )}
                      
                      {answer.errorReason && answer.errorReason !== "N/A" && answer.errorReason !== "—" && answer.errorReason.trim() !== "" && (
                        <div className="rounded-lg bg-white/5 border border-white/10 p-2 mb-2">
                          <div className="text-xs font-semibold text-white/90 mb-1">Reason:</div>
                          <div className="text-sm text-white/75 leading-relaxed">{formatText(answer.errorReason)}</div>
                        </div>
                      )}
                      
                      {answer.feedback && answer.feedback !== "N/A" && answer.feedback !== "—" && answer.feedback.trim() !== "" && (
                        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span>💡</span>
                            <div className="text-xs font-semibold text-amber-200">Tip:</div>
                          </div>
                          <div className="text-sm text-amber-100 leading-relaxed">{formatText(answer.feedback)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                <div className="text-sm text-white/60">
                  {evaluation.hindiTranslation && evaluation.hindiTranslation.scorePercent !== undefined 
                    ? `Hindi translations were evaluated with a score of ${Math.round(evaluation.hindiTranslation.scorePercent)}%, but detailed feedback is not available for this evaluation.`
                    : "No Hindi translation results available."}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "questions" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">❓</span>
              <div className="text-sm font-semibold text-white/90">Questions</div>
              {evaluation.questions && evaluation.questions.scorePercent !== undefined && (
                <div className="ml-auto text-sm text-white/70">Score: {Math.round(evaluation.questions.scorePercent)}%</div>
              )}
            </div>
            
            {(() => {
              // Debug logging
              console.log('🔍 FRONTEND DEBUG: questions exists?', !!evaluation.questions);
              console.log('🔍 FRONTEND DEBUG: questions.answers exists?', !!evaluation.questions?.answers);
              console.log('🔍 FRONTEND DEBUG: questions.answers length:', evaluation.questions?.answers?.length);
              if (evaluation.questions?.answers && evaluation.questions.answers.length > 0) {
                console.log('🔍 FRONTEND DEBUG: First 3 question answers:', evaluation.questions.answers.slice(0, 3));
              }
              return null;
            })()}
            
            {evaluation.questions && evaluation.questions.answers && evaluation.questions.answers.length > 0 ? (
              <div className="space-y-2.5">
                {evaluation.questions.answers.map((answer) => {
                  const hasDetailedFeedback = answer.original || answer.correctVersion || answer.errorReason || answer.feedback;
                  
                  return (
                    <div key={answer.k} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-bold flex items-center justify-center">
                          {answer.k}
                        </div>
                        <div className={cn(
                          "text-xs font-semibold px-2.5 py-0.5 rounded whitespace-nowrap",
                          answer.correctness === "Correct" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30" :
                          answer.correctness === "Partially Correct" ? "bg-amber-500/20 text-amber-200 border border-amber-400/30" :
                          "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                        )}>
                          {answer.correctness}
                        </div>
                      </div>
                      
                      {!hasDetailedFeedback && (
                        <div className="text-xs text-white/50 italic">
                          Detailed feedback not available for this evaluation. Submit again to get full feedback.
                        </div>
                      )}
                      
                      {answer.original && (
                        <div className="rounded-lg bg-red-500/10 border border-red-400/20 p-2 mb-2">
                          <div className="text-xs font-semibold text-red-200 mb-1">❌ Your Answer:</div>
                          <div className="text-sm text-red-100 leading-relaxed">{formatText(answer.original)}</div>
                        </div>
                      )}
                      
                      {answer.correctVersion && answer.correctness !== "Correct" && (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 p-2 mb-2">
                          <div className="text-xs font-semibold text-emerald-200 mb-1">✅ Correct Answer:</div>
                          <div className="text-sm text-emerald-100 leading-relaxed">{formatText(answer.correctVersion)}</div>
                        </div>
                      )}
                      
                      {answer.errorReason && answer.errorReason !== "N/A" && answer.errorReason !== "—" && answer.errorReason.trim() !== "" && (
                        <div className="rounded-lg bg-white/5 border border-white/10 p-2 mb-2">
                          <div className="text-xs font-semibold text-white/90 mb-1">Reason:</div>
                          <div className="text-sm text-white/75 leading-relaxed">{formatText(answer.errorReason)}</div>
                        </div>
                      )}
                      
                      {answer.feedback && answer.feedback !== "N/A" && answer.feedback !== "—" && answer.feedback.trim() !== "" && (
                        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span>💡</span>
                            <div className="text-xs font-semibold text-amber-200">Feedback:</div>
                          </div>
                          <div className="text-sm text-amber-100 leading-relaxed">{formatText(answer.feedback)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                <div className="text-sm text-white/60">
                  {evaluation.questions && evaluation.questions.scorePercent !== undefined 
                    ? `Questions were evaluated with a score of ${Math.round(evaluation.questions.scorePercent)}%, but detailed feedback is not available for this evaluation.`
                    : "No question results available."}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "sentences" && (
          <>
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-base sm:text-lg">📝</span>
                <div className="text-xs sm:text-sm font-semibold text-white/90">Sentence Corrections</div>
              </div>
              
              {/* Filter buttons on the right */}
              <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
                {(["All", "Correct", "Partial", "Incorrect"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "rounded border px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-xs font-semibold transition-colors whitespace-nowrap",
                      tab === t ? "border-indigo-400/50 bg-indigo-400/15 text-indigo-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[350px] overflow-auto pr-1">
              <div className="grid gap-2.5">
                {filtered.map((s) => (
                  <div key={s.k}>
                    <button
                      type="button"
                      onClick={() => setSelectedK(selectedK === s.k ? null : s.k)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left transition-all",
                        selectedK === s.k ? "border-indigo-400/60 bg-indigo-400/10 shadow-lg shadow-indigo-500/10" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Number on the left */}
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-bold flex items-center justify-center">
                          {s.k}
                        </div>
                        
                        {/* Sentence text in the middle */}
                        <div className="flex-1 text-sm text-white/80 leading-relaxed">
                          {formatText(s.original || "No original text")}
                        </div>
                        
                        {/* Badges on the right */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className={cn(
                            "text-xs font-semibold px-2.5 py-0.5 rounded whitespace-nowrap",
                            s.correctness === "Correct" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30" :
                            s.correctness === "Partially Correct" ? "bg-amber-500/20 text-amber-200 border border-amber-400/30" :
                            "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                          )}>
                            {s.correctness}
                          </div>
                          {s.errorType && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-200 border border-purple-400/30 whitespace-nowrap">
                              {s.errorType}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    
                    {selectedK === s.k && (
                      <div className="mt-2 rounded-lg border border-indigo-400/30 bg-gradient-to-br from-indigo-500/20 to-purple-500/15 p-2.5 shadow-lg">
                        <div className="space-y-2 text-[11px]">
                          <div className="rounded-lg bg-black/20 p-2">
                            <div className="font-semibold text-white/90 mb-0.5">Original:</div>
                            <div className="text-white/75 leading-relaxed">{formatText(s.original || "No original text")}</div>
                          </div>
                          <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 p-2">
                            <div className="font-semibold text-emerald-200 mb-0.5">Correct:</div>
                            <div className="text-emerald-100 leading-relaxed">{formatText(s.correctVersion || "No correction available")}</div>
                          </div>
                          {s.errorReason && s.errorReason !== "N/A" && s.errorReason !== "—" && s.errorReason.trim() !== "" && (
                            <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                              <div className="font-semibold text-white/90 mb-0.5">Reason:</div>
                              <div className="text-white/75 leading-relaxed">{formatText(s.errorReason)}</div>
                            </div>
                          )}
                          {s.penalties && s.penalties.total && s.penalties.total > 0 && (
                            <div className="rounded-lg bg-rose-500/10 border border-rose-400/20 p-2">
                              <div className="font-semibold text-rose-200 mb-1">Penalties Applied: -{s.penalties.total}%</div>
                              <div className="space-y-0.5 text-rose-100">
                                {s.penalties.capitalization && <div>• Capitalization: -{s.penalties.capitalization}%</div>}
                                {s.penalties.punctuation && <div>• Punctuation: -{s.penalties.punctuation}%</div>}
                                {s.penalties.spelling && <div>• Spelling: -{s.penalties.spelling}%</div>}
                                {s.penalties.grammar && <div>• Grammar: -{s.penalties.grammar}%</div>}
                              </div>
                            </div>
                          )}
                          {s.tip && (
                            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span>💡</span>
                                <div className="font-semibold text-amber-200">Tip:</div>
                              </div>
                              <div className="text-amber-100 leading-relaxed">{formatText(s.tip)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Content component for Today's Learning Summary (used inside tab)
function LearningSummaryContent({ summary }: { summary: NonNullable<Evaluation['todaySummary']> }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['quickRecap']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* Header Info */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-2xl">📚</span>
        <div>
          <div className="text-base font-bold text-indigo-100">{summary.topic}</div>
          {summary.levelLabel && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
              {summary.levelLabel} • Day {summary.dayNumber}
            </span>
          )}
        </div>
      </div>

      {/* Quick Recap - Always visible by default */}
      {summary.quickRecap && summary.quickRecap.length > 0 && (
          <div className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 overflow-hidden">
            <button
              onClick={() => toggleSection('quickRecap')}
              className="w-full flex items-center justify-between p-3 hover:bg-cyan-500/10 transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="text-sm font-semibold text-cyan-200">Quick Recap</span>
              </div>
              <span className="text-cyan-300">{expandedSections.has('quickRecap') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('quickRecap') && (
              <div className="px-3 pb-3">
                <ul className="space-y-2">
                  {summary.quickRecap.map((recap, i) => (
                    <li key={i} className="text-sm text-cyan-100 flex items-start gap-2.5">
                      <span className="text-cyan-300 flex-shrink-0 font-bold">•</span>
                      <span className="leading-relaxed">{formatText(recap)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Topic Notes / Revision Notes */}
        {summary.topicNotes && (
          <div className="rounded-lg border border-purple-400/40 bg-purple-500/15 overflow-hidden">
            <button
              onClick={() => toggleSection('topicNotes')}
              className="w-full flex items-center justify-between p-3 hover:bg-purple-500/10 transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <span className="text-sm font-semibold text-purple-200">Revision Notes</span>
              </div>
              <span className="text-purple-300">{expandedSections.has('topicNotes') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('topicNotes') && (
              <div className="px-3 pb-3">
                <div className="text-sm text-purple-100 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {formatText(summary.topicNotes)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grammar Summary */}
        {summary.grammarSummary && (
          <div className="rounded-lg border border-indigo-400/40 bg-indigo-500/15 overflow-hidden">
            <button
              onClick={() => toggleSection('grammarSummary')}
              className="w-full flex items-center justify-between p-3 hover:bg-indigo-500/10 transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📖</span>
                <span className="text-sm font-semibold text-indigo-200">Grammar Summary</span>
              </div>
              <span className="text-indigo-300">{expandedSections.has('grammarSummary') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('grammarSummary') && (
              <div className="px-3 pb-3">
                <div className="text-sm text-indigo-100 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {formatText(summary.grammarSummary)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Key Grammar Points */}
        {summary.keyGrammarPoints && summary.keyGrammarPoints.length > 0 && (
          <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 overflow-hidden">
            <button
              onClick={() => toggleSection('grammarPoints')}
              className="w-full flex items-center justify-between p-3 hover:bg-emerald-500/10 transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">✓</span>
                <span className="text-sm font-semibold text-emerald-200">Key Grammar Points</span>
              </div>
              <span className="text-emerald-300">{expandedSections.has('grammarPoints') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('grammarPoints') && (
              <div className="px-3 pb-3">
                <ul className="space-y-2">
                  {summary.keyGrammarPoints.map((point, i) => (
                    <li key={i} className="text-sm text-emerald-100 flex items-start gap-2.5">
                      <span className="text-emerald-300 flex-shrink-0">→</span>
                      <span className="leading-relaxed">{formatText(point)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Vocabulary Flashcards */}
        {summary.keyVocabulary && summary.keyVocabulary.length > 0 && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/15 overflow-hidden">
            <button
              onClick={() => toggleSection('vocabulary')}
              className="w-full flex items-center justify-between p-3 hover:bg-amber-500/10 transition-colors"
              type="button"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📚</span>
                <span className="text-sm font-semibold text-amber-200">Vocabulary Flashcards</span>
                <span className="text-xs text-amber-300/80">({summary.keyVocabulary.length} words)</span>
              </div>
              <span className="text-amber-300">{expandedSections.has('vocabulary') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('vocabulary') && (
              <div className="px-3 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {summary.keyVocabulary.map((vocab, i) => (
                    <div key={i} className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-bold text-amber-100 text-sm">{vocab.word}</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-200 border border-amber-400/40">
                          {vocab.partOfSpeech}
                        </span>
                      </div>
                      <div className="text-amber-100/80 text-xs mb-1.5">{formatText(vocab.meaning)}</div>
                      <div className="text-amber-200/70 italic text-xs border-l-2 border-amber-400/30 pl-2">
                        "{formatText(vocab.exampleUse)}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Topic Usage Tip */}
        {summary.topicUsageTip && (
          <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/15 p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">💡</span>
              <div>
                <div className="text-sm font-semibold text-yellow-200 mb-1">Real-life Tip:</div>
                <div className="text-sm text-yellow-100 leading-relaxed">{formatText(summary.topicUsageTip)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Review Reminder */}
        {summary.reviewReminder && (
          <div className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">📌</span>
              <div>
                <div className="text-sm font-semibold text-cyan-200 mb-1">Review Reminder:</div>
                <div className="text-sm text-cyan-100 leading-relaxed">{formatText(summary.reviewReminder)}</div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
