/**
 * Venture permissions — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/permissions`: the seed writes, the
 * responsibility/scope/matrix reads and writes, the staff-assignment CRUD, and
 * the two statements the capability evaluation runs. The decisions (the seed
 * corrections, the scope match, the capability answer) live in the service; the
 * taxonomy and the default matrix are pure data there too.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/venturePermissions.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Seed ─────────────────────────────────────────────────────────────────────

/** Turn one seeded default cell back off (only an untouched seed row). */
export function updatePermissionMatrixCorrection(responsibility, area, action) {
  return db.execute({
    sql: `UPDATE venture_permission_matrix
             SET allowed = FALSE
           WHERE responsibility_code = ?
             AND area = ?
             AND action = ?
             AND allowed = TRUE
             AND updated_by IS NULL`,
    args: [responsibility, area, action],
  });
}

/** How many matrix rows exist (seed guard). */
export function countPermissionMatrixRows() {
  return db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_permission_matrix", args: [] });
}

/** Seed one responsibility row. */
export function insertResponsibility(code, name, description) {
  return db.execute({
    sql: "INSERT INTO venture_responsibilities (code, name, description) VALUES (?,?,?) ON CONFLICT (code) DO NOTHING",
    args: [code, name, description],
  });
}

/** Seed one scope type row. */
export function insertScopeType(code, name, sortOrder) {
  return db.execute({
    sql: "INSERT INTO venture_scope_types (code, name, sort_order) VALUES (?,?,?) ON CONFLICT (code) DO NOTHING",
    args: [code, name, sortOrder],
  });
}

/** Seed one default matrix cell. */
export function insertMatrixCellSeed(responsibilityCode, area, action, allowed) {
  return db.execute({
    sql: "INSERT INTO venture_permission_matrix (responsibility_code, area, action, allowed) VALUES (?,?,?,?) ON CONFLICT (responsibility_code, area, action) DO NOTHING",
    args: [responsibilityCode, area, action, allowed],
  });
}

// ── Responsibilities / scopes / matrix ───────────────────────────────────────

/** Responsibilities with their active-assignment count. */
export function selectResponsibilities(includeInactive) {
  return db.execute({
    sql: `SELECT vr.*,
      (SELECT COUNT(*) FROM venture_staff_assignments a
        WHERE a.responsibility_code = vr.code AND a.status = 'active') AS active_assignments
      FROM venture_responsibilities vr
      WHERE (? = 1 OR vr.is_active = TRUE)
      ORDER BY vr.id`,
    args: [includeInactive ? 1 : 0],
  });
}

/** The active scope types, in display order. */
export function selectActiveScopeTypes() {
  return db.execute({
    sql: "SELECT * FROM venture_scope_types WHERE is_active = TRUE ORDER BY sort_order, id",
    args: [],
  });
}

/** One responsibility by its stable code. */
export function selectResponsibilityByCode(code) {
  return db.execute({ sql: "SELECT * FROM venture_responsibilities WHERE code = ?", args: [code] });
}

/** The global matrix rows for one responsibility. */
export function selectMatrixForResponsibility(responsibilityCode) {
  return db.execute({
    sql: "SELECT area, action, allowed FROM venture_permission_matrix WHERE responsibility_code = ?",
    args: [responsibilityCode],
  });
}

/** Upsert one matrix cell. */
export function upsertMatrixCell(responsibilityCode, area, action, allowed, actorCid) {
  return db.execute({
    sql: `INSERT INTO venture_permission_matrix (responsibility_code, area, action, allowed, updated_by)
          VALUES (?,?,?,?,?)
          ON CONFLICT (responsibility_code, area, action)
          DO UPDATE SET allowed = excluded.allowed, updated_by = excluded.updated_by, updated_at = NOW()`,
    args: [responsibilityCode, area, action, allowed ? 1 : 0, actorCid],
  });
}

// ── Assignments ──────────────────────────────────────────────────────────────

/** A Venture's staff assignments, joined with the contact and responsibility. */
export function selectAssignments(ventureId, includeRemoved) {
  return db.execute({
    sql: `SELECT a.*, c.name AS staff_name, c.email AS staff_email, vr.name AS responsibility_name
          FROM venture_staff_assignments a
          LEFT JOIN contacts c ON c.cid = a.staff_contact_id
          LEFT JOIN venture_responsibilities vr ON vr.code = a.responsibility_code
          WHERE a.venture_id = ? AND (? = 1 OR a.status = 'active')
          ORDER BY a.id DESC`,
    args: [ventureId, includeRemoved ? 1 : 0],
  });
}

/** Create a staff assignment row. */
export function insertAssignment({ ventureId, staffContactId, responsibilityCode, scopeType, scopeRefType, scopeRefId, assignedBy, notes }) {
  return db.execute({
    sql: `INSERT INTO venture_staff_assignments
          (venture_id, staff_contact_id, responsibility_code, scope_type, scope_ref_type, scope_ref_id, assigned_by, notes)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [ventureId, staffContactId, responsibilityCode, scopeType, scopeRefType, scopeRefId, assignedBy, notes],
  });
}

/** Soft-remove one active assignment. */
export function removeAssignmentRow(id) {
  return db.execute({
    sql: "UPDATE venture_staff_assignments SET status = 'removed', removed_at = NOW() WHERE id = ? AND status = 'active'",
    args: [id],
  });
}

// ── Capability evaluation ────────────────────────────────────────────────────

/** A contact's active assignments on a Venture (responsibility + scope). */
export function selectActiveAssignmentsForContact(ventureId, contactId) {
  return db.execute({
    sql: `SELECT a.responsibility_code, a.scope_type, a.scope_ref_type, a.scope_ref_id
          FROM venture_staff_assignments a
          WHERE a.venture_id = ? AND a.staff_contact_id = ? AND a.status = 'active'`,
    args: [ventureId, contactId],
  });
}

/** One matrix cell's verdict. */
export function selectMatrixCell(responsibilityCode, area, action) {
  return db.execute({
    sql: "SELECT allowed FROM venture_permission_matrix WHERE responsibility_code = ? AND area = ? AND action = ?",
    args: [responsibilityCode, area, action],
  });
}

/** Whether a contact holds any active assignment on a Venture. */
export function selectAnyActiveAssignment(ventureId, contactId) {
  return db.execute({
    sql: "SELECT 1 FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' LIMIT 1",
    args: [ventureId, contactId],
  });
}
