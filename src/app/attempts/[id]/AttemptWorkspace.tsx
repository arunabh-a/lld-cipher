"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/**
 * The main interactive workspace for an attempt.
 *
 * Handles 4 states:
 * 1. InProgress — shows the structured-text form for writing the design
 * 2. Evaluating — shows a polling spinner while background eval runs
 * 3. Completed — shows the rubric-based feedback
 * 4. Failed — shows error + retry button
 */

interface ClassEntry {
  name: string;
  responsibility: string;
}

interface AttemptData {
  id: string;
  problemId: string;
  status: string;
  draftContent: {
    assumptions: string;
    classes: ClassEntry[];
    relationships: string;
    extensibilityNote: string;
  } | null;
  submission: {
    content: {
      assumptions: string;
      classes: ClassEntry[];
      relationships: string;
      extensibilityNote: string;
    };
  } | null;
  evaluation: {
    status: string;
    results: EvaluationResult[];
    overallSummary: string;
    errorMessage?: string;
  } | null;
}

interface CriterionResult {
  criterionId: string;
  criterionName: string;
  score: number;
  evidence: string;
  concern?: string;
  suggestion?: string;
  confidence: number;
}

interface EvaluationResult {
  evaluatorType: "deterministic" | "llm";
  results: CriterionResult[];
  summary?: string;
  passed: boolean;
}

export default function AttemptWorkspace({
  attemptId,
  problemId,
  problemTitle,
  initialStatus,
  initialDraft,
}: {
  attemptId: string;
  problemId: string;
  problemTitle: string;
  initialStatus: string;
  initialDraft: {
    assumptions: string;
    classes: ClassEntry[];
    relationships: string;
    extensibilityNote: string;
  } | null;
}) {
  // ─── Form state ───────────────────────────────────────────────
  const [assumptions, setAssumptions] = useState(initialDraft?.assumptions || "");
  const [classes, setClasses] = useState<ClassEntry[]>(
    initialDraft?.classes || [{ name: "", responsibility: "" }]
  );
  const [relationships, setRelationships] = useState(initialDraft?.relationships || "");
  const [extensibilityNote, setExtensibilityNote] = useState(
    initialDraft?.extensibilityNote || ""
  );

  // ─── Attempt status state ─────────────────────────────────────
  const [status, setStatus] = useState(initialStatus);
  const [evaluation, setEvaluation] = useState<AttemptData["evaluation"]>(null);
  const [submission, setSubmission] = useState<AttemptData["submission"]>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // ─── Polling for evaluation results ───────────────────────────
  // Polls every 2s while status is "Evaluating" and stops once done.
  useEffect(() => {
    if (status !== "Evaluating") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}`);
        const data: AttemptData = await res.json();
        setStatus(data.status);
        if (data.evaluation) setEvaluation(data.evaluation);
        if (data.submission) setSubmission(data.submission);

        if (data.status !== "Evaluating") {
          clearInterval(interval);
        }
      } catch {
        // Silently retry on next poll
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status, attemptId]);

  // ─── On initial load, fetch full attempt data if not InProgress ──
  useEffect(() => {
    if (initialStatus === "InProgress") return;

    const fetchData = async () => {
      const res = await fetch(`/api/attempts/${attemptId}`);
      const data: AttemptData = await res.json();
      setStatus(data.status);
      if (data.evaluation) setEvaluation(data.evaluation);
      if (data.submission) setSubmission(data.submission);
    };
    fetchData();
  }, [initialStatus, attemptId]);

  // ─── Save draft ───────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    setSavingDraft(true);
    try {
      await fetch(`/api/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { assumptions, classes, relationships, extensibilityNote },
        }),
      });
    } finally {
      setSavingDraft(false);
    }
  }, [attemptId, assumptions, classes, relationships, extensibilityNote]);

  // ─── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { assumptions, classes, relationships, extensibilityNote },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to submit");
        return;
      }
      setStatus("Evaluating");
    } catch {
      alert("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Retry (re-run LLM evaluator) ────────────────────────────
  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        setStatus("Evaluating");
        setEvaluation(null);
      }
    } finally {
      setRetrying(false);
    }
  };

  // ─── Class management ────────────────────────────────────────
  const addClass = () => setClasses([...classes, { name: "", responsibility: "" }]);
  const removeClass = (index: number) => {
    if (classes.length <= 1) return;
    setClasses(classes.filter((_, i) => i !== index));
  };
  const updateClass = (index: number, field: "name" | "responsibility", value: string) => {
    const updated = [...classes];
    updated[index] = { ...updated[index], [field]: value };
    setClasses(updated);
  };

  // ─── Render: InProgress (form) ────────────────────────────────
  if (status === "InProgress") {
    return (
      <div>
        <div className="mb-6">
          <Link
            href={`/problems/${problemId}`}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            ← Back to {problemTitle}
          </Link>
        </div>

        <h1 className="mb-6 text-2xl font-bold">Design Submission</h1>

        <div className="space-y-6">
          {/* Assumptions */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Assumptions
            </label>
            <textarea
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              placeholder="What assumptions are you making about the system?"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Classes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Classes / Entities
              </label>
              <button
                onClick={addClass}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + Add Class
              </button>
            </div>
            <div className="space-y-3">
              {classes.map((cls, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={cls.name}
                    onChange={(e) => updateClass(i, "name", e.target.value)}
                    placeholder="Class name"
                    className="w-1/3 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    value={cls.responsibility}
                    onChange={(e) => updateClass(i, "responsibility", e.target.value)}
                    placeholder="Responsibility (what does this class do?)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {classes.length > 1 && (
                    <button
                      onClick={() => removeClass(i)}
                      className="px-2 text-red-400 hover:text-red-600"
                      title="Remove class"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Relationships */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Relationships
            </label>
            <textarea
              value={relationships}
              onChange={(e) => setRelationships(e.target.value)}
              placeholder="How do these classes relate to each other? (e.g. 'ParkingLot contains Floors')"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Extensibility Note */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Extensibility Note
            </label>
            <textarea
              value={extensibilityNote}
              onChange={(e) => setExtensibilityNote(e.target.value)}
              placeholder="How would this design handle future requirements?"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for Evaluation"}
            </button>
            <button
              onClick={saveDraft}
              disabled={savingDraft}
              className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {savingDraft ? "Saving..." : "Save Draft"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Evaluating (polling spinner) ─────────────────────
  if (status === "Evaluating" || status === "Submitted") {
    return (
      <div>
        <div className="mb-6">
          <Link
            href={`/problems/${problemId}`}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            ← Back to {problemTitle}
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <h2 className="mb-2 text-xl font-semibold">Evaluating your design...</h2>
          <p className="text-sm text-gray-500">
            Running deterministic checks and AI analysis. This usually takes 10-30 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: Completed or Failed (feedback view) ──────────────
  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/problems/${problemId}`}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          ← Back to {problemTitle}
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {status === "Failed" ? "Evaluation Failed" : "Evaluation Results"}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            status === "Completed"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {status}
        </span>
      </div>

      {/* Error message for failed evaluations */}
      {status === "Failed" && evaluation?.errorMessage && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-800">Error Details</p>
          <p className="text-sm text-red-700">{evaluation.errorMessage}</p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {retrying ? "Retrying..." : "Retry Evaluation"}
          </button>
        </div>
      )}

      {/* Overall summary */}
      {evaluation?.overallSummary && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-700">Overall Summary</p>
          <p className="mt-1 text-sm text-gray-600">{evaluation.overallSummary}</p>
        </div>
      )}

      {/* Results by evaluator */}
      {evaluation?.results?.map((result: EvaluationResult, rIdx: number) => (
        <div key={rIdx} className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">
            {result.evaluatorType === "deterministic"
              ? "📋 Structure Check"
              : "🤖 AI Design Critique"}
            {" "}
            <span
              className={`ml-2 text-sm ${
                result.passed ? "text-green-600" : "text-red-600"
              }`}
            >
              {result.passed ? "Passed" : "Failed"}
            </span>
          </h2>

          {result.summary && (
            <p className="mb-3 text-sm text-gray-600 italic">{result.summary}</p>
          )}

          <div className="space-y-3">
            {result.results.map((cr: CriterionResult, cIdx: number) => (
              <div
                key={cIdx}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {cr.criterionName}
                  </span>
                  <div className="flex items-center gap-2">
                    <ScoreBar score={cr.score} />
                    <span className="text-sm font-semibold text-gray-700">
                      {cr.score}/5
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{cr.evidence}</p>
                {cr.concern && (
                  <p className="mt-1 text-sm text-amber-700">
                    <span className="font-medium">Concern:</span> {cr.concern}
                  </p>
                )}
                {cr.suggestion && (
                  <p className="mt-1 text-sm text-indigo-700">
                    <span className="font-medium">Suggestion:</span> {cr.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Actions */}
      <div className="mt-8 flex gap-3 border-t border-gray-200 pt-6">
        <Link
          href={`/problems/${problemId}`}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Try Again
        </Link>
        <Link
          href={`/problems/${problemId}/history`}
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          View History
        </Link>
      </div>
    </div>
  );
}

/**
 * Simple visual score bar (0-5 scale).
 */
function ScoreBar({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const color =
    score >= 4
      ? "bg-green-500"
      : score >= 3
        ? "bg-yellow-500"
        : "bg-red-500";
  return (
    <div className="h-2 w-20 rounded-full bg-gray-200">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
