import { Submission, RubricCriterion, EvaluationResult, CriterionResult } from "./types";

export interface Evaluator {
  readonly type: "deterministic" | "llm";
  evaluate(submission: Submission, rubric: RubricCriterion[]): Promise<EvaluationResult>;
}

export class DeterministicEvaluator implements Evaluator {
  readonly type = "deterministic";

  async evaluate(submission: Submission, rubric: RubricCriterion[]): Promise<EvaluationResult> {
    const results: CriterionResult[] = [];
    const { content } = submission;
    
    let passed = true;

    // Check assumptions
    const assumptions = content.assumptions?.trim() || "";
    if (assumptions) {
      results.push({ criterionId: "det-assumptions", criterionName: "Assumptions Provided", score: 5, evidence: "Assumptions are provided.", confidence: 1.0 });
    } else {
      passed = false;
      results.push({ criterionId: "det-assumptions", criterionName: "Assumptions Provided", score: 0, evidence: "Assumptions section is empty.", confidence: 1.0 });
    }

    // Check relationships
    const relationships = content.relationships?.trim() || "";
    if (relationships) {
      results.push({ criterionId: "det-relationships", criterionName: "Relationships Provided", score: 5, evidence: "Relationships are provided.", confidence: 1.0 });
    } else {
      passed = false;
      results.push({ criterionId: "det-relationships", criterionName: "Relationships Provided", score: 0, evidence: "Relationships section is empty.", confidence: 1.0 });
    }

    // Check extensibilityNote
    const extensibilityNote = content.extensibilityNote?.trim() || "";
    if (extensibilityNote) {
      results.push({ criterionId: "det-extensibility", criterionName: "Extensibility Note Provided", score: 5, evidence: "Extensibility note is provided.", confidence: 1.0 });
    } else {
      passed = false;
      results.push({ criterionId: "det-extensibility", criterionName: "Extensibility Note Provided", score: 0, evidence: "Extensibility note is empty.", confidence: 1.0 });
    }

    // Check class count
    const classes = content.classes || [];
    if (classes.length >= 2) {
      results.push({ criterionId: "det-class-count", criterionName: "Sufficient Class Count", score: 5, evidence: `Found ${classes.length} classes.`, confidence: 1.0 });
    } else {
      passed = false;
      results.push({ criterionId: "det-class-count", criterionName: "Sufficient Class Count", score: 0, evidence: `Found ${classes.length} classes, expected at least 2.`, confidence: 1.0 });
    }

    // Check class responsibilities
    let allClassesValid = classes.length > 0;
    for (const cls of classes) {
      if (!cls.name?.trim() || !cls.responsibility?.trim()) {
        allClassesValid = false;
        break;
      }
    }

    if (allClassesValid) {
      results.push({ criterionId: "det-class-responsibility", criterionName: "Valid Class Definitions", score: 5, evidence: "All classes have a name and responsibility.", confidence: 1.0 });
    } else {
      passed = false;
      results.push({ criterionId: "det-class-responsibility", criterionName: "Valid Class Definitions", score: 0, evidence: "One or more classes are missing a name or responsibility.", confidence: 1.0 });
    }

    const summary = passed ? "All deterministic checks passed." : "One or more deterministic checks failed. Please fix structural issues before full evaluation.";

    return {
      evaluatorType: this.type,
      results,
      summary,
      passed
    };
  }
}

export class LLMEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMEvaluationError";
  }
}

export class LLMEvaluator implements Evaluator {
  readonly type = "llm";

  async evaluate(submission: Submission, rubric: RubricCriterion[]): Promise<EvaluationResult> {
    try {
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const systemPrompt = `You are an expert system design evaluator.
Evaluate the following submission against these criteria:
${rubric.map(r => `- ${r.name}: ${r.description}`).join('\n')}

You must return ONLY a JSON object with this exact structure:
{
  "results": [
    {
      "criterionId": "string",
      "criterionName": "string",
      "score": number,
      "evidence": "string",
      "concern": "string",
      "suggestion": "string",
      "confidence": number
    }
  ],
  "summary": "string"
}`;

      const userPrompt = JSON.stringify(submission.content, null, 2);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      });

      const messageContent = response.choices[0].message.content || "{}";
      const parsed = JSON.parse(messageContent);
      const results: CriterionResult[] = parsed.results || [];
      const summary: string = parsed.summary || "";

      const passed = results.every(r => r.score >= 3);

      return {
        evaluatorType: this.type,
        results,
        summary,
        passed
      };
    } catch (err: any) {
      throw new LLMEvaluationError(err.message || "Failed to run LLM evaluation");
    }
  }
}
