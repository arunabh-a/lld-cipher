/**
 * Attempt page — the main workspace.
 *
 * This is a Server Component shell that fetches the initial attempt data
 * and passes it to the AttemptWorkspace Client Component, which handles
 * all the interactive states (form, polling, feedback).
 */

import { getAttemptById, getProblemById } from "@/lib/db";
import { notFound } from "next/navigation";
import AttemptWorkspace from "./AttemptWorkspace";

export const dynamic = "force-dynamic";

export default async function AttemptPage(
  props: PageProps<"/attempts/[id]">
) {
  const { id } = await props.params;

  const attempt = getAttemptById(id);
  if (!attempt) notFound();

  const problem = getProblemById(attempt.problemId);
  if (!problem) notFound();

  return (
    <AttemptWorkspace
      attemptId={id}
      problemId={attempt.problemId}
      problemTitle={problem.title}
      initialStatus={attempt.status}
      initialDraft={attempt.draftContent}
    />
  );
}
