/**
 * Database layer — a single file that owns the SQLite connection, schema, and seed data.
 *
 * Why one file? The goal is readability: anyone can open this file and see
 * every table, every query, and the seed data in one place. No ORM magic,
 * no migration framework — just plain SQL.
 */

import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// ─── Connection ──────────────────────────────────────────────────────
// Store the DB file next to the project root so it persists across restarts
// but stays out of `src/`. In production you'd point this at a real path.
const DB_PATH = path.join(process.cwd(), "data", "lld-cipher.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    // Ensure the data directory exists
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    _db = new Database(DB_PATH);
    // WAL mode gives us better concurrent read performance
    _db.pragma("journal_mode = WAL");
    // Foreign keys are off by default in SQLite — turn them on
    _db.pragma("foreign_keys = ON");

    initSchema(_db);
    seedProblems(_db);
  }
  return _db;
}

// ─── Schema ──────────────────────────────────────────────────────────
// We use IF NOT EXISTS so the app is idempotent on restart.
function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS problems (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      -- Store requirements and constraints as JSON arrays.
      -- SQLite has solid JSON support, and for a read-heavy seed table
      -- this is simpler than a join table.
      requirements TEXT NOT NULL DEFAULT '[]',
      constraints  TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id         TEXT PRIMARY KEY,
      problem_id TEXT NOT NULL REFERENCES problems(id),
      status     TEXT NOT NULL DEFAULT 'InProgress',
      -- Store the draft submission content as JSON so we can save/restore
      -- without a separate table. Only promoted to a Submission row on submit.
      draft_content TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id          TEXT PRIMARY KEY,
      attempt_id  TEXT NOT NULL UNIQUE REFERENCES attempts(id),
      content     TEXT NOT NULL,  -- JSON: StructuredTextSubmission
      submitted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id              TEXT PRIMARY KEY,
      submission_id   TEXT NOT NULL REFERENCES submissions(id),
      status          TEXT NOT NULL DEFAULT 'Pending',
      results         TEXT NOT NULL DEFAULT '[]',  -- JSON: EvaluationResult[]
      overall_summary TEXT NOT NULL DEFAULT '',
      error_message   TEXT,
      created_at      TEXT NOT NULL
    );
  `);
}

// ─── Seed Data ───────────────────────────────────────────────────────
// Only insert if the problems table is empty (first run).
function seedProblems(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM problems").get() as {
    cnt: number;
  };
  if (count.cnt > 0) return;

  const problems = [
    {
      id: "parking-lot",
      title: "Design a Parking Lot",
      description:
        "Design an object-oriented system for a multi-level parking lot that can park different types of vehicles. The system should track available spots, handle entry/exit, and calculate parking fees based on duration and vehicle type.",
      requirements: [
        "Support multiple vehicle types (motorcycle, car, bus) with different space requirements",
        "Track available and occupied spots across multiple floors",
        "Handle vehicle entry: find an appropriate spot and assign it",
        "Handle vehicle exit: free the spot and calculate the parking fee",
        "Support different pricing strategies based on vehicle type and duration",
        "Display real-time availability per floor",
      ],
      constraints: [
        "A bus takes up 5 consecutive regular spots; a motorcycle takes 1 compact spot",
        "The system should handle concurrent entry/exit without double-booking a spot",
        "Fees must be calculated to the minute, not rounded to the hour",
      ],
    },
    {
      id: "elevator-system",
      title: "Design an Elevator System",
      description:
        "Design the control system for a building with multiple elevators. The system should efficiently handle floor requests from both inside elevators and from hallway buttons, minimizing wait times and optimizing elevator movement.",
      requirements: [
        "Support multiple elevators serving N floors",
        "Handle internal requests (passenger selects a destination floor)",
        "Handle external requests (hallway up/down button presses)",
        "Implement an efficient scheduling/dispatching algorithm",
        "Track and display each elevator's current floor and direction",
      ],
      constraints: [
        "Each elevator has a maximum weight capacity",
        "Handle concurrent requests from multiple floors without starvation",
        "Elevators should avoid unnecessary direction changes (minimize travel)",
      ],
    },
    {
      id: "vending-machine",
      title: "Design a Vending Machine",
      description:
        "Design a vending machine system that manages product inventory, accepts multiple payment methods, handles product selection, and dispenses items with correct change. The system should gracefully handle edge cases like insufficient funds or out-of-stock items.",
      requirements: [
        "Maintain an inventory of products with names, prices, and quantities",
        "Accept coins and bills; track inserted amount",
        "Allow product selection and validate sufficient payment",
        "Dispense the selected product and return correct change",
        "Support adding/restocking products (admin operation)",
        "Display current product availability and prices",
      ],
      constraints: [
        "The machine has a finite supply of each coin denomination for making change",
        "If exact change cannot be made, the transaction must be cancelled and all money returned",
        "The machine must transition through clear states: Idle → Accepting Money → Dispensing → Returning Change",
      ],
    },
    {
      id: "library-management",
      title: "Design a Library Management System",
      description:
        "Design a system to manage a library's book inventory, member accounts, borrowing/returning workflows, and overdue fine calculation. The system should support searching the catalog, placing holds on unavailable books, and tracking borrowing history.",
      requirements: [
        "Manage a catalog of books with title, author, ISBN, and copy count",
        "Support member registration with borrowing limits",
        "Handle book checkout: verify availability, assign copy to member, set due date",
        "Handle book return: update availability, calculate overdue fines if applicable",
        "Allow members to search the catalog by title, author, or ISBN",
        "Support placing holds on books that are currently checked out",
      ],
      constraints: [
        "A member can borrow at most 5 books at a time",
        "Overdue fines accrue daily and must be paid before new checkouts",
        "When a held book is returned, the hold queue determines who gets it next (FIFO)",
      ],
    },
  ];

  const insert = db.prepare(`
    INSERT INTO problems (id, title, description, requirements, constraints)
    VALUES (@id, @title, @description, @requirements, @constraints)
  `);

  const insertAll = db.transaction(() => {
    for (const p of problems) {
      insert.run({
        id: p.id,
        title: p.title,
        description: p.description,
        requirements: JSON.stringify(p.requirements),
        constraints: JSON.stringify(p.constraints),
      });
    }
  });

  insertAll();
}

// ─── Query helpers ───────────────────────────────────────────────────
// Each function does one thing. Raw SQL, explicit types, no magic.

export function getAllProblems() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM problems").all() as Array<{
    id: string;
    title: string;
    description: string;
    requirements: string;
    constraints: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    requirements: JSON.parse(r.requirements) as string[],
    constraints: JSON.parse(r.constraints) as string[],
  }));
}

export function getProblemById(id: string) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM problems WHERE id = ?").get(id) as
    | {
        id: string;
        title: string;
        description: string;
        requirements: string;
        constraints: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    requirements: JSON.parse(row.requirements) as string[],
    constraints: JSON.parse(row.constraints) as string[],
  };
}

export function createAttempt(problemId: string) {
  const db = getDb();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO attempts (id, problem_id, status, created_at) VALUES (?, ?, 'InProgress', ?)"
  ).run(id, problemId, createdAt);
  return { id, problemId, status: "InProgress" as const, createdAt };
}

export function getAttemptById(id: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM attempts WHERE id = ?")
    .get(id) as
    | {
        id: string;
        problem_id: string;
        status: string;
        draft_content: string | null;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    problemId: row.problem_id,
    status: row.status,
    draftContent: row.draft_content ? JSON.parse(row.draft_content) : null,
    createdAt: row.created_at,
  };
}

export function updateAttemptStatus(id: string, status: string) {
  const db = getDb();
  db.prepare("UPDATE attempts SET status = ? WHERE id = ?").run(status, id);
}

export function updateAttemptDraft(id: string, draftContent: object) {
  const db = getDb();
  db.prepare("UPDATE attempts SET draft_content = ? WHERE id = ?").run(
    JSON.stringify(draftContent),
    id
  );
}

export function createSubmission(
  attemptId: string,
  content: object
) {
  const db = getDb();
  const id = uuidv4();
  const submittedAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO submissions (id, attempt_id, content, submitted_at) VALUES (?, ?, ?, ?)"
  ).run(id, attemptId, JSON.stringify(content), submittedAt);
  return { id, attemptId, content, submittedAt };
}

export function getSubmissionByAttemptId(attemptId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM submissions WHERE attempt_id = ?")
    .get(attemptId) as
    | {
        id: string;
        attempt_id: string;
        content: string;
        submitted_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    attemptId: row.attempt_id,
    content: JSON.parse(row.content),
    submittedAt: row.submitted_at,
  };
}

export function createEvaluation(submissionId: string) {
  const db = getDb();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO evaluations (id, submission_id, status, created_at) VALUES (?, ?, 'Pending', ?)"
  ).run(id, submissionId, createdAt);
  return { id, submissionId, status: "Pending" as const, createdAt };
}

export function updateEvaluation(
  id: string,
  data: {
    status: string;
    results: object[];
    overallSummary: string;
    errorMessage?: string;
  }
) {
  const db = getDb();
  db.prepare(
    `UPDATE evaluations 
     SET status = ?, results = ?, overall_summary = ?, error_message = ?
     WHERE id = ?`
  ).run(
    data.status,
    JSON.stringify(data.results),
    data.overallSummary,
    data.errorMessage || null,
    id
  );
}

export function getEvaluationBySubmissionId(submissionId: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM evaluations WHERE submission_id = ?")
    .get(submissionId) as
    | {
        id: string;
        submission_id: string;
        status: string;
        results: string;
        overall_summary: string;
        error_message: string | null;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    submissionId: row.submission_id,
    status: row.status,
    results: JSON.parse(row.results),
    overallSummary: row.overall_summary,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export function getAttemptsByProblemId(problemId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM attempts WHERE problem_id = ? ORDER BY created_at DESC"
    )
    .all(problemId) as Array<{
    id: string;
    problem_id: string;
    status: string;
    draft_content: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    problemId: r.problem_id,
    status: r.status,
    draftContent: r.draft_content ? JSON.parse(r.draft_content) : null,
    createdAt: r.created_at,
  }));
}

/**
 * Get the evaluation for a given attempt, if one exists.
 * Joins through submissions to find the evaluation.
 */
export function getEvaluationByAttemptId(attemptId: string) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT e.* FROM evaluations e
       JOIN submissions s ON e.submission_id = s.id
       WHERE s.attempt_id = ?`
    )
    .get(attemptId) as
    | {
        id: string;
        submission_id: string;
        status: string;
        results: string;
        overall_summary: string;
        error_message: string | null;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    submissionId: row.submission_id,
    status: row.status,
    results: JSON.parse(row.results),
    overallSummary: row.overall_summary,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}
