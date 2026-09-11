# LLD Practice Platform

A full-stack web app for practicing Low-Level Design problems with rubric-based feedback. Write a structured design submission and get evaluated by both a deterministic completeness checker and an OpenAI-powered design critique.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up your OpenAI API key
cp .env.example .env.local
# Edit .env.local and add your OpenAI API key

# 3. Run the dev server
npm run dev

# 4. Open http://localhost:3000
```

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **SQLite** via `better-sqlite3` — plain SQL, no ORM
- **OpenAI API** (`gpt-4o-mini`) for design critique
- **Tailwind CSS** for styling
- **Vitest** for testing

## Project Structure

```
src/
├── app/                          # Next.js App Router pages & API routes
│   ├── page.tsx                  # Home — problem list
│   ├── problems/[id]/
│   │   ├── page.tsx              # Problem detail
│   │   └── history/page.tsx      # Attempt history
│   ├── attempts/[id]/
│   │   ├── page.tsx              # Attempt workspace
│   │   └── AttemptWorkspace.tsx  # Client component (form/poll/feedback)
│   └── api/
│       ├── problems/             # GET list, GET by ID
│       └── attempts/             # GET, PATCH, POST submit, POST retry
├── lib/
│   ├── db.ts                     # SQLite schema, seed data, query helpers
│   └── domain/
│       ├── types.ts              # All domain types
│       ├── rubric.ts             # 6 rubric criteria
│       ├── evaluator.ts          # Evaluator interface + implementations
│       ├── orchestrator.ts       # Evaluation orchestrator
│       └── __tests__/
│           └── evaluator.test.ts # 6 tests
```

## How It Works

1. **Pick a problem** from the home page (4 seeded problems)
2. **Write your design** in a structured form (assumptions, classes, relationships, extensibility)
3. **Submit** — the server runs evaluation in the background:
   - **Deterministic check** first: are all sections filled? At least 2 classes with responsibilities?
   - If that passes, **LLM evaluator** scores against 6 rubric criteria
4. **View feedback** with per-criterion scores (0-5), evidence, concerns, and suggestions
5. **Retry** if the LLM call failed (without re-typing your submission)
6. **Track progress** across attempts in the history view

## Running Tests

```bash
npm test
```

Tests cover:
1. DeterministicEvaluator passes on well-formed submissions
2. DeterministicEvaluator fails on empty sections
3. DeterministicEvaluator fails on missing class responsibilities
4. Orchestrator skips LLM when deterministic fails
5. Orchestrator preserves deterministic results on LLM failure
6. Attempt status machine (`canSubmit` helper)

## Key Design Decisions

- **Deterministic evaluator runs first** to save API costs and give instant structural feedback
- **Deterministic failure is "Completed" not "Failed"** — it's valid, useful feedback
- **LLM failure preserves deterministic results** — don't throw away useful data
- **Fire-and-forget background evaluation** — simple `void` call, frontend polls every 2s
- **No ORM** — plain SQL in one file for maximum readability
- **One file per concept** — types, evaluator, orchestrator, rubric each in their own file
