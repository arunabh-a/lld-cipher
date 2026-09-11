/**
 * POST /api/attempts/:id/submit
 *
 * Saves the final submission, transitions the attempt to "Evaluating",
 * and kicks off background evaluation (fire-and-forget).
 *
 * This is the key async boundary: the HTTP response returns immediately
 * so the learner sees a "evaluating..." state, while the evaluation
 * runs in the background. The frontend polls GET /api/attempts/:id to
 * check when it's done.
 */

import {
  getAttemptById,
  updateAttemptStatus,
  createSubmission,
  createEvaluation,
  updateEvaluation,
  getSubmissionByAttemptId,
  getProblemById,
} from "@/lib/db";
import { NextRequest } from "next/server";

// Lazy imports to avoid circular dependency issues and keep the route handler lean.
// These are server-only modules so dynamic import is fine.
async function getEvaluationDeps() {
  const { DeterministicEvaluator, LLMEvaluator } = await import(
    "@/lib/domain/evaluator"
  );
  const { EvaluationOrchestrator } = await import(
    "@/lib/domain/orchestrator"
  );
  const { RUBRIC_CRITERIA } = await import("@/lib/domain/rubric");
  return { DeterministicEvaluator, LLMEvaluator, EvaluationOrchestrator, RUBRIC_CRITERIA };
}

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/attempts/[id]/submit">
) {
  const { id } = await ctx.params;

  const attempt = getAttemptById(id);
  if (!attempt) {
    return Response.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Guard: only InProgress attempts can be submitted.
  // This prevents duplicate submissions while evaluating.
  if (attempt.status !== "InProgress") {
    return Response.json(
      {
        error: `Cannot submit: attempt is '${attempt.status}'. Only 'InProgress' attempts can be submitted.`,
      },
      { status: 409 }
    );
  }

  const body = await req.json();
  const content = body.content;
  if (!content) {
    return Response.json(
      { error: "Missing 'content' in request body" },
      { status: 400 }
    );
  }

  // 1. Transition to Submitted, then immediately to Evaluating
  updateAttemptStatus(id, "Submitted");
  const submission = createSubmission(id, content);
  updateAttemptStatus(id, "Evaluating");

  // 2. Create a pending evaluation record
  const evalRecord = createEvaluation(submission.id);

  // 3. Fire-and-forget: run evaluation in the background.
  //    We intentionally do NOT await this — the response returns now,
  //    and the frontend will poll for status changes.
  void runEvaluation(id, submission, evalRecord.id);

  return Response.json(
    { attemptId: id, submissionId: submission.id, status: "Evaluating" },
    { status: 202 }
  );
}

/**
 * Background evaluation runner. Errors are caught and stored in the DB,
 * never thrown to the caller (since there's no caller — it's fire-and-forget).
 */
async function runEvaluation(
  attemptId: string,
  submission: { id: string; attemptId: string; content: object; submittedAt: string },
  evaluationId: string
) {
  try {
    const { DeterministicEvaluator, LLMEvaluator, EvaluationOrchestrator, RUBRIC_CRITERIA } =
      await getEvaluationDeps();

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

    // Update the evaluation record with results
    updateEvaluation(evaluationId, {
      status: result.status,
      results: result.results,
      overallSummary: result.overallSummary,
      errorMessage: result.errorMessage,
    });

    // Update attempt status to match evaluation outcome
    updateAttemptStatus(
      attemptId,
      result.status === "Failed" ? "Failed" : "Completed"
    );
  } catch (err) {
    // Catch-all: if something completely unexpected happens,
    // mark both records as failed so the UI can show a retry button.
    const message = err instanceof Error ? err.message : "Unknown error";
    updateEvaluation(evaluationId, {
      status: "Failed",
      results: [],
      overallSummary: "Evaluation failed due to an unexpected error.",
      errorMessage: message,
    });
    updateAttemptStatus(attemptId, "Failed");
  }
}
