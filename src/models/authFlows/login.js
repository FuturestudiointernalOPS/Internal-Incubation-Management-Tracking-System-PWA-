import db from "@/lib/db";

/**
 * Auth flows model — legacy login identity searches and self-heal
 * (REPOSITORY layer).
 *
 * The contact/team/family identity lookups, the enrollment probes and the
 * last-login/activation column self-heal used by `/api/auth/login`, split
 * verbatim out of `models/authFlows.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Contact lookup by email OR id (legacy login identity search). */
export async function getContactByEmailOrId(identifier) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE (email = ? OR id = ?) AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [identifier, identifier],
  });
}

/** Team login lookup by team username (legacy login fallback). */
export async function getTeamByUsernameForLogin(teamUsername) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
    args: [teamUsername],
  });
}

/** Family/entity login lookup by shared email (legacy login fallback). */
export async function getFamilyBySharedEmailForLogin(sharedEmail) {
  return db.execute({
    sql: "SELECT * FROM families WHERE shared_email = ? LIMIT 1",
    args: [sharedEmail],
  });
}

/** Existence probe — participant_programs row for a contact (legacy login). */
export async function getParticipantProgramRecordForLogin(participantId) {
  return db.execute({
    sql: "SELECT 1 FROM participant_programs WHERE participant_id = ?",
    args: [participantId],
  });
}

/** Existence probe — LMS enrollment for a contact (legacy login). */
export async function getLmsEnrollmentRecordForLogin(userCid) {
  return db.execute({
    sql: "SELECT 1 FROM lms_enrollments WHERE user_cid = ? LIMIT 1",
    args: [userCid],
  });
}

/** Existence probe — venture membership for a contact (legacy login). */
export async function getVentureMembershipRecordForLogin(userCid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE user_cid = ? LIMIT 1",
    args: [userCid],
  });
}

/** Self-heal — ensure the contacts.activated_at column exists. */
export async function ensureContactsActivatedAtColumn() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ",
  );
}

/** Self-heal — ensure the contacts.last_login_at column exists (legacy login). */
export async function ensureContactsLastLoginColumnForLogin() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
  );
}

/** Self-heal — ensure the contacts.login_count column exists (legacy login). */
export async function ensureContactsLoginCountColumnForLogin() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0",
  );
}

/** Record a successful contact login (legacy login activity tracking). */
export async function recordContactLoginActivityForLogin(cid) {
  return db.execute({
    sql: "UPDATE contacts SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE cid = ?",
    args: [cid],
  });
}
