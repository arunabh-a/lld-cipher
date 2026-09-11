/**
 * Home page — lists all available LLD problems.
 * Server Component: fetches data directly from the DB, no client JS needed.
 */

import Link from "next/link";
import { getAllProblems } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const problems = getAllProblems();

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold">Low-Level Design Problems</h1>
      <p className="mb-8 text-gray-600">
        Pick a problem, write a structured design, and get rubric-based feedback.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {problems.map((problem) => (
          <Link
            key={problem.id}
            href={`/problems/${problem.id}`}
            className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <h2 className="mb-2 text-lg font-semibold text-gray-900">
              {problem.title}
            </h2>
            <p className="mb-3 text-sm text-gray-600 line-clamp-2">
              {problem.description}
            </p>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>{problem.requirements.length} requirements</span>
              <span>{problem.constraints.length} constraints</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
