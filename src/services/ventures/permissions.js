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
 *
 * Every statement lives in `@/models/venturePermissionStore`; nothing here runs
 * SQL. This module used to be re-exported through the `@/lib/venturePermissions` facade;
 * that facade is gone (CH-4) and importers read this module directly.
 */

import { invalidateVentureAccess } from "@/services/ventures/accessFacts";
import { syncContextGrantsForUser } from "@/services/authorization/contextGrantReconcile";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";
import { selectNotifyContact } from "@/models/ventureNotifyStore";
import {
  updatePermissionMatrixCorrection,
  countPermissionMatrixRows,
  insertResponsibility,
  insertScopeType,
  insertMatrixCellSeed,
  selectResponsibilities,
  selectActiveScopeTypes,
  selectResponsibilityByCode,
  selectMatrixForResponsibility,
  upsertMatrixCell,
  selectAssignments,
  insertAssignment,
  removeAssignmentRow,
  selectAssignmentRow,
  selectActiveAssignmentsForContact,
  selectMatrixCell,
  selectAnyActiveAssignment,
} from "@/models/venturePermissionStore";

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

export async function correctSeedDefaults() {
  let allOk = true;
  for (const { responsibility, area, action } of SEED_DEFAULT_CORRECTIONS) {
    try {
      await updatePermissionMatrixCorrection(responsibility, area, action);
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
export async function seedVenturePermissions() {
  const countResult = await countPermissionMatrixRows();
  const existing = Number(countResult.rows?.[0]?.n || 0);
  const corrected = await correctSeedDefaults();
  if (existing > 0) return { seeded: false, corrected };

  const queries = [];
  for (const responsibility of DEFAULT_RESPONSIBILITIES) {
    queries.push(insertResponsibility(responsibility.code, responsibility.name, responsibility.description));
  }
  for (const scopeType of VENTURE_SCOPE_TYPES) {
    queries.push(insertScopeType(scopeType.code, scopeType.name, VENTURE_SCOPE_TYPES.findIndex((candidate) => candidate.code === scopeType.code)));
  }
  for (const [code, rows] of Object.entries(DEFAULT_MATRIX)) {
    for (const [area, action, allowed] of rows) {
      queries.push(insertMatrixCellSeed(code, area, action, allowed ? 1 : 0));
    }
  }
  await Promise.all(queries);
  return { seeded: true, corrected };
}

// ── Helpers used by the admin APIs ─────────────────────────────────────────

export async function listResponsibilities({ includeInactive = false } = {}) {
  const result = await selectResponsibilities(includeInactive);
  return result.rows || [];
}

export async function listScopeTypes() {
  const result = await selectActiveScopeTypes();
  return result.rows || [];
}

export async function getResponsibility(code) {
  const result = await selectResponsibilityByCode(code);
  return result.rows?.[0] || null;
}

/**
 * Global matrix for a responsibility: rows keyed by area with the action map.
 * There is deliberately NO per-Venture dimension — the matrix is global and
 * applies to every Venture where that responsibility is assigned.
 */
export async function getGlobalMatrix({ responsibilityCode }) {
  const defaults = await selectMatrixForResponsibility(responsibilityCode);

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

export async function setMatrixCell({ responsibilityCode, area, action, allowed, actorCid = null }) {
  await upsertMatrixCell(responsibilityCode, area, action, allowed, actorCid);
  return { success: true };
}

// ── Assignment helpers ─────────────────────────────────────────────────────

export async function listAssignments(ventureId, { includeRemoved = false } = {}) {
  const result = await selectAssignments(ventureId, includeRemoved);
  return result.rows || [];
}

export async function createAssignment({ ventureId, staffContactId, responsibilityCode, scopeType, scopeRefType = null, scopeRefId = null, assignedBy = null, notes = null }) {
  const responsibility = await getResponsibility(responsibilityCode);
  if (!responsibility || !responsibility.is_active) return { error: "Unknown or inactive responsibility." };
  const insertResult = await insertAssignment({
    ventureId,
    staffContactId,
    responsibilityCode: responsibilityCode,
    scopeType: scopeType || "venture_wide",
    scopeRefType,
    scopeRefId,
    assignedBy,
    notes,
  });
  // A delegated staff member granted access just now must be able to use it
  // without waiting for the remembered answers to expire.
  invalidateVentureAccess(ventureId);
  // Being made the Venture's Lead Manager is what justifies the `venture_manager`
  // profile — and the profile is what carries `ventures.view`/`edit`. Without this,
  // the assignment gave SCOPE but no CAPABILITY: the manager held a Venture she was
  // not allowed to open (docs/VENTURE_IDENTITY_PHASE0.md §4.5, "Phase E").
  if (responsibilityCode === MANAGER_RESPONSIBILITY) {
    await syncManagerProfile(staffContactId);
    // The Venture is told its lead changed. Read back the row id this insert
    // produced (RETURNING id) so the notice is deduped PER ASSIGNMENT: removing
    // and re-adding the same person is two real events, a retried call is one.
    const ventureDbId = await resolveVentureInternalId(ventureId).catch(() => null);
    await notifyFoundersOfLeadChange({
      ventureDbId,
      assignmentId: insertResult?.rows?.[0]?.id ?? null,
      event: "assigned",
      contactId: staffContactId,
    });
  }
  return { success: true, id: insertResult.lastInsertRowid ?? insertResult?.rows?.[0]?.id ?? null };
}

export async function removeAssignment({ id }) {
  // Read BEFORE the removal: afterwards the row no longer says who held it.
  const row = (await selectAssignmentRow(id).catch(() => ({ rows: [] }))).rows?.[0] || null;
  await removeAssignmentRow(id);
  if (row?.responsibility_code === MANAGER_RESPONSIBILITY) {
    await syncManagerProfile(row.staff_contact_id);
    await notifyFoundersOfLeadChange({
      ventureDbId: row.venture_db_id || null,
      assignmentId: row.id ?? id,
      event: "removed",
      contactId: row.staff_contact_id,
    });
  }
  return { success: true };
}

/** The responsibility whose assignment carries workspace access. */
const MANAGER_RESPONSIBILITY = "lead_manager";

/**
 * Tell the Venture that its LEAD changed.
 *
 * BEST-EFFORT BY DESIGN. The assignment has already been written; a notice that
 * fails (no provider, an unresolvable contact, a transient database error) must
 * never undo it or fail the request that asked for it. Every failure is
 * swallowed here and the assignment stands.
 *
 * The audience is the Venture's founders, through the SAME helper every other
 * Venture-facing event uses (`notifyAndEmailVentureFounders`: in-app
 * notification + email in one call) — no second notification system.
 */
async function notifyFoundersOfLeadChange({ ventureDbId, assignmentId, event, contactId }) {
  try {
    if (!ventureDbId || assignmentId === null || assignmentId === undefined) return;
    const [contact, notify] = await Promise.all([
      selectNotifyContact(contactId).catch(() => ({ rows: [] })),
      import("@/services/ventures/notify"),
    ]);
    const name = contact?.rows?.[0]?.name || "A Venture Lead";
    const assigned = event === "assigned";

    await notify.notifyAndEmailVentureFounders({
      dbId: ventureDbId,
      title: assigned ? "Venture Lead assigned" : "Venture Lead updated",
      message: assigned
        ? `${name} now supports your Venture — you can reach them from your Venture dashboard.`
        : `${name} is no longer assigned to your Venture.`,
      emailSubject: assigned
        ? "A Venture Lead has been assigned to your Venture"
        : "Your Venture Lead has been updated",
      emailLines: assigned
        ? [
            `${name} now supports your Venture.`,
            "You can reach them from your Venture dashboard in ImpactOS.",
          ]
        : [
            `${name} is no longer assigned to your Venture.`,
            "Any new support will appear on your Venture dashboard in ImpactOS.",
          ],
      templateKey: assigned ? "venture.notif.leadAssigned" : "venture.notif.leadRemoved",
      params: { name },
      dedupeKey: `lead-${assigned ? "assigned" : "removed"}:${assignmentId}`,
    });
  } catch (_) {}
}

/**
 * Keep one person's Venture Manager profile period in step with their live
 * assignments. The reconcile reads the ROWS and decides: it opens the period when
 * they lead a Venture, refreshes it while they still do, and closes it when they
 * do not — so this one call serves assignment, re-assignment and removal alike.
 *
 * Never allowed to break the assignment itself: a profile hiccup must not roll back
 * a manager appointment (the sweep can reconcile it later).
 */
async function syncManagerProfile(cid) {
  if (!cid) return;
  try {
    await syncContextGrantsForUser(String(cid), { context: "venture", roleKey: "venture_manager" });
  } catch (error) {
    console.error(
      `[venture-permissions] Venture Manager profile sync failed for ${cid}:`,
      error?.message || error,
    );
  }
}

/**
 * Runtime capability evaluation — the access rule:
 *   user -> venture -> assignment(s) -> responsibility -> matrix (default +
 *   venture overrides) -> scope match -> capability granted?
 *
 * Global authority (super_admin) is handled by route guards BEFORE this
 * function; this resolves delegated staff access only.
 */
export async function hasVentureCapability({ ventureId, contactId, area, action, scopeRefType = null, scopeRefId = null }) {
  if (!ventureId || !contactId) return false;
  if (!VENTURE_PERMISSION_AREAS.includes(area) || !VENTURE_PERMISSION_ACTIONS.includes(action)) return false;

  const assignments = await selectActiveAssignmentsForContact(ventureId, contactId);
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
    const matrixRow = await selectMatrixCell(respCode, area, action);
    if (matrixRow.rows?.[0]?.allowed) return true;
  }
  return false;
}

/** Convenience: any capability across the staff member's assignments on a venture. */
export async function hasAnyVentureAssignment({ ventureId, contactId }) {
  const result = await selectAnyActiveAssignment(ventureId, contactId);
  return (result.rows || []).length > 0;
}
