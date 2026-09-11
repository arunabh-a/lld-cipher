/**
 * GET /api/problems — returns all problems (no pagination needed for 4 items)
 */

import { getAllProblems } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const problems = getAllProblems();
  return Response.json(problems);
}
