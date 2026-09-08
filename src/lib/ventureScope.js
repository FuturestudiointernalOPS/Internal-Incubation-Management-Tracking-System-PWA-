/**
 * Venture assignment-scope resolution (Vinance 3 — assignment-scope
 * enforcement for Venture review actions).
 *
 * Bridges the delegation model (venture_staff_assignments rows carrying a
 * responsibility + scope) and the submission-review surfaces:
 *
 *   - GLOBAL roles (super_admin / developer / admin) always have Venture-wide
 *     reach and are short-circuited by the routes BEFORE this module
 *     (see isGlobalRole).
 *   - A delegated (non-global) actor may only review / be queued for
 *     submissions whose task lies inside one of his ACTIVE assignment scopes
 *     for that Venture (milestone / journey_stage / task / venture_wide).
 *   - An active `lead_manager` assignment is an additional Venture-wide pass,
 *     mirroring the isMilestoneLeadAuthority semantics used by milestone
 *     completion gating.
 *   - Actors with NO active assignment rows keep the legacy behavior — the
 *     routes decide (full queue on reads; review allowed as before) so
 *     pre-delegation rows are unaffected.
 *
 * Failure semantics are conservative and differ by surface:
 *   - reads that ALREADY allow fall back to allowing on error (null);
 *   - the review WRITE route treats any resolution error as fail-closed
 *     (scope = false) so a bug can never over-grant review authority.
 */

export const GLOBAL_ROLES = ["super_admin", "developer", "admin"];

/** Global Venture authority — never constrained by assignment scopes. */
export function isGlobalRole(role) {
  return GLOBAL_ROLES.includes(role);
}

/**
 * Resolve the Venture VNT code from a route param that may be the code itself
 * or the internal UUID (venture_staff_assignments always stores the code).
 * Never throws — returns null when an internal id cannot be resolved.
 */
export async function resolveVentureCode(db, ventureId) {
  if (!ventureId) return null;
  try {
    const uuidForm =
      typeof ventureId === "string" &&
      ventureId.includes("-") &&
      !ventureId.startsWith("VNT-");
    if (!uuidForm) return ventureId;
    const r = await db.execute({
      sql: "SELECT venture_id FROM ventures WHERE id = ?",
      args: [ventureId],
    });
    return r.rows?.[0]?.venture_id || null;
  } catch (_) {
    return null;
  }
}

/**
 * Normalize one raw assignment row into the shape consumed by
 * isTaskInScope. A NULL/empty/`venture_wide` scope_type becomes a pure
 * venture-wide entry ({ scope_type: "venture_wide" }, no refs).
 */
function normalizeScopeRow(row) {
  if (!row) return null;
  const rawType = row.scope_type == null ? "" : String(row.scope_type).trim();
  const scopeType = rawType === "" || rawType === "venture_wide" ? "venture_wide" : rawType;
  return {
    scope_type: scopeType,
    scope_ref_type: scopeType === "venture_wide" ? null : row.scope_ref_type ?? null,
    scope_ref_id: scopeType === "venture_wide" ? null : row.scope_ref_id ?? null,
    responsibility_code: row.responsibility_code ?? null,
  };
}

/**
 * ACTIVE assignment rows of one actor on one Venture, normalized for scope
 * matching. Handles both `venture_id` code and internal-UUID forms exactly
 * like hasActiveVentureAssignment in ventureAuth.js (resolve UUID → code
 * first; assignments always key on the code).
 *
 * @param db       db handle
 * @param opts     { code, cid } — Venture (code or UUID) + actor contact id
 * @returns array of { scope_type, scope_ref_type, scope_ref_id,
 *          responsibility_code }; [] when the actor has no active rows;
 *          null when the lookup itself errored (caller decides the failure
 *          posture: fail-closed on writes, allow-on-error on reads).
 */
export async function getAssignmentScopes(db, { code, cid }) {
  if (!code || !cid) return [];
  const ventureCode = await resolveVentureCode(db, code);
  if (!ventureCode) return []; // unknown internal id → nothing can be in scope
  try {
    const r = await db.execute({
      sql: `SELECT scope_type, scope_ref_type, scope_ref_id, responsibility_code
            FROM venture_staff_assignments
            WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active'
            ORDER BY id ASC`,
      args: [ventureCode, cid],
    });
    return (r.rows || []).map(normalizeScopeRow).filter(Boolean);
  } catch (_) {
    return null;
  }
}

/**
 * True when the actor holds at least one active assignment scope row
 * (non-empty). Error (null) and no-rows both report false.
 */
export function hasAnyVentureScope(scopes) {
  return Array.isArray(scopes) && scopes.length > 0;
}

/**
 * True when the actor's scopes grant full Venture reach: any venture_wide
 * assignment OR any active lead_manager assignment (lead managers lead the
 * whole Venture regardless of the scope column on their row).
 */
export function hasVentureWideReach(scopes) {
  if (!Array.isArray(scopes)) return false;
  return scopes.some(
    (s) =>
      s &&
      (s.scope_type === "venture_wide" || s.responsibility_code === "lead_manager"),
  );
}

/**
 * Pure scope-match: does any assignment scope cover this task?
 *
 * `task` carries `id`, `milestone_id` (may be TEXT — always compared
 * stringified) and optionally `journey_stage_id`:
 *   - any venture_wide assignment passes;
 *   - else an assignment passes when its scope matches the task's own scope:
 *       task:          scope_ref_id === task.id
 *       milestone:     scope_ref_id === task.milestone_id
 *       journey_stage: scope_ref_id === task.journey_stage_id
 * A task with no milestone/journey linkage can only be reached through a
 * direct `task` scope (or venture_wide).
 */
export function isTaskInScope(assignmentScopes, task) {
  if (!Array.isArray(assignmentScopes) || !task) return false;
  const taskId = task.id != null ? String(task.id) : null;
  const milestoneId = task.milestone_id != null ? String(task.milestone_id) : null;
  const stageId =
    task.journey_stage_id != null && String(task.journey_stage_id).trim() !== ""
      ? String(task.journey_stage_id)
      : null;
  for (const s of assignmentScopes) {
    if (!s) continue;
    const type = s.scope_type;
    if (type === "venture_wide") return true;
    if (!type || s.scope_ref_id == null) continue;
    const ref = String(s.scope_ref_id);
    if (type === "task" && taskId && ref === taskId) return true;
    if (type === "milestone" && milestoneId && ref === milestoneId) return true;
    if (type === "journey_stage" && stageId && ref === stageId) return true;
  }
  return false;
}

/**
 * Enrich a single task row with the scope fields reviewers need. journey
 * stages live on the MILESTONE (venture_tasks only carries milestone_id), so
 * when the task is milestone-bound and carries no journey_stage_id yet, the
 * stage is resolved through venture_milestones. Never throws.
 */
export async function resolveTaskContext(db, task) {
  const ctx = {
    id: task?.id ?? null,
    milestone_id: task?.milestone_id ?? null,
    journey_stage_id: task?.journey_stage_id ?? null,
  };
  const hasStage =
    ctx.journey_stage_id != null && String(ctx.journey_stage_id).trim() !== "";
  if (!hasStage && ctx.milestone_id != null) {
    try {
      const r = await db.execute({
        sql: "SELECT journey_stage_id FROM venture_milestones WHERE id::text = ?",
        args: [String(ctx.milestone_id)],
      });
      ctx.journey_stage_id = r.rows?.[0]?.journey_stage_id ?? null;
    } catch (_) {
      ctx.journey_stage_id = null;
    }
  }
  return ctx;
}

/**
 * Scope context (id / milestone_id / journey_stage_id) for every task of a
 * Venture — the input set for queue scoping. Uses the same venture→task and
 * task→milestone linkage the review queue query does. Never throws; returns
 * null on error so callers can fall back to the read's existing behavior.
 */
export async function listTaskScopeContexts(db, { ventureDbId }) {
  if (!ventureDbId) return [];
  try {
    const r = await db.execute({
      sql: `SELECT t.id, t.milestone_id, m.journey_stage_id
            FROM venture_tasks t
            LEFT JOIN venture_milestones m ON m.id::text = t.milestone_id::text
            WHERE t.venture_id = ?`,
      args: [ventureDbId],
    });
    return (r.rows || [])
      .map((row) => ({
        id: row?.id ?? null,
        milestone_id: row?.milestone_id ?? null,
        journey_stage_id: row?.journey_stage_id ?? null,
      }))
      .filter((t) => t.id != null);
  } catch (_) {
    return null;
  }
}

export default {
  GLOBAL_ROLES,
  isGlobalRole,
  resolveVentureCode,
  getAssignmentScopes,
  hasAnyVentureScope,
  hasVentureWideReach,
  isTaskInScope,
  resolveTaskContext,
  listTaskScopeContexts,
};
