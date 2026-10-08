import db from "@/lib/db";

/**
 * ProgramMembership model — PM-scoped program-staff management (REPOSITORY
 * layer).
 *
 * The v2_program_staff writes/reads, the conflict guards and the generalized
 * contact_roles mirror used by `/api/v2/program-staff`, split verbatim out of
 * `models/programMembership.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ────────────────────────────────────────────────────────────
// /api/v2/program-staff — PM-scoped program-staff management
// ────────────────────────────────────────────────────────────

/** Insert a facilitator timeline event (contact_timeline). */
export async function insertV2FacilitatorTimelineEvent(staffId, eventType, description, programIdStr, actorCid, metadataJson) {
  return db.execute({
    sql: "INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata) VALUES (?, ?, ?, 'programs', ?, ?, ?::jsonb)",
    args: [staffId, eventType, description, programIdStr, actorCid, metadataJson],
  });
}

/**
 * Program-staff assignment rows (optionally filtered by staff id or program
 * id — the WHERE clause is appended exactly like the original controller did).
 */
export async function listV2ProgramStaffAssignments(staffId, programId) {
  let sql = `
      SELECT ps.*, p.name as program_name, p.status as program_status
      FROM v2_program_staff ps
      JOIN v2_programs p ON ps.program_id = p.id
    `;
  let args = [];

  if (staffId) {
    sql += " WHERE ps.staff_id = ?";
    args = [staffId];
  } else if (programId) {
    sql += " WHERE ps.program_id = ?";
    args = [programId];
  }

  return db.execute({ sql, args });
}

/** Contact email for a facilitator role-conflict check. */
export async function getContactEmailForRoleConflict(staffId) {
  return db.execute({
    sql: "SELECT email FROM contacts WHERE cid = ? LIMIT 1",
    args: [staffId],
  });
}

/**
 * Whether a staff member is already a participant in the program (role
 * conflict guard: facilitator vs participant_programs / v2_participants).
 */
export async function findParticipantFacilitatorConflict(staffId, programId, contactEmail) {
  return db.execute({
    sql: `SELECT 1 FROM participant_programs WHERE participant_id::text = ? AND program_id::text = ?
              UNION
              SELECT 1 FROM v2_participants WHERE program_id::text = ? AND (email = ? OR user_id = ?)
              LIMIT 1`,
    args: [String(staffId), String(programId), String(programId), contactEmail, String(staffId)],
  });
}

/** Insert (or update on conflict) a v2_program_staff assignment. */
export async function upsertV2ProgramStaffAssignment(programId, staffId, role, permissionsJson) {
  return db.execute({
    sql: "INSERT INTO v2_program_staff (program_id, staff_id, role, permissions) VALUES (?, ?, ?, ?::jsonb) ON CONFLICT (program_id, staff_id) DO UPDATE SET role = EXCLUDED.role, permissions = COALESCE(EXCLUDED.permissions, v2_program_staff.permissions), updated_at = NOW() RETURNING id",
    args: [programId, staffId, role, permissionsJson],
  });
}

/**
 * Mirror a program-staff assignment into the generalized contact_roles record
 * (additive + idempotent: skips rows already current for this program/role).
 */
export async function insertGeneralizedProgramAssignmentV2(role, programIdStr, permissionsJson, actorCid, staffRef) {
  return db.execute({
    sql: `INSERT INTO contact_roles
                (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
              SELECT c.cid, ?, 'program', ?, true, ?, '{"type":"program"}'::jsonb, 'active', ?::jsonb, ?
              FROM contacts c
              WHERE (c.cid = ? OR LOWER(c.email) = LOWER(?))
                AND c.deleted = 0
                AND NOT EXISTS (
                  SELECT 1 FROM contact_roles cr
                  WHERE cr.contact_cid = c.cid
                    AND cr.role = ?
                    AND cr.context_type = 'program'
                    AND cr.context_id = ?
                    AND cr.is_current = true
                )`,
    args: [role, programIdStr, role, permissionsJson, actorCid, staffRef, staffRef, role, programIdStr],
  });
}

/** Current role + program id of a v2_program_staff row (scope check). */
export async function getProgramStaffTargetForScopeCheck(id) {
  return db.execute({
    sql: "SELECT role, program_id FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
}

/**
 * Update the mutable fields of a v2_program_staff row. `fields` holds the
 * `SET` fragments and `args` the values (id pushed last), exactly as built
 * by the controller.
 */
export async function updateV2ProgramStaffAssignment(fields, args) {
  return db.execute({
    sql: `UPDATE v2_program_staff SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Full editable assignment row (role + permissions) by primary key. */
export async function getV2ProgramStaffAssignmentWithPermissions(id) {
  return db.execute({
    sql: "SELECT staff_id, program_id, role, permissions FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
}

/** Resolve a staff ref (cid or email) to a contact cid (mirror sync path). */
export async function getV2ContactCidForProgramRoleMirror(staffRef) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
    args: [staffRef, staffRef],
  });
}

/** Update the mirrored contact_roles row to the final assignment state. */
export async function updateV2MirroredProgramContactRole(finalRole, permissionsJson, contactCid, programIdStr) {
  return db.execute({
    sql: `UPDATE contact_roles
                  SET title = ?, capability_overrides = ?::jsonb
                  WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
    args: [finalRole, permissionsJson, contactCid, programIdStr],
  });
}

/** Insert the generalized contact_roles row when no current mirror existed. */
export async function insertV2MirroredProgramContactRole(contactCid, finalRole, programIdStr, permissionsJson) {
  return db.execute({
    sql: `INSERT INTO contact_roles
                      (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
                    VALUES (?, ?, 'program', ?, true, ?, '{"type":"program"}'::jsonb, 'active', ?::jsonb, 'system')`,
    args: [contactCid, finalRole, programIdStr, finalRole, permissionsJson],
  });
}

/** Assignment identity (staff_id, program_id) before deleting it. */
export async function getV2ProgramStaffAssignmentForDelete(id) {
  return db.execute({
    sql: "SELECT staff_id, program_id FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
}

/** Delete a v2_program_staff assignment by primary key. */
export async function deleteV2ProgramStaffAssignmentById(id) {
  return db.execute({
    sql: "DELETE FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
}

/** Resolve a staff ref (cid or email) to a contact cid (mirror teardown path). */
export async function getV2ContactCidForProgramRoleCleanup(staffRef) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
    args: [staffRef, staffRef],
  });
}

/** Mark the current mirrored contact_roles row ended/removed. */
export async function endV2MirroredProgramContactRole(contactCid, programIdStr) {
  return db.execute({
    sql: `UPDATE contact_roles
                  SET is_current = false, ended_at = NOW(), status = 'removed'
                  WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
    args: [contactCid, programIdStr],
  });
}
