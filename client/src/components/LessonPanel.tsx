import { useMemo, useState } from "react";
import type { DayContent, DayProgress } from "../lib/types";

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

const SECTIONS = [
  ["warmup", "Warm-up"],
  ["grammar", "Grammar"],
  ["pronunciation", "Pronunciation"],
  ["vocabulary", "Vocabulary"],
  ["listening", "Listening"],
  ["coreTasks", "Core Tasks"],
  ["sentences", "Sentences"],
  ["questions", "Questions"],
] as const;

export function LessonPanel({
  day,
  dayProgress,
  onToggleSectionDone,
}: {
  day: DayContent;
  dayProgress: DayProgress | null;
  onToggleSectionDone: (sectionId: string, done: boolean) => void;
}) {
  const [openSection, setOpenSection] = useState<string>("warmup");
  const doneMap = dayProgress?.sectionsRead || {};
  const doneCount = dayProgress?.sectionsReadCount || 0;
  const progressPct = dayProgress?.readPercentage || 0;
  const qCount = day.submissionTemplate?.questionCount ?? 4;
  const sentenceCount = day.submissionTemplate?.sentenceCount ?? 20;

  const isValidContent = (text: string) => {
    if (!text) return false;
    const cleaned = text.trim();
    if (!cleaned) return false;
    if (cleaned === "—" || cleaned === "-" || cleaned === "–") return false;
    if (cleaned.startsWith("—") && cleaned.length < 5) return false;
    return true;
  };

  const contentBySection = useMemo(
    () => ({
      warmup: (day.warmUpCorrections || [])
        .filter((x) => isValidContent(x.wrong) && isValidContent(x.correct))
        .map((x, i) => {
          const base = `${i + 1}. ${x.wrong} → ${x.correct}`;
          return (x as any).explanation && isValidContent((x as any).explanation) 
            ? `${base}\n   ${(x as any).explanation}` 
            : base;
        })
        .join("\n\n") || "No warm-up corrections available.",
      grammar: [day.grammarExplanationText, day.sentenceFormationText]
        .filter(isValidContent)
        .join("\n\n") || "Grammar content not available.",
      pronunciation: (() => {
        const words = (day.pronunciation?.words || [])
          .filter((w) => isValidContent(w.word) && isValidContent(w.ipa))
          .map((w) => {
            // Clean IPA: remove extra slashes
            const cleanIpa = w.ipa.replace(/^\/+|\/+$/g, '');
            let line = `${w.word} /${cleanIpa}/`;
            if (w.mis && isValidContent(w.mis)) {
              line += `\n  ❌ ${w.mis}`;
            }
            if (w.correct && isValidContent(w.correct)) {
              line += `\n  ✓ ${w.correct}`;
            }
            return line;
          });
        
        const parts = [day.pronunciation?.title, ...words].filter(isValidContent);
        
        // If no words but has focus/tips (Gemini sometimes returns this structure)
        if (parts.length === 0 && day.pronunciation) {
          const pronAny = day.pronunciation as any;
          if (pronAny.focus || pronAny.tips) {
            const focusParts = [];
            if (isValidContent(pronAny.focus)) focusParts.push(`Focus: ${pronAny.focus}`);
            if (isValidContent(pronAny.tips)) focusParts.push(`Tips: ${pronAny.tips}`);
            return focusParts.join("\n\n") || "Pronunciation content not available.";
          }
        }
        
        return parts.join("\n\n") || "Pronunciation content not available.";
      })(),
      vocabulary: (day.vocabAndTracks?.wordOfDay || [])
        .filter((w) => isValidContent(w.word) && (isValidContent(w.definition) || isValidContent(w.example)))
        .map((w) => `${w.word}: ${w.definition}${w.example ? `\n   Example: ${w.example}` : ''}`)
        .join("\n\n") || "Vocabulary content not available.",
      listening: [
        day.listening?.transcript,
        ...(day.listening?.questions || [])
          .filter((q) => isValidContent(q.prompt))
          .map((q) => `${q.idx}. ${q.prompt}`)
      ].filter(isValidContent).join("\n\n") || "Listening content not available.",
      coreTasks: [
        day.speakingTask?.prompt && isValidContent(day.speakingTask.prompt) ? `Speaking: ${day.speakingTask.prompt}` : null,
        day.writingTask?.prompt && isValidContent(day.writingTask.prompt) ? `Writing: ${day.writingTask.prompt}` : null,
        day.conversationTask?.prompt && isValidContent(day.conversationTask.prompt) ? `Conversation: ${day.conversationTask.prompt}` : null,
      ].filter(Boolean).join("\n\n") || "Core tasks not available.",
      sentences: (day.sentencePractice?.items || [])
        .filter((s) => isValidContent(s.prompt))
        .map((s) => `${s.k}. ${s.prompt}`)
        .join("\n") || "Sentence prompts not available.",
      questions: (day.questions?.items || [])
        .slice(0, qCount)
        .filter((q) => isValidContent(q.prompt))
        .map((q) => `${q.idx}. ${q.prompt}`)
        .join("\n") || "Questions not available.",
    }),
    [day, qCount]
  );

  return (
    <div className="space-y-2">
      {/* Compact header with progress */}
      <div className="sticky top-0 z-10 bg-[#0a0e1a] pb-2">
        {/* Progress card - more compact */}
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-2 mb-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-[10px] sm:text-xs text-white/70 truncate flex-1">
              Day {day.dayNumber} - {day.dayTheme}
            </div>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-white/60 flex-shrink-0">
              <span className="font-semibold">{doneCount}/8</span>
              <span className="text-white/40">|</span>
              <span>Unlock: {doneCount}/{dayProgress?.requiredSections || 5}</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-white/10">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        
        {/* Section tabs - horizontal scroll */}
        <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-2">
          {SECTIONS.map(([id, label], idx) => (
            <button
              key={id}
              onClick={() => setOpenSection(id)}
              className={cn(
                "rounded-lg border px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0 transition-all",
                openSection === id 
                  ? "border-indigo-400/60 bg-indigo-500/20 text-white font-semibold" 
                  : doneMap[id] 
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" 
                    : "border-white/10 bg-white/5 text-white/70"
              )}
              type="button"
            >
              <span className="inline sm:hidden">{doneMap[id] ? "✓" : idx + 1}</span>
              <span className="hidden sm:inline">{doneMap[id] ? "✓" : idx + 1}. {label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
        <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-semibold text-white capitalize">{openSection}</div>
          <button
            type="button"
            onClick={() => onToggleSectionDone(openSection, !doneMap[openSection])}
            className="rounded border border-white/20 px-2 sm:px-3 py-1 text-[10px] sm:text-xs text-white hover:bg-white/10 transition-colors"
          >
            {doneMap[openSection] ? "✓ Done" : "Mark Done"}
          </button>
        </div>
        
        {openSection === "pronunciation" ? (
          <div className="space-y-4">
            {(() => {
              console.log('🔍 CLIENT: Pronunciation data:', day.pronunciation);
              console.log('🔍 CLIENT: Pronunciation words:', day.pronunciation?.words);
              console.log('🔍 CLIENT: Filtered words:', (day.pronunciation?.words || []).filter((w) => isValidContent(w.word) && isValidContent(w.ipa)));
              return null;
            })()}
            {day.pronunciation?.title && (
              <div className="text-sm font-medium text-white/90">{day.pronunciation.title}</div>
            )}
            {(day.pronunciation?.words || [])
              .filter((w) => isValidContent(w.word) && isValidContent(w.ipa))
              .map((w, i) => {
                console.log(`🔍 CLIENT: Rendering pronunciation word ${i}:`, w);
                const cleanIpa = w.ipa.replace(/^\/+|\/+$/g, '');
                return (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-base font-semibold text-indigo-300">
                      {w.word} <span className="text-sm text-white/60">/{cleanIpa}/</span>
                    </div>
                    {w.mis && isValidContent(w.mis) && (
                      <div className="mt-2 flex gap-2 text-sm text-red-300">
                        <span>❌</span>
                        <span>{w.mis}</span>
                      </div>
                    )}
                    {w.correct && isValidContent(w.correct) && (
                      <div className="mt-1 flex gap-2 text-sm text-emerald-300">
                        <span>✓</span>
                        <span>{w.correct}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            {(day.pronunciation?.words || []).filter((w) => isValidContent(w.word) && isValidContent(w.ipa)).length === 0 && (
              <div className="text-sm text-white/60">Pronunciation content not available.</div>
            )}
          </div>
        ) : openSection === "warmup" ? (
          <div className="space-y-3">
            {(day.warmUpCorrections || [])
              .filter((x) => isValidContent(x.wrong) && isValidContent(x.correct))
              .map((x, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-white/50">{i + 1}.</span>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-red-300">
                        <span>❌</span>
                        <span>{x.wrong}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-emerald-300">
                        <span>✓</span>
                        <span>{x.correct}</span>
                      </div>
                      {(x as any).explanation && isValidContent((x as any).explanation) && (
                        <div className="text-xs text-white/60 italic pl-6">{(x as any).explanation}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {(day.warmUpCorrections || []).filter((x) => isValidContent(x.wrong) && isValidContent(x.correct)).length === 0 && (
              <div className="text-sm text-white/60">No warm-up corrections available.</div>
            )}
          </div>
        ) : openSection === "vocabulary" ? (
          <div className="space-y-3">
            {(day.vocabAndTracks?.wordOfDay || [])
              .filter((w) => isValidContent(w.word) && (isValidContent(w.definition) || isValidContent(w.example)))
              .map((w, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-base font-semibold text-indigo-300">{w.word}</div>
                  {w.pos && isValidContent(w.pos) && (
                    <div className="text-xs text-white/50 italic">{w.pos}</div>
                  )}
                  {w.definition && isValidContent(w.definition) && (
                    <div className="mt-2 text-sm text-white/85">{w.definition}</div>
                  )}
                  {w.example && isValidContent(w.example) && (
                    <div className="mt-2 text-sm text-emerald-300/80 italic">
                      <span className="text-white/50">Example:</span> {w.example}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3 text-xs">
                    {w.synonym && isValidContent(w.synonym) && (
                      <span className="text-blue-300">Synonym: {w.synonym}</span>
                    )}
                    {w.antonym && isValidContent(w.antonym) && (
                      <span className="text-orange-300">Antonym: {w.antonym}</span>
                    )}
                  </div>
                </div>
              ))}
            {(day.vocabAndTracks?.wordOfDay || []).filter((w) => isValidContent(w.word) && (isValidContent(w.definition) || isValidContent(w.example))).length === 0 && (
              <div className="text-sm text-white/60">Vocabulary content not available.</div>
            )}
          </div>
        ) : openSection === "sentences" ? (
          <div className="space-y-2">
            {(day.sentencePractice?.items || [])
              .filter((s) => isValidContent(s.prompt))
              .map((s) => (
                <div key={s.k} className="rounded-lg border border-white/10 bg-white/5 p-3 flex gap-3">
                  <span className="text-white/50 font-mono">{s.k}.</span>
                  <span className="text-sm text-white/85">{s.prompt}</span>
                </div>
              ))}
            {(day.sentencePractice?.items || []).filter((s) => isValidContent(s.prompt)).length === 0 && (
              <div className="text-sm text-white/60">Sentence prompts not available.</div>
            )}
            <div className="mt-2 text-xs text-white/50">{sentenceCount} prompts</div>
          </div>
        ) : openSection === "questions" ? (
          <div className="space-y-2">
            {(day.questions?.items || [])
              .slice(0, qCount)
              .filter((q) => isValidContent(q.prompt))
              .map((q) => (
                <div key={q.idx} className="rounded-lg border border-white/10 bg-white/5 p-3 flex gap-3">
                  <span className="text-white/50 font-mono">{q.idx}.</span>
                  <span className="text-sm text-white/85">{q.prompt}</span>
                </div>
              ))}
            {(day.questions?.items || []).slice(0, qCount).filter((q) => isValidContent(q.prompt)).length === 0 && (
              <div className="text-sm text-white/60">Questions not available.</div>
            )}
          </div>
        ) : openSection === "listening" ? (
          <div className="space-y-4">
            {day.listening?.title && isValidContent(day.listening.title) && (
              <div className="text-sm font-medium text-indigo-300">{day.listening.title}</div>
            )}
            {day.listening?.transcript && isValidContent(day.listening.transcript) && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50 mb-3">📝 Transcript:</div>
                <div className="text-sm text-white/85 leading-loose space-y-2">
                  {day.listening.transcript.split('. ').filter(s => s.trim()).map((sentence, i) => (
                    <p key={i}>{sentence.trim()}{i < day.listening.transcript.split('. ').filter(s => s.trim()).length - 1 ? '.' : ''}</p>
                  ))}
                </div>
              </div>
            )}
            {(day.listening?.questions || []).filter((q) => isValidContent(q.prompt)).length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-white/50 font-semibold">❓ Questions:</div>
                {(day.listening?.questions || [])
                  .filter((q) => isValidContent(q.prompt))
                  .map((q) => (
                    <div key={q.idx} className="rounded-lg border border-white/10 bg-white/5 p-3 flex gap-3">
                      <span className="text-white/50 font-mono">{q.idx}.</span>
                      <span className="text-sm text-white/85">{q.prompt}</span>
                    </div>
                  ))}
              </div>
            )}
            {!day.listening?.transcript && (day.listening?.questions || []).filter((q) => isValidContent(q.prompt)).length === 0 && (
              <div className="text-sm text-white/60">Listening content not available.</div>
            )}
          </div>
        ) : openSection === "coreTasks" ? (
          <div className="space-y-3">
            {day.speakingTask?.prompt && isValidContent(day.speakingTask.prompt) && (
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                <div className="text-xs text-emerald-300 font-semibold mb-2">🎤 Speaking Task</div>
                <div className="text-sm text-white/85">{formatText(day.speakingTask.prompt)}</div>
              </div>
            )}
            {day.writingTask?.prompt && isValidContent(day.writingTask.prompt) && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
                <div className="text-xs text-blue-300 font-semibold mb-2">✍️ Writing Task</div>
                <div className="text-sm text-white/85">{formatText(day.writingTask.prompt)}</div>
                {day.writingTask.requiredIdiom && isValidContent(day.writingTask.requiredIdiom) && (
                  <div className="mt-2 text-xs text-white/60">Required idiom: {formatText(day.writingTask.requiredIdiom)}</div>
                )}
                {day.writingTask.requiredPhrasal && isValidContent(day.writingTask.requiredPhrasal) && (
                  <div className="text-xs text-white/60">Required phrasal: {formatText(day.writingTask.requiredPhrasal)}</div>
                )}
              </div>
            )}
            {day.conversationTask?.prompt && isValidContent(day.conversationTask.prompt) && (
              <div className="rounded-lg border border-purple-400/20 bg-purple-500/10 p-3">
                <div className="text-xs text-purple-300 font-semibold mb-2">💬 Conversation Task</div>
                <div className="text-sm text-white/85">{formatText(day.conversationTask.prompt)}</div>
              </div>
            )}
            {!day.speakingTask?.prompt && !day.writingTask?.prompt && !day.conversationTask?.prompt && (
              <div className="text-sm text-white/60">Core tasks not available.</div>
            )}
          </div>
        ) : openSection === "grammar" ? (
          <div className="space-y-4">
            {day.grammarExplanationText && isValidContent(day.grammarExplanationText) && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-indigo-300 font-semibold mb-3">📚 Grammar Explanation</div>
                <div className="text-sm text-white/85 leading-loose space-y-2">
                  {day.grammarExplanationText.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} className="h-1" />;
                    
                    // Check if it's a heading (starts with ** and ends with **)
                    const isHeading = trimmed.startsWith('**') && trimmed.endsWith('**');
                    if (isHeading) {
                      const headingText = trimmed.slice(2, -2);
                      return <div key={i} className="font-semibold text-indigo-200 mt-2 mb-1">{formatText(headingText)}</div>;
                    }
                    
                    // Check if it's a bullet point
                    if (trimmed.startsWith('*') || trimmed.startsWith('•')) {
                      const bulletText = trimmed.replace(/^[*•]\s*/, '');
                      return (
                        <div key={i} className="flex gap-2 pl-2 leading-relaxed">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span className="flex-1">{formatText(bulletText)}</span>
                        </div>
                      );
                    }
                    
                    return <p key={i} className="leading-relaxed">{formatText(trimmed)}</p>;
                  })}
                </div>
              </div>
            )}
            {day.sentenceFormationText && isValidContent(day.sentenceFormationText) && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-emerald-300 font-semibold mb-3">✏️ Sentence Formation</div>
                <div className="text-sm text-white/85 leading-loose space-y-2">
                  {day.sentenceFormationText.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} className="h-1" />;
                    
                    const isHeading = trimmed.startsWith('**') && trimmed.endsWith('**');
                    
                    if (isHeading) {
                      const headingText = trimmed.slice(2, -2);
                      return <div key={i} className="font-semibold text-emerald-200 mt-2 mb-1">{formatText(headingText)}</div>;
                    }
                    
                    if (trimmed.startsWith('*') || trimmed.startsWith('•')) {
                      const bulletText = trimmed.replace(/^[*•]\s*/, '');
                      return (
                        <div key={i} className="flex gap-2 pl-2 leading-relaxed">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span className="flex-1">{formatText(bulletText)}</span>
                        </div>
                      );
                    }
                    
                    return <p key={i} className="leading-relaxed">{formatText(trimmed)}</p>;
                  })}
                </div>
              </div>
            )}
            {!day.grammarExplanationText && !day.sentenceFormationText && (
              <div className="text-sm text-white/60">Grammar content not available.</div>
            )}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-white/85">
            {contentBySection[openSection as keyof typeof contentBySection]}
          </pre>
        )}
        
        {openSection === "sentences" && <div className="mt-2 text-xs text-white/50">{sentenceCount} prompts</div>}
      </div>
    </div>
  );
}
