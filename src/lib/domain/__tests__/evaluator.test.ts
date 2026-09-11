import { describe, it, expect, vi } from 'vitest';
import { DeterministicEvaluator, LLMEvaluationError, Evaluator } from '../evaluator';
import { EvaluationOrchestrator } from '../orchestrator';
import { Submission, canSubmit } from '../types';

function makeValidSubmission(): Submission {
  return {
    id: 'sub-1',
    attemptId: 'att-1',
    content: {
      assumptions: 'The parking lot has multiple floors.',
      classes: [
        { name: 'ParkingLot', responsibility: 'Manages floors and entry/exit' },
        { name: 'Vehicle', responsibility: 'Represents a parked vehicle' },
      ],
      relationships: 'ParkingLot contains Floors, Floor contains Spots',
      extensibilityNote: 'New vehicle types can be added by extending Vehicle',
    },
    submittedAt: new Date().toISOString(),
  };
}

describe('DeterministicEvaluator', () => {
  const evaluator = new DeterministicEvaluator();

  it('passes on a well-formed submission', async () => {
    const submission = makeValidSubmission();
    const result = await evaluator.evaluate(submission, []);
    
    expect(result.passed).toBe(true);
    result.results.forEach(res => {
      expect(res.score).toBe(5);
    });
  });

  it('fails when assumptions is empty', async () => {
    const submission = makeValidSubmission();
    submission.content.assumptions = '   ';
    const result = await evaluator.evaluate(submission, []);
    
    expect(result.passed).toBe(false);
    const assumptionResult = result.results.find(r => r.criterionId === 'det-assumptions');
    expect(assumptionResult?.score).toBe(0);
  });

  it('fails when a class has empty responsibility', async () => {
    const submission = makeValidSubmission();
    submission.content.classes[0].responsibility = '';
    const result = await evaluator.evaluate(submission, []);
    
    expect(result.passed).toBe(false);
    const classResult = result.results.find(r => r.criterionId === 'det-class-responsibility');
    expect(classResult?.score).toBe(0);
  });
});

describe('EvaluationOrchestrator', () => {
  it('does NOT call the LLM evaluator when deterministic fails', async () => {
    const mockLLMEvaluator: Evaluator = {
      type: 'llm',
      evaluate: vi.fn(),
    };
    const deterministicEvaluator = new DeterministicEvaluator();
    const orchestrator = new EvaluationOrchestrator([deterministicEvaluator, mockLLMEvaluator]);
    
    const submission = makeValidSubmission();
    submission.content.assumptions = ''; // Make it fail deterministic

    const evaluation = await orchestrator.run(submission, []);

    expect(mockLLMEvaluator.evaluate).not.toHaveBeenCalled();
    expect(evaluation.status).toBe('Completed');
    expect(evaluation.results.length).toBe(1); // Only deterministic
  });

  it('on LLM evaluator throwing LLMEvaluationError, Evaluation ends with status Failed', async () => {
    const mockLLMEvaluator: Evaluator = {
      type: 'llm',
      evaluate: vi.fn().mockRejectedValue(new LLMEvaluationError('API Down')),
    };
    const deterministicEvaluator = new DeterministicEvaluator();
    const orchestrator = new EvaluationOrchestrator([deterministicEvaluator, mockLLMEvaluator]);
    
    const submission = makeValidSubmission();

    const evaluation = await orchestrator.run(submission, []);

    expect(evaluation.status).toBe('Failed');
    expect(evaluation.results.length).toBe(1);
    expect(evaluation.results[0].evaluatorType).toBe('deterministic');
    expect(evaluation.errorMessage).toBe('API Down');
  });
});

describe('Attempt state machine helper', () => {
  it('canSubmit allows InProgress and rejects Evaluating', () => {
    expect(canSubmit('InProgress')).toBe(true);
    expect(canSubmit('Evaluating')).toBe(false);
    expect(canSubmit('Submitted')).toBe(false);
  });
});
