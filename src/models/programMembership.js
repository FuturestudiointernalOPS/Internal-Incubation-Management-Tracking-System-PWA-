import db from "@/lib/db";

/**
 * ProgramMembership model — data access for program-staff assignments
 * (v2_program_staff + the generalized contact_roles mirror) and participant
 * program enrollment / program rosters.
 *
 * Sources migrated from route controllers (docs/MVC_REFACTOR.md Wave 2):
 *  - /api/program-staff
 *  - /api/v2/program-staff
 *  - /api/participant/programs
 *  - /api/participant/programs/[id]
 *  - /api/contacts/[cid]/programs
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md §4):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
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

// ────────────────────────────────────────────────────────────
// /api/participant/programs — participant program dashboard
// ────────────────────────────────────────────────────────────

/** The participant's own contact profile (program membership context). */
export async function getParticipantContactProfile(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, program_id, program_name, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Program row by text id. */
export async function getParticipantProgramById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Sessions of a program, ordered by week then start time. */
export async function getParticipantProgramSessions(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
    args: [programId],
  });
}

/** Document requirements (deliverables) of a program. */
export async function getParticipantProgramDeliverables(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

/** Submissions of a participant within a program. */
export async function getParticipantProgramSubmissions(participantId, programId) {
  return db.execute({
    sql: `SELECT s.* FROM v2_submissions s
                  WHERE s.participant_id = ? AND s.program_id::text = ?`,
    args: [participantId, programId],
  });
}

/** Attendance marks of a participant within a program's sessions. */
export async function getParticipantProgramAttendance(participantId, programId) {
  return db.execute({
    sql: `SELECT a.* FROM v2_attendance a
                  JOIN v2_sessions s ON a.session_id::text = s.id::text
                  WHERE a.participant_id = ? AND s.program_id::text = ?`,
    args: [participantId, programId],
  });
}

/** KPIs of a program. */
export async function getParticipantProgramKpis(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Program-staff roster (with contact name/role) of a program. */
export async function getParticipantProgramStaff(programId) {
  return db.execute({
    sql: "SELECT ps.*, c.name AS staff_name, c.role AS staff_role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id::text = c.cid WHERE ps.program_id::text = ?",
    args: [programId],
  });
}

/** Whether any attendance rows exist for a program (attendance tracking). */
export async function getParticipantAttendanceCount(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Name of a program's assigned PM contact. */
export async function getParticipantProgramPmName(pmCid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [pmCid],
  });
}

// ────────────────────────────────────────────────────────────
// /api/participant/programs/[id] — participant program detail
// ────────────────────────────────────────────────────────────

/** The participant's own contact enrollment context (program_id, group_name). */
export async function getParticipantProgramEnrollmentByCid(cid) {
  return db.execute({
    sql: "SELECT program_id, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Program row by text id. */
export async function getParticipantProgramDetailById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Sessions of a program, ordered by week then start time. */
export async function getParticipantProgramDetailSessions(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
    args: [programId],
  });
}

/** Document requirements (deliverables) of a program. */
export async function getParticipantProgramDetailDeliverables(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

/** Submissions of a participant within a program, newest first. */
export async function getParticipantProgramDetailSubmissions(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

/** Attendance marks of a participant within a program's sessions. */
export async function getParticipantProgramDetailAttendance(participantId, programId) {
  return db.execute({
    sql: "SELECT a.* FROM v2_attendance a JOIN v2_sessions s ON a.session_id::text = s.id::text WHERE a.participant_id::text = ? AND s.program_id::text = ? ORDER BY a.created_at ASC",
    args: [participantId, programId],
  });
}

/** KPIs of a program. */
export async function getParticipantProgramDetailKpis(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Program-staff roster (with contact name/role) of a program. */
export async function getParticipantProgramDetailStaff(programId) {
  return db.execute({
    sql: "SELECT ps.*, c.name AS staff_name, c.role AS staff_role FROM v2_program_staff ps LEFT JOIN contacts c ON ps.staff_id = c.cid WHERE ps.program_id = ?",
    args: [programId],
  });
}

/** Recent follow-ups attached to a program. */
export async function getParticipantProgramFollowups(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 10",
    args: [programId],
  });
}

/** Non-archived knowledge-bank resources, newest first. */
export async function getParticipantKnowledgeBankItems() {
  return db.execute({
    sql: "SELECT * FROM v2_knowledge_bank WHERE is_archived = 0 ORDER BY created_at DESC",
    args: [],
  });
}

/**
 * Knowledge-bank attachment rows for a set of note ids. The placeholder list
 * is derived from the number of ids, so the generated SQL is identical to the
 * original inline `note_id IN (?,?,...)` query.
 */
export async function getKnowledgeBankAttachmentsByNoteIds(noteIds) {
  return db.execute({
    sql:
      "SELECT * FROM v2_knowledge_attachments WHERE note_id IN (" +
      noteIds.map(() => "?").join(",") +
      ") ORDER BY created_at DESC",
    args: noteIds,
  });
}

/** Name of a program's assigned PM contact. */
export async function getParticipantProgramDetailPmName(pmCid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [pmCid],
  });
}

/** Whether any attendance rows exist for a program (attendance tracking). */
export async function getProgramDetailAttendanceCount(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}

// ────────────────────────────────────────────────────────────
// /api/contacts/[cid]/programs — contact program history
// ────────────────────────────────────────────────────────────

/** Contact email by cid (used to look up program history). */
export async function getContactEmailForProgramHistory(cid) {
  return db.execute({
    sql: "SELECT email FROM contacts WHERE cid = ? LIMIT 1",
    args: [cid],
  });
}
