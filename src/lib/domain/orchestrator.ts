import { v4 as uuidv4 } from 'uuid';
import { Evaluator, LLMEvaluationError } from './evaluator';
import { Submission, RubricCriterion, Evaluation } from './types';

export class EvaluationOrchestrator {
  constructor(private evaluators: Evaluator[]) {}

  async run(submission: Submission, rubric: RubricCriterion[]): Promise<Evaluation> {
    const evaluationId = uuidv4();
    const createdAt = new Date().toISOString();

    const deterministicEvaluator = this.evaluators.find(e => e.type === "deterministic");
    const llmEvaluator = this.evaluators.find(e => e.type === "llm");

    if (!deterministicEvaluator) {
      throw new Error("Deterministic evaluator is required.");
    }

    // 1. Run deterministic first
    // WHY: We run this first to save API costs and give the user immediate feedback
    // on simple structural issues without waiting for an LLM response.
    const deterministicResult = await deterministicEvaluator.evaluate(submission, rubric);

    // 2. If deterministic fails
    // WHY: We return "Completed" rather than "Failed" because the evaluation completed successfully,
    // it just resulted in a structurally failing submission. This is valid feedback for the user.
    if (!deterministicResult.passed) {
      return {
        id: evaluationId,
        submissionId: submission.id,
        status: "Completed",
        results: [deterministicResult],
        overallSummary: `Submission structure is incomplete: ${deterministicResult.summary}`,
        createdAt
      };
    }

    if (!llmEvaluator) {
      throw new Error("LLM evaluator is required if deterministic passes.");
    }

    try {
      // 3. Try to run LLM evaluator
      const llmResult = await llmEvaluator.evaluate(submission, rubric);

      return {
        id: evaluationId,
        submissionId: submission.id,
        status: "Completed",
        results: [deterministicResult, llmResult],
        overallSummary: llmResult.summary || "Evaluation completed.",
        createdAt
      };
    } catch (err: any) {
      if (err instanceof LLMEvaluationError || err.name === 'LLMEvaluationError') {
        // 4. On LLM failure
        // WHY: We keep the deterministic result so we don't lose useful data. The overall status is "Failed"
        // to indicate that the evaluation process itself encountered an error and didn't fully complete.
        return {
          id: evaluationId,
          submissionId: submission.id,
          status: "Failed",
          results: [deterministicResult],
          overallSummary: "Deterministic checks passed, but AI evaluation failed.",
          errorMessage: err.message,
          createdAt
        };
      }
      throw err;
    }
  }
}
