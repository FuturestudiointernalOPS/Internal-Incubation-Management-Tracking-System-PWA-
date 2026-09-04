/**
 * Venture Operating Plans — shared access helpers (Phase 4b).
 *
 * Operating plans are a staff instrument (Lead Manager authors them;
 * scoped coaches/facilitators view/comment). Founders/members never see the
 * plan engine itself — the work they own (tasks, milestones, documents) is
 * surfaced through the existing founder workspace and referenced here via
 * plan links.
 *
 * Access model for the `operating_plan` permission area:
 *  - GLOBAL roles (super_admin/developer/admin): full access.
 *  - Delegated staff: require an active assignment. Cell-level action checks
 *    read the configurable matrix (defaults + per-venture overrides). Write
 *    actions (create/edit/manage/delete) additionally require a venture-wide
 *    assignment, so a scoped GTM Coach can view/comment but never author.
 */

const GLOBAL_ROLES = ["super_admin", "developer", "admin"];

export async function resolveVentureCode(db, ventureId) {
  let code = ventureId;
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const byId = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [ventureId] });
      if (byId.rows?.[0]) code = byId.rows[0].venture_id;
    } catch (_) {}
  }
  return code;
}

export function isGlobalRole(role) {
  return GLOBAL_ROLES.includes(role);
}

/**
 * Returns { code, session, global, assignments } or { ok:false }.
 * A user with neither a global role nor an active assignment gets ok:false
 * (routes translate it to 404 so the plan engine is invisible to founders).
 */
export async function resolvePlanAccess(db, ventureId, session) {
  if (!session?.cid && !session?.role) return { ok: false };
  const code = await resolveVentureCode(db, ventureId);
  if (isGlobalRole(session.role)) return { ok: true, code, session, global: true, assignments: [] };
  if (!session.cid) return { ok: false };
  const r = await db.execute({
    sql: `SELECT a.id, a.responsibility_code, a.scope_type
          FROM venture_staff_assignments a
          WHERE a.venture_id = ? AND a.staff_contact_id = ? AND a.status = 'active'`,
    args: [code, session.cid],
  });
  const assignments = r.rows || [];
  if (assignments.length === 0) return { ok: false };
  return { ok: true, code, session, global: false, assignments };
}

/** Cell-level check (platform default + per-venture override) per assignment. */
async function cellAllows(db, ventureCode, responsibilityCode, action) {
  try {
    const ov = await db.execute({
      sql: "SELECT allowed FROM venture_permission_overrides WHERE venture_id = ? AND responsibility_code = ? AND area = 'operating_plan' AND action = ?",
      args: [ventureCode, responsibilityCode, action],
    });
    if (ov.rows?.[0]) return !!ov.rows[0].allowed;
    const def = await db.execute({
      sql: "SELECT allowed FROM venture_permission_matrix WHERE responsibility_code = ? AND area = 'operating_plan' AND action = ?",
      args: [responsibilityCode, action],
    });
    return !!def.rows?.[0]?.allowed;
  } catch (_) {
    return false;
  }
}

/**
 * Whether the user may perform `action` on operating plans.
 * view/comment: any assignment with the cell allowed.
 * create/edit/manage/delete: cell allowed AND venture-wide assignment.
 */
export async function allowsPlanAction(db, access, action) {
  if (access.global) return true;
  const writeActions = ["create", "edit", "manage", "delete"];
  for (const a of access.assignments) {
    const cellOk = await cellAllows(db, access.code, a.responsibility_code, action);
    if (!cellOk) continue;
    if (!writeActions.includes(action)) return true;
    if (String(a.scope_type || "") === "venture_wide") return true;
  }
  return false;
}

// ── Reusable templates (Phase 5) ───────────────────────────────────────────

export async function listPlanTemplates(db, { activeOnly = true } = {}) {
  const r = await db.execute({
    sql: `SELECT t.*,
      (SELECT COUNT(*) FROM venture_plan_template_sections s WHERE s.template_id = t.id) AS section_count
      FROM venture_plan_templates t
      WHERE (? = 0 OR t.is_active = TRUE)
      ORDER BY t.name`,
    args: [activeOnly ? 1 : 0],
  });
  return r.rows || [];
}

/** Save a live plan (structure only) as a reusable template. */
export async function createTemplateFromPlan(db, { planId, name, description, actorCid = null }) {
  const planRes = await db.execute({ sql: "SELECT * FROM venture_operating_plans WHERE id = ?", args: [planId] });
  const plan = planRes.rows?.[0];
  if (!plan) return { error: "Plan not found." };

  const tRes = await db.execute({
    sql: "INSERT INTO venture_plan_templates (name, description, created_by) VALUES (?,?,?) RETURNING id",
    args: [name || plan.name, description || plan.objective || null, actorCid],
  });
  const templateId = tRes.rows?.[0]?.id;
  const secRes = await db.execute({
    sql: "SELECT title, objective, instructions, sort_order FROM venture_plan_sections WHERE plan_id = ? ORDER BY sort_order, id",
    args: [planId],
  });
  for (const s of secRes.rows || []) {
    await db.execute({
      sql: "INSERT INTO venture_plan_template_sections (template_id, title, objective, instructions, sort_order) VALUES (?,?,?,?,?)",
      args: [templateId, s.title, s.objective, s.instructions, s.sort_order || 0],
    });
  }
  return { success: true, id: templateId };
}

/** Apply a template to a Venture — copies structure ONLY (never data). */
export async function applyTemplateToVenture(db, { templateId, ventureCode, name = null, actorCid = null }) {
  const tRes = await db.execute({ sql: "SELECT * FROM venture_plan_templates WHERE id = ? AND is_active = TRUE", args: [templateId] });
  const template = tRes.rows?.[0];
  if (!template) return { error: "Template not found or inactive." };

  const pRes = await db.execute({
    sql: "INSERT INTO venture_operating_plans (venture_id, name, objective, status, created_by) VALUES (?,?,?,?,?) RETURNING id",
    args: [ventureCode, name || template.name, template.description || null, "draft", actorCid],
  });
  const planId = pRes.rows?.[0]?.id;
  const secRes = await db.execute({
    sql: "SELECT title, objective, instructions, sort_order FROM venture_plan_template_sections WHERE template_id = ? ORDER BY sort_order, id",
    args: [templateId],
  });
  for (const s of secRes.rows || []) {
    await db.execute({
      sql: "INSERT INTO venture_plan_sections (plan_id, title, objective, instructions, sort_order) VALUES (?,?,?,?,?)",
      args: [planId, s.title, s.objective, s.instructions, s.sort_order || 0],
    });
  }
  return { success: true, id: planId };
}
