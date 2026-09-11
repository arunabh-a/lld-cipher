/**
 * GET   /api/attempts/:id — get attempt detail (with submission + evaluation)
 * PATCH /api/attempts/:id — save draft submission content
 */

import {
  getAttemptById,
  updateAttemptDraft,
  getSubmissionByAttemptId,
  getEvaluationByAttemptId,
} from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/attempts/[id]">
) {
  const { id } = await ctx.params;

  const attempt = getAttemptById(id);
  if (!attempt) {
    return Response.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Attach submission and evaluation data if they exist
  const submission = getSubmissionByAttemptId(id);
  const evaluation = getEvaluationByAttemptId(id);

  return Response.json({
    ...attempt,
    submission,
    evaluation,
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/attempts/[id]">
) {
  const { id } = await ctx.params;

  const attempt = getAttemptById(id);
  if (!attempt) {
    return Response.json({ error: "Attempt not found" }, { status: 404 });
  }

  // Only allow draft saves while the attempt is still InProgress
  if (attempt.status !== "InProgress") {
    return Response.json(
      { error: `Cannot save draft: attempt status is '${attempt.status}'` },
      { status: 409 }
    );
  }

  const body = await req.json();
  updateAttemptDraft(id, body.content);
  return Response.json({ success: true });
}
