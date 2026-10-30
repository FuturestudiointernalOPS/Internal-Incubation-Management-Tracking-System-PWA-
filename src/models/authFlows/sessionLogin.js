import db from "@/lib/db";

/**
 * Auth flows model — session-login identity searches and self-heal
 * (REPOSITORY layer).
 *
 * The contact/team/family identity lookups, the enrollment probes and the
 * last-login column self-heal used by `/api/auth/session-login`, split verbatim
 * out of `models/authFlows.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Contact lookup by email OR cid (session-login identity search). */
export async function getContactByEmailOrCid(identifier) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE (email = ? OR cid = ?) AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [identifier, identifier],
  });
}

/** Team login lookup by team username (session-login fallback). */
export async function getTeamByUsernameForSessionLogin(teamUsername) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
    args: [teamUsername],
  });
}

/** Family/entity login lookup by shared email (session-login fallback). */
export async function getFamilyBySharedEmailForSessionLogin(sharedEmail) {
  return db.execute({
    sql: "SELECT * FROM families WHERE shared_email = ? LIMIT 1",
    args: [sharedEmail],
  });
}

/** Existence probe — participant_programs row for a contact (session-login). */
export async function getParticipantProgramRecordForSessionLogin(participantId) {
  return db.execute({
    sql: "SELECT 1 FROM participant_programs WHERE participant_id = ?",
    args: [participantId],
  });
}

/** Existence probe — LMS enrollment for a contact (session-login). */
export async function getLmsEnrollmentRecordForSessionLogin(userCid) {
  return db.execute({
    sql: "SELECT 1 FROM lms_enrollments WHERE user_cid = ? LIMIT 1",
    args: [userCid],
  });
}

// A venture-membership existence probe used to live here, and it was wrong: it
// looked in ONE of the two identity columns and ignored removals, so a person
// removed from a Venture (or recorded under the other column) was judged to have
// no relationship at all. The sign-in reads the memberships properly instead
// (getVentureMembershipsForContact in the contacts model) — deliberately not
// re-created here, because a probe that looks right and answers wrongly is worse
// than the extra column.

/** Self-heal — ensure the contacts.last_login_at column exists. */
export async function ensureContactsLastLoginColumn() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
  );
}

/** Self-heal — ensure the contacts.login_count column exists. */
export async function ensureContactsLoginCountColumn() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0",
  );
}

/** Record a successful contact login (last_login_at + login_count bump). */
export async function recordContactLoginActivity(cid) {
  return db.execute({
    sql: "UPDATE contacts SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE cid = ?",
    args: [cid],
  });
}
