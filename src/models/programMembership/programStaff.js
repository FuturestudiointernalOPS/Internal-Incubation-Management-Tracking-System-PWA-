import db from "@/lib/db";

/**
 * ProgramMembership model — Super Admin program-staff assignment CRUD
 * (REPOSITORY layer).
 *
 * The v2_program_staff writes/reads and the generalized contact_roles mirror
 * used by `/api/program-staff`, split verbatim out of
 * `models/programMembership.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ────────────────────────────────────────────────────────────
// /api/program-staff — Super Admin program-staff assignment CRUD
// ────────────────────────────────────────────────────────────

/** Insert a facilitator timeline event (contact_timeline). */
export async function insertFacilitatorTimelineEvent(staffId, eventType, description, programIdStr, actorCid, metadataJson) {
  return db.execute({
    sql: "INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata) VALUES (?, ?, ?, 'programs', ?, ?, ?::jsonb)",
    args: [staffId, eventType, description, programIdStr, actorCid, metadataJson],
  });
}

/**
 * Program-staff assignment rows (optionally filtered by staff id or program
 * id — the WHERE clause is appended exactly like the original controller did).
 */
export async function listProgramStaffAssignments(staffId, programId) {
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

/** Insert (or update on conflict) a v2_program_staff assignment. */
export async function upsertProgramStaffAssignment(programId, staffId, role, permissionsJson) {
  return db.execute({
    sql: "INSERT INTO v2_program_staff (program_id, staff_id, role, permissions) VALUES (?, ?, ?, ?::jsonb) ON CONFLICT (program_id, staff_id) DO UPDATE SET role = EXCLUDED.role, permissions = COALESCE(EXCLUDED.permissions, v2_program_staff.permissions), updated_at = NOW() RETURNING id",
    args: [programId, staffId, role, permissionsJson],
  });
}

/**
 * Mirror a program-staff assignment into the generalized contact_roles record
 * (additive + idempotent: skips rows already current for this program/role).
 */
export async function insertGeneralizedProgramAssignment(role, programIdStr, permissionsJson, actorCid, staffRef) {
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

/**
 * Update the mutable fields of a v2_program_staff row. `fields` holds the
 * `SET` fragments (`"role = ?"`, `"permissions = ?"`, `"updated_at = NOW()"`)
 * and `args` the values (id pushed last), exactly as built by the controller.
 */
export async function updateProgramStaffAssignment(fields, args) {
  return db.execute({
    sql: `UPDATE v2_program_staff SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Full editable assignment row (role + permissions) by primary key. */
export async function getProgramStaffAssignmentWithPermissions(id) {
  return db.execute({
    sql: "SELECT staff_id, program_id, role, permissions FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
}

/** Resolve a staff ref (cid or email) to a contact cid (mirror sync path). */
export async function getContactCidForProgramRoleMirror(staffRef) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
    args: [staffRef, staffRef],
  });
}

/** Update the mirrored contact_roles row to the final assignment state. */
export async function updateMirroredProgramContactRole(finalRole, permissionsJson, contactCid, programIdStr) {
  return db.execute({
    sql: `UPDATE contact_roles
              SET title = ?, capability_overrides = ?::jsonb
              WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
    args: [finalRole, permissionsJson, contactCid, programIdStr],
  });
}

/** Insert the generalized contact_roles row when no current mirror existed. */
export async function insertMirroredProgramContactRole(contactCid, finalRole, programIdStr, permissionsJson) {
  return db.execute({
    sql: `INSERT INTO contact_roles
                  (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
                VALUES (?, ?, 'program', ?, true, ?, '{"type":"program"}'::jsonb, 'active', ?::jsonb, 'system')`,
    args: [contactCid, finalRole, programIdStr, finalRole, permissionsJson],
  });
}

/** Assignment identity (staff_id, program_id) before deleting it. */
export async function getProgramStaffAssignmentForDelete(id) {
  return db.execute({
    sql: "SELECT staff_id, program_id FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
}

/** Delete a v2_program_staff assignment by primary key. */
export async function deleteProgramStaffAssignmentById(id) {
  return db.execute({
    sql: "DELETE FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
}

/** Resolve a staff ref (cid or email) to a contact cid (mirror teardown path). */
export async function getContactCidForProgramRoleCleanup(staffRef) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
    args: [staffRef, staffRef],
  });
}

/** Mark the current mirrored contact_roles row ended/removed. */
export async function endMirroredProgramContactRole(contactCid, programIdStr) {
  return db.execute({
    sql: `UPDATE contact_roles
                SET is_current = false, ended_at = NOW(), status = 'removed'
                WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
    args: [contactCid, programIdStr],
  });
}
