import { useState, useEffect } from "react";
import { fetchInterviewQuestions } from "../lib/api";
import type { InterviewPracticeData, InterviewQuestion, InterviewQuestionType } from "../lib/types";
import { LoadingSpinner } from "./LoadingSpinner";

const QUESTION_TYPES: InterviewQuestionType[] = [
  "Introduction",
  "Strength",
  "Weakness",
  "Project",
  "Teamwork",
  "Situational",
  "Career Goal",
  "Achievement",
  "Leadership",
  "Conflict",
];

export function InterviewPanel({ currentDay }: { currentDay: number }) {
  const [data, setData] = useState<InterviewPracticeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<InterviewQuestionType | "All">("All");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadQuestions();
  }, [currentDay]);

  async function loadQuestions() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchInterviewQuestions(currentDay);
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  function toggleCard(questionId: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }

  const filteredQuestions =
    filterType === "All"
      ? data?.questions || []
      : data?.questions.filter((q) => q.type === filterType) || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-gray-800 rounded-xl border border-gray-700">
        <LoadingSpinner />
        <p className="mt-6 text-gray-200 font-bold text-xl">🎤 Loading Interview Questions...</p>
        <p className="mt-2 text-gray-400">Preparing your interview questions for today...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border-2 border-red-700 rounded-xl p-6 text-center">
        <p className="text-red-300 mb-4 text-lg">{error}</p>
        <button
          onClick={loadQuestions}
          className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all shadow-md"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Type Filter Pills */}
      <div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType("All")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition border ${
              filterType === "All"
                ? "bg-[#3a3a3a] text-[#ffa116] border-[#ffa116]"
                : "bg-[#282828] text-[#d4d4d4] border-[#3e3e3e] hover:border-[#4e4e4e]"
            }`}
          >
            All ({data?.questions.length || 0})
          </button>
          {QUESTION_TYPES.map((type) => {
            const count = data?.questions.filter((q) => q.type === type).length || 0;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition border ${
                  filterType === type
                    ? "bg-[#3a3a3a] text-[#ffa116] border-[#ffa116]"
                    : "bg-[#282828] text-[#d4d4d4] border-[#3e3e3e] hover:border-[#4e4e4e]"
                }`}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Cards */}
      <div className="space-y-4">
        {filteredQuestions.map((question) => (
          <QuestionCard
            key={question.questionId}
            question={question}
            isExpanded={expandedCards.has(question.questionId)}
            onToggle={() => toggleCard(question.questionId)}
          />
        ))}
      </div>

      {filteredQuestions.length === 0 && (
        <div className="text-center py-16 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-lg">No questions found for this filter.</p>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  isExpanded,
  onToggle,
}: {
  question: InterviewQuestion;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#282828] border border-[#3e3e3e] rounded-lg p-4 hover:border-[#4e4e4e] transition">
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className="px-2 py-0.5 bg-[#3a3a3a] text-[#ffa116] text-xs font-medium rounded border border-[#4a4a4a]">
          {question.type}
        </span>
      </div>
      <p className="text-base text-white mb-3 leading-relaxed">{question.question}</p>
      <button
        onClick={onToggle}
        className="px-4 py-2 bg-[#3a3a3a] text-white text-sm font-medium rounded border border-[#4a4a4a] hover:bg-[#4a4a4a] transition"
      >
        {isExpanded ? "Hide" : "Show"} Answer
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[#3e3e3e] space-y-3">
          <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3e3e3e]">
            <p className="text-xs font-semibold text-[#a0a0a0] mb-2">Model Answer:</p>
            <p className="text-sm text-[#d4d4d4] leading-relaxed">{question.modelAnswer}</p>
          </div>

          <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3e3e3e]">
            <p className="text-xs font-semibold text-[#a0a0a0] mb-2">Key Points to Cover:</p>
            <ul className="space-y-2">
              {question.keyPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <input 
                    type="checkbox" 
                    className="mt-1 w-3.5 h-3.5 accent-[#ffa116]" 
                  />
                  <span className="text-sm text-[#d4d4d4]">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3e3e3e]">
            <p className="text-xs font-semibold text-[#a0a0a0] mb-2">💡 Delivery Tip:</p>
            <p className="text-sm text-[#d4d4d4] leading-relaxed">{question.deliveryTip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
