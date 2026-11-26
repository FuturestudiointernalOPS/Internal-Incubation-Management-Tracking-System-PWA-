import db from "@/lib/db";

/**
 * The stored executive synthesis for one form run.
 *
 * A synthesis is expensive (a model call) and deterministic for a given set of
 * responses, so it is written once and reused. The fingerprint that decides
 * whether a stored copy is still valid is carried on the row itself:
 *
 *   submissions_count     how many responses the synthesis was written from
 *   latest_submission_at  the newest response at that moment
 *
 * Both change when the run's data changes; either changing makes the row stale
 * and a new synthesis is generated. An EDIT to an existing response does not
 * change the fingerprint — a portfolio brief is not invalidated by a corrected
 * spelling, and regenerating on every keystroke would be worse than a slightly
 * dated summary.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS platform_run_analytics (
    run_id INTEGER PRIMARY KEY,
    submissions_count INTEGER NOT NULL DEFAULT 0,
    latest_submission_at TEXT,
    payload JSONB NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`;

export async function ensureRunAnalyticsTable() {
  return db.execute(SCHEMA);
}

export function selectRunAnalytics(runId) {
  return db.execute({
    sql: `SELECT submissions_count, latest_submission_at, payload, generated_at
            FROM platform_run_analytics
           WHERE run_id = ?`,
    args: [runId],
  });
}

export function upsertRunAnalytics({ runId, submissionsCount, latestSubmissionAt, payload }) {
  return db.execute({
    sql: `INSERT INTO platform_run_analytics
            (run_id, submissions_count, latest_submission_at, payload, generated_at)
          VALUES (?, ?, ?, ?::jsonb, NOW())
          ON CONFLICT (run_id) DO UPDATE SET
            submissions_count = EXCLUDED.submissions_count,
            latest_submission_at = EXCLUDED.latest_submission_at,
            payload = EXCLUDED.payload,
            generated_at = NOW()`,
    args: [runId, submissionsCount, latestSubmissionAt || null, JSON.stringify(payload)],
  });
}
