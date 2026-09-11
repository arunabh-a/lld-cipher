export type AttemptStatus = "InProgress" | "Submitted" | "Evaluating" | "Completed" | "Failed";

export interface Problem {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  constraints: string[];
}

export interface Attempt {
  id: string;
  problemId: string;
  status: AttemptStatus;
  createdAt: string;
}

export interface StructuredTextSubmission {
  assumptions: string;
  classes: { name: string; responsibility: string }[];
  relationships: string;
  extensibilityNote: string;
}

export interface Submission {
  id: string;
  attemptId: string;
  content: StructuredTextSubmission;
  submittedAt: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface CriterionResult {
  criterionId: string;
  criterionName: string;
  score: number;        // 0-5
  evidence: string;
  concern?: string;
  suggestion?: string;
  confidence: number;   // 0-1
}

export interface EvaluationResult {
  evaluatorType: "deterministic" | "llm";
  results: CriterionResult[];
  summary?: string;
  passed: boolean;
}

export interface Evaluation {
  id: string;
  submissionId: string;
  status: "Pending" | "Completed" | "Failed";
  results: EvaluationResult[];
  overallSummary: string;
  errorMessage?: string;
  createdAt: string;
}

export function canSubmit(status: AttemptStatus): boolean {
  return status === "InProgress";
}
