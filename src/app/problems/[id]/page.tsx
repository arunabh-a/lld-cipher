/**
 * Problem detail page — shows the full problem description,
 * requirements, constraints, and a "Start Attempt" button.
 *
 * This is a Server Component that reads the problem from the DB.
 * The "Start Attempt" button is a Client Component imported below.
 */

import { getProblemById } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import StartAttemptButton from "./StartAttemptButton";

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage(
  props: PageProps<"/problems/[id]">
) {
  const { id } = await props.params;
  const problem = getProblemById(id);

  if (!problem) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700">
          ← Back to problems
        </Link>
      </div>

      <h1 className="mb-4 text-3xl font-bold">{problem.title}</h1>
      <p className="mb-6 text-gray-700 leading-relaxed">{problem.description}</p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Requirements</h2>
        <ul className="space-y-2">
          {problem.requirements.map((req, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="mt-0.5 text-indigo-500">•</span>
              {req}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Constraints</h2>
        <ul className="space-y-2">
          {problem.constraints.map((c, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="mt-0.5 text-amber-500">⚠</span>
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-4">
        <StartAttemptButton problemId={id} />
        <Link
          href={`/problems/${id}/history`}
          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          View Past Attempts
        </Link>
      </div>
    </div>
  );
}
