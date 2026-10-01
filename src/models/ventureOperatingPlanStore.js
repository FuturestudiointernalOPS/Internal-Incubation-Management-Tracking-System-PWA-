/**
 * Venture operating plans — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/operatingPlans`: the Venture-code
 * lookup, the actor's active assignments, the `operating_plan` matrix cell, and
 * the plan/template reads and structure writes. The access decisions (who may
 * plan, the write-requires-venture-wide rule) live in the service.
 *
 * SQL is byte-identical to what used to sit inline in
 * `src/lib/ventureOperatingPlans.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Access ───────────────────────────────────────────────────────────────────

/** The VNT code of a Venture from its internal UUID (text form). */
export function selectVentureCodeByIdText(ventureId) {
  return db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [ventureId] });
}

/** The actor's active assignments on one Venture (id + responsibility + scope). */
export function selectActivePlanAssignments(code, cid) {
  return db.execute({
    sql: `SELECT a.id, a.responsibility_code, a.scope_type
          FROM venture_staff_assignments a
          WHERE a.venture_id = ? AND a.staff_contact_id = ? AND a.status = 'active'`,
    args: [code, cid],
  });
}

/** The `operating_plan` matrix cell for one responsibility. */
export function selectOperatingPlanMatrixCell(responsibilityCode, action) {
  return db.execute({
    sql: "SELECT allowed FROM venture_permission_matrix WHERE responsibility_code = ? AND area = 'operating_plan' AND action = ?",
    args: [responsibilityCode, action],
  });
}

// ── Template library ─────────────────────────────────────────────────────────

/** Plan templates with their section count, by name. */
export function selectPlanTemplates(activeOnly) {
  return db.execute({
    sql: `SELECT t.*,
      (SELECT COUNT(*) FROM venture_plan_template_sections s WHERE s.template_id = t.id) AS section_count
      FROM venture_plan_templates t
      WHERE (? = 0 OR t.is_active = TRUE)
      ORDER BY t.name`,
    args: [activeOnly ? 1 : 0],
  });
}

/** One operating plan by id. */
export function selectOperatingPlanById(planId) {
  return db.execute({ sql: "SELECT * FROM venture_operating_plans WHERE id = ?", args: [planId] });
}

/** Create a template from a plan, returning its id. */
export function insertPlanTemplate(name, description, actorCid) {
  return db.execute({
    sql: "INSERT INTO venture_plan_templates (name, description, created_by) VALUES (?,?,?) RETURNING id",
    args: [name, description, actorCid],
  });
}

/** The sections of a plan, in order (template capture input). */
export function selectPlanSectionsForTemplate(planId) {
  return db.execute({
    sql: "SELECT title, objective, instructions, sort_order FROM venture_plan_sections WHERE plan_id = ? ORDER BY sort_order, id",
    args: [planId],
  });
}

/** Insert one template section. */
export function insertPlanTemplateSection(templateId, section) {
  return db.execute({
    sql: "INSERT INTO venture_plan_template_sections (template_id, title, objective, instructions, sort_order) VALUES (?,?,?,?,?)",
    args: [templateId, section.title, section.objective, section.instructions, section.sort_order || 0],
  });
}

// ── Apply a template ─────────────────────────────────────────────────────────

/** One active plan template by id. */
export function selectActivePlanTemplateById(templateId) {
  return db.execute({ sql: "SELECT * FROM venture_plan_templates WHERE id = ? AND is_active = TRUE", args: [templateId] });
}

/** Create a draft operating plan, returning its id. */
export function insertOperatingPlanFromTemplate(ventureCode, name, description, actorCid) {
  return db.execute({
    sql: "INSERT INTO venture_operating_plans (venture_id, name, objective, status, created_by) VALUES (?,?,?,?,?) RETURNING id",
    args: [ventureCode, name, description, "draft", actorCid],
  });
}

/** The sections of a template, in order (apply input). */
export function selectTemplateSectionsForApply(templateId) {
  return db.execute({
    sql: "SELECT title, objective, instructions, sort_order FROM venture_plan_template_sections WHERE template_id = ? ORDER BY sort_order, id",
    args: [templateId],
  });
}

/** Insert one plan section from a template. */
export function insertPlanSectionFromTemplate(planId, section) {
  return db.execute({
    sql: "INSERT INTO venture_plan_sections (plan_id, title, objective, instructions, sort_order) VALUES (?,?,?,?,?)",
    args: [planId, section.title, section.objective, section.instructions, section.sort_order || 0],
  });
}
