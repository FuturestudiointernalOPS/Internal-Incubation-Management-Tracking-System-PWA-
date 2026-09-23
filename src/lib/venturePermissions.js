/**
 * Venture Permissions — configurable, data-driven, Venture-domain.
 *
 * Responsibilities are contextual assignments (staff -> Venture ->
 * responsibility -> scope -> capability). Names are editable from the UI;
 * stable `code`s are what assignments/matrix rows reference. Super Admin
 * stays the global authority and is short-circuited by callers/guards.
 *
 * This module is additive and Venture-owned: it never reads Program, LMS or
 * CRM permission data. (Phase 1 of the Venture permission engine.)
 */

import { invalidateVentureAccess } from "@/lib/ventureAccessFacts";

// Venture areas that permissions apply to (matrix rows). Kept as a stable
// code-side taxonomy; responsibilities and scopes are user-configurable.
export const VENTURE_PERMISSION_AREAS = [
  "overview",
  "profile",
  "founders",
  "milestones",
  "tasks",
  "documents",
  "internal_notes",
  "calendar",
  "coaching",
  "operating_plan",
  "staff_assignment",
  "permissions",
  "settings",
];

// Capability verbs available in the matrix.
export const VENTURE_PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "comment",
  "upload",
  "review",
  "approve",
  "assign",
  "schedule",
  "manage",
  "configure",
];

export const VENTURE_SCOPE_TYPES = [
  { code: "venture_wide", name: "Venture-wide" },
  { code: "milestone", name: "Milestone" },
  { code: "section", name: "Section" },
  { code: "workstream", name: "Workstream" },
  { code: "custom", name: "Custom" },
];

// ── Seed defaults (agreed matrix) ──────────────────────────────────────────
// Lead Manager: everything except configuring/deleting permissions, except
// configuring staff-assignment & settings structure.
function leadManagerDefaults() {
  const rows = [];
  for (const area of VENTURE_PERMISSION_AREAS) {
    for (const action of VENTURE_PERMISSION_ACTIONS) {
      if (area === "permissions") continue; // Super Admin only
      if (area === "staff_assignment" && action === "configure") continue;
      if (area === "settings" && action === "configure") continue;
      rows.push([area, action, true]);
    }
  }
  return rows;
}

// Coach: assigned-scope operational support.
function coachDefaults() {
  const set = (area, actions) => actions.map((action) => [area, action, true]);
  return [
    ...set("overview", ["view"]),
    ...set("profile", ["view"]),
    ...set("founders", ["view"]),
    ...set("milestones", ["view", "comment", "review"]),
    ...set("tasks", ["view", "create", "edit", "comment", "review"]),
    ...set("documents", ["view", "upload", "comment", "review"]),
    ...set("internal_notes", ["view", "create", "comment"]),
    // A coach SUPPORTS the work; they do not define the calendar. Booking is a
    // manager act — this cell is what the `create_session` gate reads.
    ...set("calendar", ["view"]),
    ...set("coaching", ["view", "comment", "manage"]),
    ...set("operating_plan", ["view", "comment"]),
    ...set("settings", ["view"]),
  ];
}

// Facilitator: coach scope plus plan authoring and review powers.
function facilitatorDefaults() {
  const rows = coachDefaults();
  const set = (area, actions) => actions.map((action) => [area, action, true]);
  rows.push(...set("operating_plan", ["create", "edit"]));
  // Scheduling is re-stated rather than inherited: a facilitator runs sessions,
  // so a later change to the COACH default must never silently strip their
  // ability to book.
  rows.push(...set("calendar", ["create", "schedule"]));
  rows.push(...set("internal_notes", ["edit"]));
  rows.push(...set("documents", ["approve"]));
  rows.push(...set("milestones", ["approve"]));
  return rows;
}

const DEFAULT_RESPONSIBILITIES = [
  { code: "lead_manager", name: "Lead Manager", description: "Overall operational management and coordination of the Venture." },
  { code: "coach", name: "Coach", description: "Specialist supporting an assigned scope of the Venture." },
  { code: "facilitator", name: "Facilitator", description: "Operational support with plan-authoring and review duties." },
];

const DEFAULT_MATRIX = {
  lead_manager: leadManagerDefaults(),
  coach: coachDefaults(),
  facilitator: facilitatorDefaults(),
};

/**
 * Seeded defaults that state an answer the platform never enforced, and whose
 * cell a route now READS. Left alone, each would finally be honoured — which is
 * the opposite of the decision:
 *
 *   coach · calendar.schedule      a Coach supports a Venture; a manager books
 *   coach · milestones.create      a Coach does not restructure the roadmap
 *   coach · milestones.edit        ...nor rewrite or complete it
 *   facilitator · milestones.*     same: the Lead Manager owns the roadmap
 *
 * Facilitator is listed separately on purpose. Its defaults INHERIT the coach's,
 * so a fresh database already gets the corrected shape from `facilitatorDefaults`
 * — but a database seeded before this change still carries the old inherited
 * values, and unlike the coach they were never enforced either way. Reading the
 * cell without correcting it would have WIDENED a facilitator's authority.
 *
 * `updated_by IS NULL` confines each correction to the SEEDED row, so a cell an
 * administrator deliberately configured is never overwritten. If someone wants
 * one of these granted, they grant it and this leaves it alone.
 *
 * Idempotent: once a row is FALSE the `allowed = TRUE` predicate stops matching.
 * Fail-soft, and one failure never blocks the others.
 */
const SEED_DEFAULT_CORRECTIONS = [
  { responsibility: "coach", area: "calendar", action: "schedule" },
  { responsibility: "coach", area: "milestones", action: "create" },
  { responsibility: "coach", area: "milestones", action: "edit" },
  { responsibility: "facilitator", area: "milestones", action: "create" },
  { responsibility: "facilitator", area: "milestones", action: "edit" },
];

export async function correctSeedDefaults(db) {
  let allOk = true;
  for (const { responsibility, area, action } of SEED_DEFAULT_CORRECTIONS) {
    try {
      await db.execute({
        sql: `UPDATE venture_permission_matrix
                 SET allowed = FALSE
               WHERE responsibility_code = ?
                 AND area = ?
                 AND action = ?
                 AND allowed = TRUE
                 AND updated_by IS NULL`,
        args: [responsibility, area, action],
      });
    } catch (_) {
      allOk = false;
    }
  }
  return allOk;
}

/**
 * Idempotent seed — only seeds the permission MATRIX when it is empty, so
 * admin edits are never overwritten on subsequent boots. Catalog rows use
 * ON CONFLICT DO NOTHING so a partial previous run can never block the seed.
 *
 * The correction below runs on EVERY boot, seeded or not: an edited default only
 * reaches fresh installs through the seed, so an already-seeded database would
 * otherwise never receive it — and the booking gate would read the old value.
 */
export async function seedVenturePermissions(db) {
  const countResult = await db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_permission_matrix", args: [] });
  const existing = Number(countResult.rows?.[0]?.n || 0);
  const corrected = await correctSeedDefaults(db);
  if (existing > 0) return { seeded: false, corrected };

  const queries = [];
  for (const responsibility of DEFAULT_RESPONSIBILITIES) {
    queries.push(db.execute({
      sql: "INSERT INTO venture_responsibilities (code, name, description) VALUES (?,?,?) ON CONFLICT (code) DO NOTHING",
      args: [responsibility.code, responsibility.name, responsibility.description],
    }));
  }
  for (const scopeType of VENTURE_SCOPE_TYPES) {
    queries.push(db.execute({
      sql: "INSERT INTO venture_scope_types (code, name, sort_order) VALUES (?,?,?) ON CONFLICT (code) DO NOTHING",
      args: [scopeType.code, scopeType.name, VENTURE_SCOPE_TYPES.findIndex((candidate) => candidate.code === scopeType.code)],
    }));
  }
  for (const [code, rows] of Object.entries(DEFAULT_MATRIX)) {
    for (const [area, action, allowed] of rows) {
      queries.push(db.execute({
        sql: "INSERT INTO venture_permission_matrix (responsibility_code, area, action, allowed) VALUES (?,?,?,?) ON CONFLICT (responsibility_code, area, action) DO NOTHING",
        args: [code, area, action, allowed ? 1 : 0],
      }));
    }
  }
  await Promise.all(queries);
  return { seeded: true, corrected };
}

// ── Helpers used by the admin APIs ─────────────────────────────────────────

export async function listResponsibilities(db, { includeInactive = false } = {}) {
  const result = await db.execute({
    sql: `SELECT vr.*,
      (SELECT COUNT(*) FROM venture_staff_assignments a
        WHERE a.responsibility_code = vr.code AND a.status = 'active') AS active_assignments
      FROM venture_responsibilities vr
      WHERE (? = 1 OR vr.is_active = TRUE)
      ORDER BY vr.id`,
    args: [includeInactive ? 1 : 0],
  });
  return result.rows || [];
}

export async function listScopeTypes(db) {
  const result = await db.execute({
    sql: "SELECT * FROM venture_scope_types WHERE is_active = TRUE ORDER BY sort_order, id",
    args: [],
  });
  return result.rows || [];
}

export async function getResponsibility(db, code) {
  const result = await db.execute({ sql: "SELECT * FROM venture_responsibilities WHERE code = ?", args: [code] });
  return result.rows?.[0] || null;
}

/**
 * Global matrix for a responsibility: rows keyed by area with the action map.
 * There is deliberately NO per-Venture dimension — the matrix is global and
 * applies to every Venture where that responsibility is assigned.
 */
export async function getGlobalMatrix(db, { responsibilityCode }) {
  const defaults = await db.execute({
    sql: "SELECT area, action, allowed FROM venture_permission_matrix WHERE responsibility_code = ?",
    args: [responsibilityCode],
  });

  const byArea = {};
  for (const area of VENTURE_PERMISSION_AREAS) {
    byArea[area] = {};
    for (const action of VENTURE_PERMISSION_ACTIONS) {
      byArea[area][action] = false;
    }
  }
  for (const cell of defaults.rows || []) {
    if (byArea[cell.area]?.[cell.action] !== undefined) byArea[cell.area][cell.action] = !!cell.allowed;
  }
  return byArea;
}

export async function setMatrixCell(db, { responsibilityCode, area, action, allowed, actorCid = null }) {
  await db.execute({
    sql: `INSERT INTO venture_permission_matrix (responsibility_code, area, action, allowed, updated_by)
          VALUES (?,?,?,?,?)
          ON CONFLICT (responsibility_code, area, action)
          DO UPDATE SET allowed = excluded.allowed, updated_by = excluded.updated_by, updated_at = NOW()`,
    args: [responsibilityCode, area, action, allowed ? 1 : 0, actorCid],
  });
  return { success: true };
}

// ── Assignment helpers ─────────────────────────────────────────────────────

export async function listAssignments(db, ventureId, { includeRemoved = false } = {}) {
  const result = await db.execute({
    sql: `SELECT a.*, c.name AS staff_name, c.email AS staff_email, vr.name AS responsibility_name
          FROM venture_staff_assignments a
          LEFT JOIN contacts c ON c.cid = a.staff_contact_id
          LEFT JOIN venture_responsibilities vr ON vr.code = a.responsibility_code
          WHERE a.venture_id = ? AND (? = 1 OR a.status = 'active')
          ORDER BY a.id DESC`,
    args: [ventureId, includeRemoved ? 1 : 0],
  });
  return result.rows || [];
}

export async function createAssignment(db, { ventureId, staffContactId, responsibilityCode, scopeType, scopeRefType = null, scopeRefId = null, assignedBy = null, notes = null }) {
  const responsibility = await getResponsibility(db, responsibilityCode);
  if (!responsibility || !responsibility.is_active) return { error: "Unknown or inactive responsibility." };
  const insertResult = await db.execute({
    sql: `INSERT INTO venture_staff_assignments
          (venture_id, staff_contact_id, responsibility_code, scope_type, scope_ref_type, scope_ref_id, assigned_by, notes)
          VALUES (?,?,?,?,?,?,?,?)`,
    args: [ventureId, staffContactId, responsibilityCode, scopeType || "venture_wide", scopeRefType, scopeRefId, assignedBy, notes],
  });
  // A delegated staff member granted access just now must be able to use it
  // without waiting for the remembered answers to expire.
  invalidateVentureAccess(ventureId);
  return { success: true, id: insertResult.lastInsertRowid ?? null };
}

export async function removeAssignment(db, { id }) {
  await db.execute({
    sql: "UPDATE venture_staff_assignments SET status = 'removed', removed_at = NOW() WHERE id = ? AND status = 'active'",
    args: [id],
  });
  return { success: true };
}

/**
 * Runtime capability evaluation — the access rule:
 *   user -> venture -> assignment(s) -> responsibility -> matrix (default +
 *   venture overrides) -> scope match -> capability granted?
 *
 * Global authority (super_admin) is handled by route guards BEFORE this
 * function; this resolves delegated staff access only.
 */
export async function hasVentureCapability(db, { ventureId, contactId, area, action, scopeRefType = null, scopeRefId = null }) {
  if (!ventureId || !contactId) return false;
  if (!VENTURE_PERMISSION_AREAS.includes(area) || !VENTURE_PERMISSION_ACTIONS.includes(action)) return false;

  const assignments = await db.execute({
    sql: `SELECT a.responsibility_code, a.scope_type, a.scope_ref_type, a.scope_ref_id
          FROM venture_staff_assignments a
          WHERE a.venture_id = ? AND a.staff_contact_id = ? AND a.status = 'active'`,
    args: [ventureId, contactId],
  });
  const rows = assignments.rows || [];
  if (rows.length === 0) return false;

  for (const assignment of rows) {
    // Scope gate: venture-wide always matches; typed scopes require a
    // matching scope reference on the object being acted on.
    if (assignment.scope_type !== "venture_wide") {
      if (!scopeRefType || !scopeRefId) continue;
      if (String(assignment.scope_ref_type || "") !== String(scopeRefType)) continue;
      if (String(assignment.scope_ref_id || "") !== String(scopeRefId)) continue;
    }
    const respCode = assignment.responsibility_code;

    // GLOBAL matrix (single source of truth — no per-Venture overrides).
    const matrixRow = await db.execute({
      sql: "SELECT allowed FROM venture_permission_matrix WHERE responsibility_code = ? AND area = ? AND action = ?",
      args: [respCode, area, action],
    });
    if (matrixRow.rows?.[0]?.allowed) return true;
  }
  return false;
}

/** Convenience: any capability across the staff member's assignments on a venture. */
export async function hasAnyVentureAssignment(db, { ventureId, contactId }) {
  const result = await db.execute({
    sql: "SELECT 1 FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' LIMIT 1",
    args: [ventureId, contactId],
  });
  return (result.rows || []).length > 0;
}
