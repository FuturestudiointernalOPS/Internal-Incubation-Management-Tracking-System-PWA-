import db from "@/lib/db";

// ── /api/ventures/[id]/operating-plans (+ [planId], [planId]/sections) ───────

/** A Venture's operating plans with their section counts. */
export async function listVentureOperatingPlans(ventureCode) {
  return db.execute({
    sql: `SELECT p.*,
        (SELECT COUNT(*) FROM venture_plan_sections s WHERE s.plan_id = p.id) AS section_count,
        (SELECT COUNT(*) FROM venture_plan_sections s WHERE s.plan_id = p.id AND s.status = 'completed') AS completed_sections
        FROM venture_operating_plans p WHERE p.venture_id = ? ORDER BY p.created_at DESC`,
    args: [ventureCode],
  });
}

/** Insert an operating plan, returning the new id. */
export async function insertVentureOperatingPlan({ ventureCode, name, objective, createdBy }) {
  return db.execute({
    sql: "INSERT INTO venture_operating_plans (venture_id, name, objective, created_by) VALUES (?,?,?,?) RETURNING id",
    args: [ventureCode, name, objective, createdBy],
  });
}

/** One operating plan of a Venture, by id (full row). */
export async function getVentureOperatingPlan(planId, ventureCode) {
  return db.execute({ sql: "SELECT * FROM venture_operating_plans WHERE id = ? AND venture_id = ?", args: [planId, ventureCode] });
}

/** A plan's sections, in display order. */
export async function listVenturePlanSections(planId) {
  return db.execute({ sql: "SELECT * FROM venture_plan_sections WHERE plan_id = ? ORDER BY sort_order, id", args: [planId] });
}

/** A plan's links (joined to its sections), in order. */
export async function listVenturePlanLinks(planId) {
  return db.execute({
    sql: `SELECT l.* FROM venture_plan_links l
          JOIN venture_plan_sections s ON s.id = l.section_id
          WHERE s.plan_id = ? ORDER BY l.id`,
    args: [planId],
  });
}

/** Update a plan's name/objective/status (COALESCE: absent = unchanged). */
export async function updateVentureOperatingPlan({ planId, ventureCode, name, objective, status }) {
  return db.execute({
    sql: "UPDATE venture_operating_plans SET name = COALESCE(?, name), objective = COALESCE(?, objective), status = COALESCE(?, status), updated_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [name, objective, status, planId, ventureCode],
  });
}

/** Existence check: an operating plan of a Venture, by id. */
export async function ventureOperatingPlanExists(planId, ventureCode) {
  return db.execute({ sql: "SELECT id FROM venture_operating_plans WHERE id = ? AND venture_id = ?", args: [planId, ventureCode] });
}

/** Archive an operating plan. */
export async function archiveVentureOperatingPlan(planId, ventureCode) {
  return db.execute({ sql: "UPDATE venture_operating_plans SET status = 'archived', updated_at = NOW() WHERE id = ? AND venture_id = ?", args: [planId, ventureCode] });
}

/** Existence check: a live (non-archived) plan of a Venture. */
export async function liveVenturePlanExists(planId, ventureCode) {
  return db.execute({ sql: "SELECT id FROM venture_operating_plans WHERE id = ? AND venture_id = ? AND status <> 'archived'", args: [planId, ventureCode] });
}

/** Existence check: a section of a plan. */
export async function venturePlanSectionExists(sectionId, planId) {
  return db.execute({ sql: "SELECT id FROM venture_plan_sections WHERE id = ? AND plan_id = ?", args: [sectionId, planId] });
}

/** Insert a plan link (idempotent). */
export async function insertVenturePlanLink({ sectionId, refType, refId, label, createdBy }) {
  return db.execute({
    sql: "INSERT INTO venture_plan_links (section_id, ref_type, ref_id, label, created_by) VALUES (?,?,?,?,?) ON CONFLICT (section_id, ref_type, ref_id) DO NOTHING",
    args: [sectionId, refType, refId, label, createdBy],
  });
}

/** Insert a plan section, returning the new id. */
export async function insertVenturePlanSection({ planId, title, objective, instructions, sortOrder }) {
  return db.execute({
    sql: "INSERT INTO venture_plan_sections (plan_id, title, objective, instructions, sort_order) VALUES (?,?,?,?,?) RETURNING id",
    args: [planId, title, objective, instructions, sortOrder],
  });
}

/** Update a section's fields (COALESCE: absent = unchanged). */
export async function updateVenturePlanSection({ sectionId, planId, title, objective, instructions, status, sortOrder }) {
  return db.execute({
    sql: `UPDATE venture_plan_sections SET
              title = COALESCE(?, title),
              objective = COALESCE(?, objective),
              instructions = COALESCE(?, instructions),
              status = COALESCE(?, status),
              sort_order = COALESCE(?, sort_order),
              updated_at = NOW()
            WHERE id = ? AND plan_id = ?`,
    args: [title, objective, instructions, status, sortOrder, sectionId, planId],
  });
}

/** A link of a plan, by id. */
export async function getVenturePlanLink(linkId, planId) {
  return db.execute({
    sql: "SELECT l.id FROM venture_plan_links l JOIN venture_plan_sections s ON s.id = l.section_id WHERE l.id = ? AND s.plan_id = ?",
    args: [linkId, planId],
  });
}

/** Delete a plan link. */
export async function deleteVenturePlanLink(linkId) {
  return db.execute({ sql: "DELETE FROM venture_plan_links WHERE id = ?", args: [linkId] });
}

/** Delete a plan section. */
export async function deleteVenturePlanSection(sectionId, planId) {
  return db.execute({ sql: "DELETE FROM venture_plan_sections WHERE id = ? AND plan_id = ?", args: [sectionId, planId] });
}
