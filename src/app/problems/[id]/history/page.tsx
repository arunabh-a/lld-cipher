/**
 * Attempt history page — shows all past attempts for a problem,
 * sorted newest first, with their evaluation scores.
 */

import { getProblemById, getAttemptsByProblemId, getEvaluationByAttemptId } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HistoryPage(
  props: PageProps<"/problems/[id]/history">
) {
  const { id } = await props.params;
  const problem = getProblemById(id);
  if (!problem) notFound();

  const attempts = getAttemptsByProblemId(id);

  // Enrich each attempt with evaluation data
  const enriched = attempts.map((attempt) => {
    const evaluation = getEvaluationByAttemptId(attempt.id);
    return { ...attempt, evaluation };
  });

  return (
    <div>
      <div className="mb-6">
        <Link href={`/problems/${id}`} className="text-sm text-indigo-600 hover:text-indigo-700">
          ← Back to {problem.title}
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold">Attempt History</h1>
      <p className="mb-6 text-gray-600">{problem.title}</p>

      {enriched.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No attempts yet. Go back and start your first attempt!
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map((attempt, index) => {
            // Calculate average score from LLM results if available
            const llmResult = attempt.evaluation?.results?.find(
              (r: { evaluatorType: string }) => r.evaluatorType === "llm"
            );
            const avgScore = llmResult
              ? (
                  llmResult.results.reduce(
                    (sum: number, cr: { score: number }) => sum + cr.score,
                    0
                  ) / llmResult.results.length
                ).toFixed(1)
              : null;

            const statusColors: Record<string, string> = {
              InProgress: "bg-gray-100 text-gray-700",
              Submitted: "bg-blue-100 text-blue-700",
              Evaluating: "bg-yellow-100 text-yellow-700",
              Completed: "bg-green-100 text-green-700",
              Failed: "bg-red-100 text-red-700",
            };

            return (
              <Link
                key={attempt.id}
                href={`/attempts/${attempt.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Attempt #{enriched.length - index}
                    </span>
                    <span className="ml-3 text-xs text-gray-500">
                      {new Date(attempt.createdAt).toLocaleDateString()} at{" "}
                      {new Date(attempt.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {avgScore && (
                      <span className="text-sm font-semibold text-indigo-600">
                        Score: {avgScore}/5
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[attempt.status] || "bg-gray-100"
                      }`}
                    >
                      {attempt.status}
                    </span>
                  </div>
                </div>
                {attempt.evaluation?.overallSummary && (
                  <p className="mt-2 text-xs text-gray-500 line-clamp-1">
                    {attempt.evaluation.overallSummary}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
