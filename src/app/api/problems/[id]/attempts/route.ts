/**
 * POST /api/problems/:id/attempts — create a new attempt for a problem
 * GET  /api/problems/:id/attempts — list all attempts for a problem (history)
 */

import {
  createAttempt,
  getAttemptsByProblemId,
  getProblemById,
  getEvaluationByAttemptId,
} from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/problems/[id]/attempts">
) {
  const { id } = await ctx.params;

  const problem = getProblemById(id);
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }

  const attempt = createAttempt(id);
  return Response.json(attempt, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/problems/[id]/attempts">
) {
  const { id } = await ctx.params;

  const attempts = getAttemptsByProblemId(id);

  // Enrich each attempt with its evaluation score (if any)
  const enriched = attempts.map((attempt) => {
    const evaluation = getEvaluationByAttemptId(attempt.id);
    return {
      ...attempt,
      evaluation: evaluation
        ? {
            status: evaluation.status,
            overallSummary: evaluation.overallSummary,
            results: evaluation.results,
          }
        : null,
    };
  });

  return Response.json(enriched);
}
