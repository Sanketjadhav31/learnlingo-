import { useState, useEffect } from "react";
import { generateAllTechQuizzes } from "../lib/api";
import type { TechQuizData, TechQuizQuestion, TechSubject } from "../lib/types";
import { LoadingSpinner } from "./LoadingSpinner";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const SUBJECTS: TechSubject[] = [
  "Python",
  "NumPy",
  "Pandas",
  "DSA",
  "React",
  "Java",
  "JavaScript",
  "SQL",
  "Node.js",
  "Express.js",
];

export function TechQuizPanel({ currentDay }: { currentDay: number }) {
  const [selectedSubject, setSelectedSubject] = useState<TechSubject | null>(null);
  const [allData, setAllData] = useState<Record<string, TechQuizData>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);

  // Generate all subjects when component mounts
  useEffect(() => {
    generateAll();
  }, [currentDay]);

  async function generateAll() {
    setInitialLoading(true);
    setError(null);
    
    try {
      const result = await generateAllTechQuizzes(currentDay);
      setAllData(result.data);
      
      if (result.errors && result.errors.length > 0) {
        const failedSubjects = result.errors.map(e => e.subject).join(', ');
        setError(`Some subjects failed: ${failedSubjects}`);
      }
      
      // Auto-select first subject
      if (Object.keys(result.data).length > 0 && !selectedSubject) {
        setSelectedSubject(Object.keys(result.data)[0] as TechSubject);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quizzes");
    } finally {
      setInitialLoading(false);
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

  const data = selectedSubject ? allData[selectedSubject] : null;

  // Filter questions by selected topic
  const filteredQuestions = selectedTopicFilter
    ? data?.questions.filter((q) => q.topicTags.includes(selectedTopicFilter)) || []
    : data?.questions || [];

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {initialLoading && (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-800 rounded-xl border border-gray-700">
          <LoadingSpinner />
          <p className="mt-6 text-gray-200 font-bold text-xl">🚀 Generating Tech Quiz...</p>
          <p className="mt-2 text-gray-400">Creating 20 questions across all subjects</p>
          <p className="mt-1 text-sm text-gray-500">This takes about 30-60 seconds</p>
        </div>
      )}

      {/* Error State */}
      {error && !initialLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={generateAll}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Subject Selector Pills */}
      {!initialLoading && Object.keys(allData).length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((subject) => {
              const hasData = allData[subject];
              const questionCount = hasData ? allData[subject].questions.length : 0;
              return (
                <button
                  key={subject}
                  onClick={() => {
                    setSelectedSubject(subject);
                    setSelectedTopicFilter(null);
                  }}
                  disabled={!hasData}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition border ${
                    selectedSubject === subject
                      ? "bg-[#3a3a3a] text-[#ffa116] border-[#ffa116]"
                      : hasData
                      ? "bg-[#282828] text-[#d4d4d4] border-[#3e3e3e] hover:border-[#4e4e4e]"
                      : "bg-[#1e1e1e] text-[#6e6e6e] border-[#2e2e2e] cursor-not-allowed"
                  }`}
                >
                  {subject} {hasData && `(${questionCount})`}
                </button>
              );
            })}
          </div>

          {/* Question Cards - Show all directly */}
          {data && (
            <div className="space-y-3">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No questions available.
                </div>
              ) : (
                filteredQuestions.map((question) => (
                  <QuestionCard
                    key={question.questionId}
                    question={question}
                    isExpanded={expandedCards.has(question.questionId)}
                    onToggle={() => toggleCard(question.questionId)}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  isExpanded,
  onToggle,
}: {
  question: TechQuizQuestion;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#282828] border border-[#3e3e3e] rounded-lg p-4 hover:border-[#4e4e4e] transition">
      <div className="flex items-start gap-2 mb-3">
        <span className="px-2 py-0.5 bg-[#3a3a3a] text-[#ffa116] text-xs font-medium rounded border border-[#4a4a4a]">
          {question.difficulty}
        </span>
        {question.topicTags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-[#3a3a3a] text-[#a0a0a0] text-xs rounded border border-[#4a4a4a]"
          >
            {tag}
          </span>
        ))}
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
            <p className="text-xs font-semibold text-[#a0a0a0] mb-2">Answer:</p>
            <p className="text-sm text-[#d4d4d4] leading-relaxed">{question.answer}</p>
          </div>

          {question.codeSnippet && (
            <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3e3e3e]">
              <p className="text-xs font-semibold text-[#a0a0a0] mb-2">Code:</p>
              <SyntaxHighlighter
                language={question.language}
                style={vscDarkPlus}
                customStyle={{ 
                  borderRadius: "0.375rem", 
                  fontSize: "0.813rem", 
                  padding: "0.75rem",
                  margin: 0,
                  background: "#1a1a1a",
                  border: "1px solid #3e3e3e"
                }}
              >
                {question.codeSnippet}
              </SyntaxHighlighter>
            </div>
          )}

          <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3e3e3e]">
            <p className="text-xs font-semibold text-[#a0a0a0] mb-2">Explanation:</p>
            <p className="text-sm text-[#d4d4d4] leading-relaxed">{question.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
