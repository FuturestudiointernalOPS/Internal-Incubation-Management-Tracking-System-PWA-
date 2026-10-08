import db from "@/lib/db";

// ── POST /api/ventures/[id]/journey/apply-template ───────────────────────────

/** An active plan template, by id. */
export async function getActiveVenturePlanTemplate(templateId) {
  return db.execute({ sql: "SELECT id, name FROM venture_plan_templates WHERE id = ? AND is_active = TRUE", args: [templateId] });
}

/** A template's sections (title + objective), in order. */
export async function listVenturePlanTemplateSections(templateId) {
  return db.execute({ sql: "SELECT title, objective FROM venture_plan_template_sections WHERE template_id = ? ORDER BY sort_order, id", args: [templateId] });
}

/** How many journey stages a Venture db id already has. */
export async function countVentureJourneyStages(dbId) {
  return db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_journey_stages WHERE venture_id = ?", args: [dbId] });
}

/** Insert one journey stage generated from a template. */
export async function insertJourneyStageFromTemplate({ dbId, name, description, stageOrder, status, templateType, templateId }) {
  return db.execute({
    sql: `INSERT INTO venture_journey_stages (venture_id, name, description, stage_order, status, source_template_type, source_template_id)
          VALUES (?,?,?,?,?,?,?)`,
    args: [dbId, name, description, stageOrder, status, templateType, templateId],
  });
}

// ── /api/venture-permissions/responsibilities ────────────────────────────────

/** Insert a Venture responsibility definition. */
export async function insertVentureResponsibility({ code, name, description, createdBy }) {
  return db.execute({
    sql: "INSERT INTO venture_responsibilities (code, name, description, created_by) VALUES (?,?,?,?)",
    args: [code, name, description, createdBy],
  });
}

/** Update a Venture responsibility (COALESCE: absent = unchanged). */
export async function updateVentureResponsibility({ code, name, description, isActive }) {
  return db.execute({
    sql: "UPDATE venture_responsibilities SET name = COALESCE(?, name), description = COALESCE(?, description), is_active = COALESCE(?, is_active), updated_at = NOW() WHERE code = ?",
    args: [name, description, isActive, code],
  });
}

// ── /api/venture-plan-templates ──────────────────────────────────────────────

/** A plan's Venture id + name (template save guard). */
export async function getPlanVentureIdAndName(planId) {
  return db.execute({ sql: "SELECT venture_id, name FROM venture_operating_plans WHERE id = ?", args: [planId] });
}

/** Activate/deactivate a plan template. */
export async function setVenturePlanTemplateActive(id, isActive) {
  return db.execute({ sql: "UPDATE venture_plan_templates SET is_active = ?, updated_at = NOW() WHERE id = ?", args: [isActive, id] });
}
