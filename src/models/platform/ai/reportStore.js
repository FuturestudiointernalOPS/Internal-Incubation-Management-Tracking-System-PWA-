/**
 * Platform AI — submission report store (REPOSITORY layer).
 *
 * Every statement behind a Run's AI-composed report: the on-demand table, the
 * keyed lookup of the stored document and the insert that records it with what
 * produced it. The decisions (the prompt, the parsing and validation, what the
 * report's identity is) live in `@/services/platform/report`.
 *
 * SQL is byte-identical to what used to sit inline in
 * `models/platform/ai/report.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db, { initDb } from "@/lib/db";

/**
 * The report store, created on demand.
 *
 * The migration file ships this table (src/migrations/047_submission_reports.sql),
 * but a run whose instruction was configured before that file is applied must not
 * lose its report. Like the platform's other `ensure*` helpers this issues
 * `IF NOT EXISTS` DDL, which the db engine answers once per process thereafter.
 */
let reportsTableEnsured = false;
export async function ensureSubmissionReportsTable() {
  if (reportsTableEnsured) return;
  await initDb();
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS platform_submission_reports (
            id SERIAL PRIMARY KEY,
            submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
            evaluation_id INTEGER,
            decision TEXT,
            instruction_hash TEXT NOT NULL,
            instruction_snapshot TEXT,
            reference_snapshot TEXT,
            lang TEXT,
            document JSONB NOT NULL,
            model TEXT DEFAULT 'deepseek-chat',
            generated_at TIMESTAMP DEFAULT NOW()
          )`,
    args: [],
  });
  // A database created by the first version of this table has no room for the
  // reference document, and the INSERT below names that column.
  await db.execute({
    sql: "ALTER TABLE platform_submission_reports ADD COLUMN IF NOT EXISTS reference_snapshot TEXT",
    args: [],
  });
  await db.execute({
    sql: "CREATE INDEX IF NOT EXISTS idx_submission_reports_lookup ON platform_submission_reports (submission_id, generated_at DESC)",
    args: [],
  });
  reportsTableEnsured = true;
}

/**
 * The stored report row matching the exact key, or none.
 *
 * Null means "no value for this dimension", which is a distinct, storable state
 * (a submission with no evaluation, no decision or no language) — hence the
 * `IS NULL` branches rather than a coalesced value.
 */
export function selectStoredReport({ submissionId, evaluationId, decision, instructionHash, lang }) {
  const conditions = ["submission_id = ?", "instruction_hash = ?"];
  const args = [parseInt(submissionId), instructionHash];
  if (evaluationId == null) conditions.push("evaluation_id IS NULL");
  else {
    conditions.push("evaluation_id = ?");
    args.push(parseInt(evaluationId));
  }
  if (decision == null) conditions.push("decision IS NULL");
  else {
    conditions.push("decision = ?");
    args.push(decision);
  }
  if (lang == null) conditions.push("lang IS NULL");
  else {
    conditions.push("lang = ?");
    args.push(lang);
  }

  return db.execute({
    sql: `SELECT document, generated_at FROM platform_submission_reports
          WHERE ${conditions.join(" AND ")}
          ORDER BY generated_at DESC LIMIT 1`,
    args,
  });
}

/** Persist a composed report (with the model that wrote it), returning the new row. */
export function insertStoredReportRow({
  submissionId,
  evaluationId,
  decision,
  instructionHash,
  instructionSnapshot,
  referenceSnapshot,
  lang,
  document,
  model,
}) {
  return db.execute({
    sql: `INSERT INTO platform_submission_reports
            (submission_id, evaluation_id, decision, instruction_hash, instruction_snapshot, lang, reference_snapshot, document, model)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id, generated_at`,
    args: [
      parseInt(submissionId),
      evaluationId == null ? null : parseInt(evaluationId),
      decision ?? null,
      instructionHash,
      instructionSnapshot ?? null,
      lang ?? null,
      referenceSnapshot ?? null,
      JSON.stringify(document),
      model,
    ],
  });
}
