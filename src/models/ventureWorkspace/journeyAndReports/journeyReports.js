import db from "@/lib/db";

// ── GET /api/ventures/[id]/journey-report ────────────────────────────────────

/** A Venture's live journey stages (archived-aware), in order. */
export function listVentureStagesForReport(dbId) {
  return db.execute({
    sql: `SELECT id, name, status, stage_order, target_date, completed_at
              FROM venture_journey_stages WHERE venture_id = ? AND COALESCE(is_archived, FALSE) = FALSE
              ORDER BY stage_order ASC`,
    args: [dbId],
  });
}

/** Legacy fallback: the same stages without the archive guard. */
export function listVentureStagesForReportLegacy(dbId) {
  return db.execute({
    sql: `SELECT id, name, status, stage_order, target_date, completed_at
                FROM venture_journey_stages WHERE venture_id = ?
                ORDER BY stage_order ASC`,
    args: [dbId],
  });
}

/** Journey-bound milestones of a Venture (owner ids). */
export function listVentureMilestonesForReport(owners) {
  return db.execute({
    sql: `SELECT id, journey_stage_id, title, status, target_date FROM venture_milestones
              WHERE venture_id IN (${owners.map(() => "?").join(", ")}) AND journey_stage_id IS NOT NULL`,
    args: owners,
  });
}

/** Task statuses + due dates of a Venture (owner ids). */
export function listVentureTaskDeadlinesForReport(owners) {
  return db.execute({
    sql: `SELECT status, due_date FROM venture_tasks WHERE venture_id IN (${owners.map(() => "?").join(", ")})`,
    args: owners,
  });
}

/** Reviewed submissions of a Venture (owner ids). */
export function listVentureReviewedSubmissionsForReport(owners) {
  return db.execute({
    sql: `SELECT s.review_decision, s.reviewed_at
              FROM venture_task_submissions s
              JOIN venture_tasks t ON t.id = s.task_id
              WHERE t.venture_id IN (${owners.map(() => "?").join(", ")}) AND s.review_decision IS NOT NULL`,
    args: owners,
  });
}

/** Session facts of a Venture (owner ids). */
export function listVentureSessionsForReport(owners) {
  return db.execute({
    sql: `SELECT status, venture_facing, journey_stage_id, start_time
              FROM venture_sessions WHERE venture_id IN (${owners.map(() => "?").join(", ")})`,
    args: owners,
  });
}

/** Active staff assignments of a Venture (VNT code). */
export function listVentureStaffAssignmentsForReport(id) {
  return db.execute({
    sql: `SELECT responsibility_code, staff_contact_id, scope_type
              FROM venture_staff_assignments WHERE venture_id = ? AND status = 'active'`,
    args: [id],
  });
}

/** Deliverables awaiting review of a Venture (owner ids). */
export function listVentureSubmitedDeliverablesForReport(owners) {
  return db.execute({
    sql: `SELECT status FROM venture_deliverables
              WHERE venture_id IN (${owners.map(() => "?").join(", ")}) AND status = 'submitted'`,
    args: owners,
  });
}

/** Deliverables carrying attached evidence (owner ids). */
export function listVentureEvidencedDeliverablesForReport(owners) {
  return db.execute({
    sql: `SELECT id, milestone_id, title, status, approval_status, attachment_url, attachment_name
              FROM venture_deliverables
              WHERE venture_id IN (${owners.map(() => "?").join(", ")}) AND attachment_url IS NOT NULL
              ORDER BY created_at ASC`,
    args: owners,
  });
}
