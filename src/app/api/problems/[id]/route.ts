/**
 * GET /api/problems/:id — returns a single problem by ID
 */

import { getProblemById } from "@/lib/db";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/problems/[id]">
) {
  const { id } = await ctx.params;
  const problem = getProblemById(id);
  if (!problem) {
    return Response.json({ error: "Problem not found" }, { status: 404 });
  }
  return Response.json(problem);
}
