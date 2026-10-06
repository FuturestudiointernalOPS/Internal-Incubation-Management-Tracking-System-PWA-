import db from "@/lib/db";

/**
 * Forms & submissions model — column self-healing (REPOSITORY layer).
 *
 * The idempotent ALTER TABLE guards run before the routes read the additive
 * columns. Split verbatim out of `models/forms/submissions.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Migration safety: make sure v2_submissions.team_id exists (POST). */
export async function ensureSubmissionsTeamIdColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS team_id TEXT");
}

/** Migration safety: role-lock column must exist before PATCH reads it. */
export async function ensureSubmissionsRoleLockColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS reviewed_by_role TEXT DEFAULT NULL");
}

/** Migration safety: v2_submissions.score column. */
export async function ensureSubmissionsScoreColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL");
}

/** Migration safety: v2_submissions.reviewed_by_role column (review path). */
export async function ensureSubmissionsReviewedByRoleColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS reviewed_by_role TEXT DEFAULT NULL");
}

/** Migration safety: v2_submissions.updated_at column. */
export async function ensureSubmissionsUpdatedAtColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()");
}

/** Migration safety: v2_followups.participant_cid column. */
export async function ensureSubmissionsFollowupsParticipantCidColumn() {
  return db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS participant_cid TEXT DEFAULT NULL");
}

/** Migration safety: make sure v2_submissions.team_id exists (GET). */
export async function ensureSubmissionsTeamIdColumnForListing() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS team_id TEXT");
}

/** Migration safety: score columns before an evaluation write (PUT). */
export async function ensureSubmissionScoresColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL");
}

/** Migration safety: evaluation_score column before an evaluation write (PUT). */
export async function ensureSubmissionEvaluationScoreColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS evaluation_score INTEGER DEFAULT NULL");
}
