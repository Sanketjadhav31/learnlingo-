import { useState, useEffect, useCallback, useRef } from "react";
import type { DayContent } from "../lib/types";
import { saveDraft } from "../lib/api";

// Helper function to format prompt text - convert markdown to styled spans
function formatPromptText(text: string): React.ReactNode {
  if (!text) return text;
  
  // Split by ** to find bold sections
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          // Remove ** and make it bold/highlighted
          const boldText = part.slice(2, -2);
          return (
            <span key={i} className="font-semibold text-amber-200 bg-amber-500/10 px-1 rounded">
              {boldText}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

type SubmissionData = {
  writing: string;
  speaking: string;
  conversation: string[];
  sentences: string[];
  hindiTranslation: string[];
  questions: string[];
  listening: string[];
  reflection: string[];
  vocabQuiz?: string[];
};

function parseSubmission(text: string, day: DayContent): SubmissionData {
  const template = day.submissionTemplate;
  const data: SubmissionData = {
    writing: "",
    speaking: "",
    conversation: [],
    sentences: Array(template.sentenceCount).fill(""),
    hindiTranslation: Array(20).fill(""),
    questions: Array(template.questionCount).fill(""),
    listening: Array(template.listeningCount).fill(""),
    reflection: Array(template.reflectionCount).fill(""),
  };

  if (day.dayType === "weekly_review" && template.vocabQuizCount) {
    data.vocabQuiz = Array(template.vocabQuizCount).fill("");
  }

  const lines = text.split("\n");
  let section = "";
  let itemIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip "YOUR ANSWER" lines completely
    if (trimmed === "YOUR ANSWER") continue;
    
    if (trimmed.startsWith("1. Writing Task:")) {
      section = "writing";
      itemIndex = 0;
    } else if (trimmed.startsWith("2. Speaking Task:")) {
      section = "speaking";
      itemIndex = 0;
    } else if (trimmed.startsWith("3. Conversation Practice:")) {
      section = "conversation";
      itemIndex = 0;
    } else if (trimmed.startsWith("4. Sentence Practice")) {
      section = "sentences";
      itemIndex = 0;
    } else if (trimmed.startsWith("5. Hindi to English Translation")) {
      section = "hindiTranslation";
      itemIndex = 0;
    } else if (trimmed.startsWith("6. Questions:")) {
      section = "questions";
      itemIndex = 0;
    } else if (trimmed.startsWith("7. Listening Comprehension:")) {
      section = "listening";
      itemIndex = 0;
    } else if (trimmed.startsWith("8. Vocabulary Quiz:")) {
      section = "vocabQuiz";
      itemIndex = 0;
    } else if (trimmed.startsWith("8. Reflection") || trimmed.startsWith("9. Reflection")) {
      section = "reflection";
      itemIndex = 0;
    } else if (trimmed) {
      if (section === "writing" && !data.writing) {
        data.writing = trimmed;
      } else if (section === "speaking" && !data.speaking) {
        data.speaking = trimmed;
      } else if (section === "conversation" && (trimmed.startsWith("A:") || trimmed.startsWith("B:"))) {
        data.conversation.push(trimmed);
      } else if (section === "sentences" && /^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^\d+\.\s*(.*)$/);
        if (match && match[1] && match[1] !== "YOUR ANSWER") data.sentences[itemIndex++] = match[1];
      } else if (section === "hindiTranslation" && /^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^\d+\.\s*(.*)$/);
        if (match && match[1] && match[1] !== "YOUR ANSWER") data.hindiTranslation[itemIndex++] = match[1];
      } else if (section === "questions" && /^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^\d+\.\s*(.*)$/);
        if (match && match[1] && match[1] !== "YOUR ANSWER") data.questions[itemIndex++] = match[1];
      } else if (section === "listening" && /^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^\d+\.\s*(.*)$/);
        if (match && match[1] && match[1] !== "YOUR ANSWER") data.listening[itemIndex++] = match[1];
      } else if (section === "reflection" && /^\d+\./.test(trimmed)) {
        const match = trimmed.match(/^\d+\.\s*(.*)$/);
        if (match && match[1] && match[1] !== "YOUR ANSWER") data.reflection[itemIndex++] = match[1];
      } else if (section === "vocabQuiz" && /^\d+\./.test(trimmed) && data.vocabQuiz) {
        const match = trimmed.match(/^\d+\.\s*(.*)$/);
        if (match && match[1] && match[1] !== "YOUR ANSWER") data.vocabQuiz[itemIndex++] = match[1];
      }
    }
  }

  return data;
}

function buildSubmissionText(data: SubmissionData, day: DayContent): string {
  const header = day.dayType === "weekly_review" 
    ? `DAY ${day.dayNumber} SUBMISSION (WEEKLY REVIEW)` 
    : `DAY ${day.dayNumber} SUBMISSION`;

  let text = `${header}\n\n`;
  text += `1. Writing Task:\n${data.writing || ""}\n\n`;
  text += `2. Speaking Task:\n${data.speaking || ""}\n\n`;
  
  // Conversation - only include non-empty lines
  const conversationLines = data.conversation.filter(c => c && c.trim() && !c.match(/^[AB]:\s*$/));
  text += `3. Conversation Practice:\n${conversationLines.join("\n")}\n\n`;
  
  // Sentences - only include non-empty ones
  const sentenceLines = data.sentences
    .map((s, i) => s && s.trim() ? `${i + 1}. ${s}` : "")
    .filter(s => s);
  text += `4. Sentence Practice:\n${sentenceLines.join("\n")}\n\n`;
  
  // Hindi Translation - only include non-empty ones
  const hindiLines = data.hindiTranslation
    .map((h, i) => h && h.trim() ? `${i + 1}. ${h}` : "")
    .filter(h => h);
  text += `5. Hindi to English Translation:\n${hindiLines.join("\n")}\n\n`;
  
  // Questions - only include non-empty ones
  const questionLines = data.questions
    .map((q, i) => q && q.trim() ? `${i + 1}. ${q}` : "")
    .filter(q => q);
  text += `6. Questions:\n${questionLines.join("\n")}\n\n`;
  
  // Listening - only include non-empty ones
  const listeningLines = data.listening
    .map((l, i) => l && l.trim() ? `${i + 1}. ${l}` : "")
    .filter(l => l);
  text += `7. Listening Comprehension:\n${listeningLines.join("\n")}\n\n`;
  
  if (day.dayType === "weekly_review" && data.vocabQuiz) {
    const vocabLines = data.vocabQuiz
      .map((v, i) => v && v.trim() ? `${i + 1}. ${v}` : "")
      .filter(v => v);
    text += `8. Vocabulary Quiz:\n${vocabLines.join("\n")}\n\n`;
    
    const reflectionLines = data.reflection
      .map((r, i) => r && r.trim() ? `${i + 1}. ${r}` : "")
      .filter(r => r);
    text += `9. Reflection (required, not graded):\n${reflectionLines.join("\n")}`;
  } else {
    const reflectionLines = data.reflection
      .map((r, i) => r && r.trim() ? `${i + 1}. ${r}` : "")
      .filter(r => r);
    text += `8. Reflection (required, not graded):\n${reflectionLines.join("\n")}`;
  }

  return text;
}

export function SubmissionEditor(props: {
  day: DayContent;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
  isDraftLoaded: boolean;
}) {
  const [mode, setMode] = useState<"form" | "text">("form");
  const [formData, setFormData] = useState<SubmissionData>(() => parseSubmission(props.value, props.day));
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);

  // Auto-save draft with debounce
  const autoSaveDraft = useCallback((text: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      if (text.trim().length > 0) {
        setIsSaving(true);
        try {
          await saveDraft(text);
          console.log("💾 Draft auto-saved");
        } catch (error) {
          console.error("Failed to save draft:", error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000); // Save after 2 seconds of inactivity
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Only initialize empty data if draft hasn't been loaded yet and value is empty
    if (!props.isDraftLoaded || props.value.trim()) {
      return; // Don't initialize if draft is loading or already has content
    }
    
    const emptyData: SubmissionData = {
      writing: "",
      speaking: "",
      conversation: [],
      sentences: Array(props.day.submissionTemplate.sentenceCount).fill(""),
      hindiTranslation: Array(20).fill(""),
      questions: Array(props.day.submissionTemplate.questionCount).fill(""),
      listening: Array(props.day.submissionTemplate.listeningCount).fill(""),
      reflection: Array(props.day.submissionTemplate.reflectionCount).fill(""),
    };
    if (props.day.dayType === "weekly_review" && props.day.submissionTemplate.vocabQuizCount) {
      emptyData.vocabQuiz = Array(props.day.submissionTemplate.vocabQuizCount).fill("");
    }
    setFormData(emptyData);
    // Only generate empty text if we're in form mode
    if (mode === "form") {
      const newText = buildSubmissionText(emptyData, props.day);
      props.onChange(newText);
    }
  }, [props.isDraftLoaded, props.day.dayNumber]); // Run when draft is loaded or day changes

  useEffect(() => {
    if (mode === "form") {
      const newText = buildSubmissionText(formData, props.day);
      props.onChange(newText);
      autoSaveDraft(newText);
    }
  }, [formData, mode, props.day, autoSaveDraft]);

  useEffect(() => {
    if (mode === "text") {
      setFormData(parseSubmission(props.value, props.day));
      autoSaveDraft(props.value);
    }
  }, [props.value, mode, props.day, autoSaveDraft]);

  const template = props.day.submissionTemplate;
  const conversationTurns = Array.from({ length: template.conversationMinTurns }, (_, i) => 
    i % 2 === 0 ? "A" : "B"
  );

  const updateFormData = (field: keyof SubmissionData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateArrayItem = (field: keyof SubmissionData, index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).map((item, i) => i === index ? value : item)
    }));
  };

  const [activeSection, setActiveSection] = useState<string>("writing");

  const SUBMISSION_SECTIONS = [
    ["writing", "Writing"],
    ["speaking", "Speaking"],
    ["conversation", "Conversation"],
    ["sentences", "Sentences"],
    ["hindi", "Hindi→English"],
    ["questions", "Questions"],
    ["listening", "Listening"],
    ["reflection", "Reflection"],
  ] as const;

  if (mode === "text") {
    return (
      <div className="h-full flex flex-col gap-1">
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm px-2 sm:px-3 py-1.5 shadow-lg shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-semibold text-white">Text Mode</span>
              {isSaving && <span className="text-[10px] sm:text-xs text-white/50">💾</span>}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setMode("form")}
                className="rounded-lg border border-white/10 bg-white/5 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200 flex items-center gap-1"
              >
                <span>📋</span>
                <span className="hidden sm:inline">Form Mode</span>
              </button>
              <button
                type="button"
                disabled={!props.canSubmit || props.submitting}
                onClick={props.onSubmit}
                className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold text-white hover:from-indigo-400 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-indigo-500/20 flex items-center gap-1"
              >
                {props.submitting ? (
                  <>
                    <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span className="hidden sm:inline">Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span className="hidden sm:inline">Submit Work</span>
                    <span className="sm:hidden">Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-gradient-to-br from-black/40 to-black/20 backdrop-blur-sm overflow-hidden shadow-xl">
          <textarea
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            className="w-full h-full resize-none bg-transparent p-3 sm:p-6 font-mono text-xs sm:text-base leading-relaxed text-white/90 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400/40 placeholder:text-white/30 overflow-y-auto custom-scrollbar"
            placeholder="Fill the template and submit your work here..."
            spellCheck={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="rounded-lg sm:rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm p-2 sm:p-3 shadow-lg shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <span className="text-base sm:text-lg">📋</span>
            <span className="font-semibold text-white">Form Mode</span>
            {isSaving && <span className="text-[10px] sm:text-xs text-white/50">💾</span>}
          </div>
          
          {!props.canSubmit ? (
            <div className="flex-1 text-[10px] sm:text-sm text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded px-2 sm:px-4 py-1.5 sm:py-2">
              <span className="font-semibold">📚 Complete more sections:</span> You need to complete at least {props.day.submissionTemplate.type === "normal" ? 5 : 6} lesson sections before you can submit. Go to Lesson tab.
            </div>
          ) : (
            <div className="flex-1" />
          )}
          
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMode("text")}
              className="flex-1 sm:flex-none rounded-lg border border-white/10 bg-white/5 px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-medium text-white hover:bg-white/10 sm:min-w-[120px]"
            >
              📝 Text Mode
            </button>
            <button
              type="button"
              disabled={!props.canSubmit || props.submitting}
              onClick={props.onSubmit}
              className="flex-1 sm:flex-none rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-semibold text-white hover:from-indigo-400 hover:to-purple-400 disabled:opacity-50 sm:min-w-[130px]"
            >
              {props.submitting ? "⏳ Submitting..." : "✨ Submit Work"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-thin pb-2">
        {SUBMISSION_SECTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`rounded-lg border px-3 sm:px-6 py-1.5 sm:py-2 text-[10px] sm:text-sm whitespace-nowrap flex-shrink-0 ${
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

      <div className="flex-1 min-h-0 overflow-auto pr-1 sm:pr-2 custom-scrollbar">
        <div className="rounded-lg border border-white/10 bg-black/10 p-4">
          {activeSection === "writing" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Writing Task</div>
              <div className="text-sm text-white/70 bg-black/20 p-3 rounded border border-white/5 max-h-32 overflow-y-auto leading-relaxed">
                {formatPromptText(props.day.writingTask.prompt)}
              </div>
              <textarea
                value={formData.writing}
                onChange={(e) => updateFormData("writing", e.target.value)}
                className="w-full h-64 resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/90 outline-none focus:border-white/20"
                placeholder="Write your answer here..."
              />
            </div>
          )}
          
          {activeSection === "speaking" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Speaking Task</div>
              <div className="text-sm text-white/70 bg-black/20 p-3 rounded border border-white/5 max-h-32 overflow-y-auto leading-relaxed">
                {formatPromptText(props.day.speakingTask.prompt)}
              </div>
              <textarea
                value={formData.speaking}
                onChange={(e) => updateFormData("speaking", e.target.value)}
                className="w-full h-64 resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/90 outline-none focus:border-white/20"
                placeholder="Describe what you said or plan to say..."
              />
            </div>
          )}
          
          {activeSection === "conversation" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Conversation Practice ({template.conversationMinTurns} turns)</div>
              <div className="text-sm text-white/70 bg-black/20 p-3 rounded border border-white/5 max-h-32 overflow-y-auto leading-relaxed">
                {formatPromptText(props.day.conversationTask.prompt)}
              </div>
              {conversationTurns.map((speaker, i) => {
                // Extract the actual text without the speaker prefix
                const currentValue = formData.conversation[i] || "";
                const textWithoutPrefix = currentValue.startsWith(`${speaker}:`) 
                  ? currentValue.substring(speaker.length + 1).trimStart() 
                  : currentValue;
                
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="text-xs font-semibold text-white/70 mt-2 w-6">{speaker}:</div>
                    <input
                      value={textWithoutPrefix}
                      onChange={(e) => {
                        const newConv = [...formData.conversation];
                        // Don't trim the value - preserve spaces as user types
                        newConv[i] = `${speaker}: ${e.target.value}`;
                        updateFormData("conversation", newConv);
                      }}
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-white/20"
                      placeholder={`${speaker}'s response...`}
                    />
                  </div>
                );
              })}
            </div>
          )}
          
          {activeSection === "sentences" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Sentence Practice ({template.sentenceCount} sentences)</div>
              {props.day.sentencePractice.items.map((item, i) => {
                // Clean up the prompt - if it's too long or contains instructions, simplify it
                let displayPrompt = item.prompt;
                if (displayPrompt.length > 150 || displayPrompt.includes('**') || displayPrompt.includes('Challenge yourself')) {
                  displayPrompt = `Write a sentence using today's grammar`;
                }
                
                return (
                  <div key={i} className="space-y-1">
                    <div className="text-xs text-white/60">{item.k}. {displayPrompt}</div>
                    <input
                      value={formData.sentences[i] || ""}
                      onChange={(e) => updateArrayItem("sentences", i, e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-white/20"
                      placeholder="Your sentence..."
                    />
                  </div>
                );
              })}
            </div>
          )}
          
          {activeSection === "hindi" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Hindi to English Translation (20 sentences)</div>
              <div className="text-xs text-white/60 bg-indigo-500/10 border border-indigo-400/30 rounded p-2 mb-3">
                📝 Translate these Hindi sentences to English. Write natural, grammatically correct English sentences.
              </div>
              {props.day.hindiTranslation.items.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-400/20 rounded px-2 py-1.5">
                    {item.k}. {item.hindiSentence}
                  </div>
                  <input
                    value={formData.hindiTranslation[i] || ""}
                    onChange={(e) => updateArrayItem("hindiTranslation", i, e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-white/20"
                    placeholder="Your English translation..."
                  />
                </div>
              ))}
            </div>
          )}
          
          {activeSection === "questions" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Questions ({template.questionCount} questions)</div>
              {props.day.questions.items.slice(0, template.questionCount).map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs text-white/60">{item.idx}. {item.prompt}</div>
                  <input
                    value={formData.questions[i] || ""}
                    onChange={(e) => updateArrayItem("questions", i, e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-white/20"
                    placeholder="Your answer..."
                  />
                </div>
              ))}
            </div>
          )}
          
          {activeSection === "listening" && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-white">Listening Comprehension ({template.listeningCount} questions)</div>
              
              {/* Transcript Section */}
              <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📝</span>
                  <div className="text-sm font-semibold text-indigo-200">Transcript:</div>
                </div>
                <div className="text-sm text-white/85 leading-relaxed max-h-80 overflow-y-auto">
                  {formatPromptText(props.day.listening.transcript)}
                </div>
              </div>

              {/* Questions */}
              <div className="text-xs font-semibold text-white/70 mb-2">Answer the questions based on the transcript:</div>
              {props.day.listening.questions.slice(0, template.listeningCount).map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs text-white/60">{item.idx}. {item.prompt}</div>
                  <input
                    value={formData.listening[i] || ""}
                    onChange={(e) => updateArrayItem("listening", i, e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white/90 outline-none focus:border-white/20"
                    placeholder="Your answer..."
                  />
                </div>
              ))}
            </div>
          )}
          
          {activeSection === "reflection" && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white">Reflection (required, not graded)</div>
              {Array.from({ length: template.reflectionCount }, (_, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs text-white/60">{i + 1}. Reflection prompt</div>
                  <textarea
                    value={formData.reflection[i] || ""}
                    onChange={(e) => updateArrayItem("reflection", i, e.target.value)}
                    className="w-full h-32 resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/90 outline-none focus:border-white/20"
                    placeholder="Your reflection..."
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
