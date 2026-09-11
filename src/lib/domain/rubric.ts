import { RubricCriterion } from "./types";

export const RUBRIC_CRITERIA: RubricCriterion[] = [
  {
    id: "req-coverage",
    name: "Requirement Coverage",
    description: "Evaluates how completely the submission addresses all stated requirements.",
    weight: 0.2
  },
  {
    id: "resp-clarity",
    name: "Responsibility Clarity",
    description: "Evaluates if each class has a clear, single responsibility aligned with SRP.",
    weight: 0.2
  },
  {
    id: "coupling-cohesion",
    name: "Coupling / Cohesion",
    description: "Assesses whether the design minimizes coupling and maximizes cohesion.",
    weight: 0.2
  },
  {
    id: "abstraction-fit",
    name: "Abstraction Fit",
    description: "Evaluates if the chosen abstractions and interfaces match the domain.",
    weight: 0.15
  },
  {
    id: "extensibility",
    name: "Extensibility",
    description: "Checks how easily the design can accommodate future requirements without major modifications.",
    weight: 0.15
  },
  {
    id: "edge-cases",
    name: "Edge Cases",
    description: "Assesses whether potential edge cases and constraints are handled properly.",
    weight: 0.1
  }
];
