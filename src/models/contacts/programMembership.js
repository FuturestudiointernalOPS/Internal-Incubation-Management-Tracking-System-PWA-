import db from "@/lib/db";

/**
 * Contact ↔ program / venture membership store — the enrollment writes, the
 * membership probes and the venture-membership reads.
 *
 * Split out of `src/models/contacts.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/contacts` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── POST /api/contacts — enrollment ──────────────────────────────────────────

/** Enroll a contact in a program (idempotent) — registration flow. */
export async function assignContactToProgram(cid, pid) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                    VALUES (?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [cid, pid],
  });
}

/** Write the participant_programs audit row for an initial assignment. */
export async function createParticipantProgramAudit(cid, pid, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                    VALUES (?, ?, 'assigned', ?)`,
    args: [cid, pid, performedBy],
  });
}

// ── PUT /api/contacts — program list sync ────────────────────────────────────

/** Remove every participant_programs row for a contact (role promotion). */
export async function deleteContactPrograms(cid) {
  return db.execute({
    sql: "DELETE FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/** Verify a program exists before assigning a contact to it. */
export async function getProgramById(id) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [id],
  });
}

/** Remove program memberships not present in the new program list. */
export async function removeContactProgramsExcept(cid, programIds) {
  const placeholders = programIds.map(() => "?").join(",");
  return db.execute({
    sql: `DELETE FROM participant_programs WHERE participant_id = ? AND program_id NOT IN (${placeholders})`,
    args: [cid, ...programIds],
  });
}

/** Remove every participant_programs row for a contact (explicit empty list). */
export async function clearContactPrograms(cid) {
  return db.execute({
    sql: "DELETE FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/** Enroll a contact in a program (idempotent) — PUT program_ids sync flow. */
export async function addContactProgramMembership(cid, pid) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                  VALUES (?, ?)
                  ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [cid, pid],
  });
}

/** Write the participant_programs audit row for a synced assignment. */
export async function recordParticipantProgramAudit(cid, pid, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                  VALUES (?, ?, 'assigned', ?)`,
    args: [cid, pid, performedBy],
  });
}

/** Enroll a contact in a single program (idempotent) — PUT single fallback. */
export async function ensureContactProgramMembership(cid, pid) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                VALUES (?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [cid, pid],
  });
}

// ── merge — program reassignment ─────────────────────────────────────────────

/** Reassign all participant_programs rows to the surviving contact. */
export async function reassignContactPrograms(survivorCid, duplicateCid) {
  return db.execute({
    sql: "UPDATE participant_programs SET participant_id = ? WHERE participant_id = ?",
    args: [survivorCid, duplicateCid],
  });
}

// ── membership probes (search / relationships) ───────────────────────────────

/** True if the contact holds a participant_programs row in the program. */
export async function isParticipantInProgram(cid, programId) {
  return db.execute({
    sql: `SELECT 1 FROM participant_programs
                WHERE participant_id = ? AND CAST(program_id AS TEXT) = ?
                LIMIT 1`,
    args: [cid, programId],
  });
}

/** True if the contact is a venture founder whose venture is in the program. */
export async function isVentureFounderInProgram(cid, programId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_members vm
                JOIN ventures v ON v.venture_id = vm.venture_id
                WHERE (vm.user_cid = ? OR vm.contact_id = ?)
                  AND CAST(v.program_id AS TEXT) = ?
                LIMIT 1`,
    args: [cid, cid, programId],
  });
}

// ── GET /api/contacts/[cid]/timeline — PM scoping ────────────────────────────

/** Program ids managed by a program manager (timeline scoping). */
export async function getProgramIdsForPm(cid) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ?",
    args: [cid],
  });
}

// ── GET /api/me/relationships ────────────────────────────────────────────────

/** True if the contact has any participant_programs membership row. */
export async function hasParticipantProgramMembership(cid) {
  return db.execute({
    sql: "SELECT 1 FROM participant_programs WHERE participant_id = ? LIMIT 1",
    args: [cid],
  });
}

/** True if the contact has a v2_participants record (user_id or email). */
export async function hasV2ParticipantRecord(cid) {
  return db.execute({
    sql: "SELECT 1 FROM v2_participants WHERE user_id = ? OR LOWER(email) = LOWER((SELECT email FROM contacts WHERE cid = ?)) LIMIT 1",
    args: [cid, cid],
  });
}

/**
 * Active venture memberships for a contact, newest join first.
 * Removed memberships are excluded — a removed row is not a relationship.
 */
export async function getVentureMembershipsForContact(cid) {
  return db.execute({
    sql: `SELECT v.venture_id, COALESCE(v.company_name, v.name) AS name, v.status,
                 vm.member_type,
                 COALESCE(vm.is_owner, false) AS is_owner
              FROM venture_members vm
              LEFT JOIN ventures v ON v.venture_id = vm.venture_id
              WHERE (vm.user_cid = ? OR vm.contact_id = ?) AND vm.removed_at IS NULL
              ORDER BY vm.joined_at DESC`,
    args: [cid, cid],
  });
}
