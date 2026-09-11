/**
 * POST /api/attempts/:id/retry
 *
 * Re-runs ONLY the LLM evaluator against the already-stored submission.
 * Only works on Failed attempts — the learner doesn't need to re-type anything.
 *
 * This exists because the LLM call is the only flaky part. If it times out
 * or the API is down, the learner shouldn't have to redo their work.
 */

import {
  getAttemptById,
  updateAttemptStatus,
  getSubmissionByAttemptId,
  getEvaluationByAttemptId,
  updateEvaluation,
  createEvaluation,
} from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/attempts/[id]/retry">
) {
  const { id } = await ctx.params;

  const attempt = getAttemptById(id);
  if (!attempt) {
    return Response.json({ error: "Attempt not found" }, { status: 404 });
  }

  if (attempt.status !== "Failed") {
    return Response.json(
      { error: "Only failed attempts can be retried" },
      { status: 409 }
    );
  }

  const submission = getSubmissionByAttemptId(id);
  if (!submission) {
    return Response.json(
      { error: "No submission found for this attempt" },
      { status: 404 }
    );
  }

  // Transition back to Evaluating
  updateAttemptStatus(id, "Evaluating");

  // Create a fresh evaluation record for this retry
  const evalRecord = createEvaluation(submission.id);

  // Fire-and-forget: re-run evaluation
  void retryEvaluation(id, submission, evalRecord.id);

  return Response.json(
    { attemptId: id, status: "Evaluating" },
    { status: 202 }
  );
}

async function retryEvaluation(
  attemptId: string,
  submission: { id: string; attemptId: string; content: object; submittedAt: string },
  evaluationId: string
) {
  try {
    const { DeterministicEvaluator, LLMEvaluator } = await import(
      "@/lib/domain/evaluator"
    );
    const { EvaluationOrchestrator } = await import(
      "@/lib/domain/orchestrator"
    );
    const { RUBRIC_CRITERIA } = await import("@/lib/domain/rubric");

    const orchestrator = new EvaluationOrchestrator([
      new DeterministicEvaluator(),
      new LLMEvaluator(),
    ]);

    const result = await orchestrator.run(
      {
        id: submission.id,
        attemptId: submission.attemptId,
        content: submission.content as import("@/lib/domain/types").StructuredTextSubmission,
        submittedAt: submission.submittedAt,
      },
      RUBRIC_CRITERIA
    );

    updateEvaluation(evaluationId, {
      status: result.status,
      results: result.results,
      overallSummary: result.overallSummary,
      errorMessage: result.errorMessage,
    });

    updateAttemptStatus(
      attemptId,
      result.status === "Failed" ? "Failed" : "Completed"
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    updateEvaluation(evaluationId, {
      status: "Failed",
      results: [],
      overallSummary: "Retry evaluation failed.",
      errorMessage: message,
    });
    updateAttemptStatus(attemptId, "Failed");
  }
}
