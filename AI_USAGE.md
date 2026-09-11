# AI Usage Declaration

## Tools Used

- **ChatGPT / OpenAI** — used as a development companion throughout the project for design exploration, syntax reference, and code scaffolding.

## How AI Was Used

### 1. Architecture & Domain Modeling
I had a general idea of the system's shape (problems → attempts → submissions → evaluations) but used AI to **think through the domain boundaries** — for example, whether the evaluator should be a single class or split into a deterministic + LLM pair behind an interface. The decision to run deterministic checks first (to save API costs and give instant feedback) came out of a back-and-forth conversation about trade-offs. AI also helped me land on the orchestrator pattern — I knew I needed something to coordinate multiple evaluators, but AI helped me see that a simple class with a `run()` method was enough (no need for an event bus or pipeline abstraction).

### 2. Type Definitions & Interface Design
The domain types (`Submission`, `Evaluation`, `CriterionResult`, etc.) were co-developed with AI. I described what data each entity needed to carry, and AI helped structure it into clean TypeScript interfaces. The `Evaluator` interface specifically — keeping it to just `type` and `evaluate()` — was suggested by AI as the minimal viable contract.

### 3. Database Schema
I chose SQLite with `better-sqlite3` (no ORM) as my approach, but AI helped draft the `CREATE TABLE` statements and decide on storing flexible fields (requirements, constraints, submission content) as JSON columns rather than join tables. The query helper functions were written with AI assistance for correct `better-sqlite3` API usage.

### 4. Boilerplate & Syntax Reference
AI was used to recall correct syntax for libraries I hadn't used recently — specifically `better-sqlite3` query patterns, the OpenAI SDK's `response_format` option, and Next.js App Router conventions (route handlers, `params` as a Promise in v16, `RouteContext` helper).

### 5. Seed Data Drafting
Writing realistic functional requirements and constraints for the 4 LLD problems involved repetitive phrasing. I used AI to draft initial bullet points for each problem, then reviewed and edited them for accuracy and specificity.

### 6. Rubric Criteria Descriptions
The 6 evaluation rubric criteria needed concise descriptions for use in the LLM evaluator's system prompt. AI helped wordsmith these so they'd be unambiguous when fed back into the OpenAI call.

### 7. Test Case Structure
I outlined what each vitest test case should assert (e.g., "orchestrator should not call LLM if deterministic fails"). AI helped scaffold the `describe`/`it` blocks, mock setup, and assertion patterns. The test scenarios themselves reflect my understanding of the requirements.

### 8. UI Scaffolding & Tailwind
The React components follow a straightforward pattern (server component loads data → passes to client component for interactivity). AI helped with the initial JSX structure and Tailwind class selection. The polling logic in `AttemptWorkspace.tsx` (poll every 2s while evaluating, stop on completion) was implemented with AI's help on the `useEffect` cleanup pattern.

## What Was My Own Contribution

- **Problem decomposition** — breaking the assignment requirements into the build phases and identifying what belongs in each layer (domain vs. DB vs. API vs. UI).
- **Evaluation strategy reasoning** — understanding *why* deterministic should gate LLM (cost saving, fast feedback), why deterministic failure should be "Completed" not "Failed" (it's valid feedback), and why LLM failure should preserve deterministic results (don't discard useful data).
- **Control flow decisions** — the fire-and-forget async evaluation pattern, the attempt status state machine, and the "retry re-runs LLM only" flow came from thinking through the user experience.
- **Code review & integration** — all AI-generated code was reviewed, understood, and adapted. Nothing was pasted blindly; I made sure each piece fit the overall design and handled edge cases correctly.
- **Wiring everything together** — connecting API routes to domain logic to database queries, and making the frontend poll/retry flow work end-to-end.

## Summary

AI was used as a **design partner and productivity tool** throughout the project. It helped explore architectural trade-offs, draft type definitions, scaffold boilerplate, and write database queries. The high-level problem decomposition, evaluation strategy reasoning, and system integration were driven by my understanding of the requirements. All AI-assisted code was reviewed and adapted before inclusion.
