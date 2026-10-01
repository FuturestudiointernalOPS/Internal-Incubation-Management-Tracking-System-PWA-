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
 *  - GLOBAL roles (super_admin): full access.
 *  - Delegated staff: require an active assignment. Cell-level action checks
 *    read the configurable matrix (defaults + per-venture overrides). Write
 *    actions (create/edit/manage/delete) additionally require a venture-wide
 *    assignment, so a scoped GTM Coach can view/comment but never author.
 *
 * Every statement lives in `@/models/ventureOperatingPlanStore`; nothing here
 * runs SQL. Re-exported unchanged through the compatibility facade
 * `@/lib/ventureOperatingPlans` — see docs/LAYER_SPLIT.md.
 */

import {
  selectVentureCodeByIdText,
  selectActivePlanAssignments,
  selectOperatingPlanMatrixCell,
  selectPlanTemplates,
  selectOperatingPlanById,
  insertPlanTemplate,
  selectPlanSectionsForTemplate,
  insertPlanTemplateSection,
  selectActivePlanTemplateById,
  insertOperatingPlanFromTemplate,
  selectTemplateSectionsForApply,
  insertPlanSectionFromTemplate,
} from "@/models/ventureOperatingPlanStore";

const GLOBAL_ROLES = ["super_admin"];

export async function resolveVentureCode(ventureId) {
  let code = ventureId;
  if (typeof ventureId === "string" && ventureId.includes("-") && !ventureId.startsWith("VNT-")) {
    try {
      const lookupResult = await selectVentureCodeByIdText(ventureId);
      if (lookupResult.rows?.[0]) code = lookupResult.rows[0].venture_id;
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
export async function resolvePlanAccess(ventureId, session) {
  if (!session?.cid && !session?.role) return { ok: false };
  const code = await resolveVentureCode(ventureId);
  if (isGlobalRole(session.role)) return { ok: true, code, session, global: true, assignments: [] };
  if (!session.cid) return { ok: false };
  const result = await selectActivePlanAssignments(code, session.cid);
  const assignments = result.rows || [];
  if (assignments.length === 0) return { ok: false };
  return { ok: true, code, session, global: false, assignments };
}

/** Cell-level check — GLOBAL matrix (single source of truth; no per-Venture overrides). */
async function cellAllows(responsibilityCode, action) {
  try {
    const matrixRow = await selectOperatingPlanMatrixCell(responsibilityCode, action);
    return !!matrixRow.rows?.[0]?.allowed;
  } catch (_) {
    return false;
  }
}

/**
 * Whether the user may perform `action` on operating plans.
 * view/comment: any assignment with the cell allowed.
 * create/edit/manage/delete: cell allowed AND venture-wide assignment.
 */
export async function allowsPlanAction(access, action) {
  if (access.global) return true;
  const writeActions = ["create", "edit", "manage", "delete"];
  for (const assignment of access.assignments) {
    const cellOk = await cellAllows(assignment.responsibility_code, action);
    if (!cellOk) continue;
    if (!writeActions.includes(action)) return true;
    if (String(assignment.scope_type || "") === "venture_wide") return true;
  }
  return false;
}

// ── Reusable templates (Phase 5) ───────────────────────────────────────────

export async function listPlanTemplates({ activeOnly = true } = {}) {
  const result = await selectPlanTemplates(activeOnly);
  return result.rows || [];
}

/** Save a live plan (structure only) as a reusable template. */
export async function createTemplateFromPlan({ planId, name, description, actorCid = null }) {
  const plan = (await selectOperatingPlanById(planId)).rows?.[0];
  if (!plan) return { error: "Plan not found." };

  const templateResult = await insertPlanTemplate(name || plan.name, description || plan.objective || null, actorCid);
  const templateId = templateResult.rows?.[0]?.id;
  const sectionsResult = await selectPlanSectionsForTemplate(planId);
  for (const section of sectionsResult.rows || []) {
    await insertPlanTemplateSection(templateId, section);
  }
  return { success: true, id: templateId };
}

/** Apply a template to a Venture — copies structure ONLY (never data). */
export async function applyTemplateToVenture({ templateId, ventureCode, name = null, actorCid = null }) {
  const template = (await selectActivePlanTemplateById(templateId)).rows?.[0];
  if (!template) return { error: "Template not found or inactive." };

  const planResult = await insertOperatingPlanFromTemplate(ventureCode, name || template.name, template.description || null, actorCid);
  const planId = planResult.rows?.[0]?.id;
  const sectionsResult = await selectTemplateSectionsForApply(templateId);
  for (const section of sectionsResult.rows || []) {
    await insertPlanSectionFromTemplate(planId, section);
  }
  return { success: true, id: planId };
}
