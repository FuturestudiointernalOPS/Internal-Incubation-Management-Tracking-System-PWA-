import db from "@/lib/db";

/**
 * Venture Journey model — KPIs (REPOSITORY layer).
 *
 * The KPI assignment reads/writes and the auto-calc source counters behind
 * `/api/ventures/[id]/kpis`. Split verbatim out of `models/ventureJourney.js` —
 * see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getKpisVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Customer interview count (auto-calc source "customer_interviews"). */
export async function countKpiCustomerInterviews(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as c FROM venture_customer_interviews WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Average milestone progress (auto-calc source "milestones"). */
export async function getKpiAverageMilestoneProgress(ventureId) {
  return db.execute({
    sql: "SELECT AVG(progress) as avg_progress FROM venture_milestones WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Done task count (auto-calc source "tasks"). */
export async function countKpiDoneTasks(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as c FROM venture_tasks WHERE venture_id = ? AND status = 'done'",
    args: [ventureId],
  });
}

/** KPI assignments joined with their definitions, ordered by name. */
export async function getKpiAssignments(ventureId) {
  return db.execute({
    sql: `SELECT a.id, a.venture_id, a.kpi_definition_id, a.target_value, a.current_value, a.updated_at,
                   d.name, d.description, d.unit, d.auto_calc_source
            FROM venture_kpi_assignments a
            JOIN venture_kpi_definitions d ON d.id = a.kpi_definition_id
            WHERE a.venture_id = ?
            ORDER BY d.name`,
    args: [ventureId],
  });
}

/** Persist an auto-calculated KPI value on its assignment row. */
export async function updateKpiAutoCalcValue(currentValue, assignmentId) {
  return db.execute({
    sql: "UPDATE venture_kpi_assignments SET current_value = ?, updated_at = NOW() WHERE id = ?",
    args: [currentValue, assignmentId],
  });
}

/** Assign a KPI definition to a venture. */
export async function createKpiAssignment(ventureId, kpiDefinitionId, targetValue) {
  return db.execute({
    sql: "INSERT INTO venture_kpi_assignments (venture_id, kpi_definition_id, target_value) VALUES (?,?,?)",
    args: [ventureId, kpiDefinitionId, targetValue],
  });
}

/** Whether an assignment's KPI is auto-calculated (manual-edit guard). */
export async function getKpiAssignmentAutoCalcSource(assignmentId, ventureId) {
  return db.execute({
    sql: `SELECT d.auto_calc_source FROM venture_kpi_assignments a
            JOIN venture_kpi_definitions d ON d.id = a.kpi_definition_id
            WHERE a.id = ? AND a.venture_id = ?`,
    args: [assignmentId, ventureId],
  });
}

/** Manually update a KPI assignment value (venture-scoped). */
export async function updateKpiManualValue(currentValue, assignmentId, ventureId) {
  return db.execute({
    sql: "UPDATE venture_kpi_assignments SET current_value = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [currentValue, assignmentId, ventureId],
  });
}
