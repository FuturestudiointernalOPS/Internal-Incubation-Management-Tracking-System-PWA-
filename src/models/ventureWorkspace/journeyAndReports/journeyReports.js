import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

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
  // `venture_milestones.venture_id` is a UUID, while the owner list also carries
  // the human code (VNT-…): compared as text, so the code is never cast to a UUID
  // (which failed the whole read and dropped the milestones from the report).
  return db.execute({
    sql: `SELECT id, journey_stage_id, title, status, target_date FROM venture_milestones
              WHERE venture_id::text IN (${owners.map(() => "?").join(", ")}) AND journey_stage_id IS NOT NULL
                AND COALESCE(is_archived, FALSE) = FALSE`,
    args: owners,
  });
}

/** Task statuses + due dates of a Venture (owner ids; archived tasks excluded). */
export function listVentureTaskDeadlinesForReport(owners) {
  return db.execute({
    sql: `SELECT status, due_date FROM venture_tasks WHERE venture_id IN (${owners.map(() => "?").join(", ")}) AND COALESCE(is_archived, FALSE) = FALSE`,
    args: owners,
  });
}

/**
 * Reviewed submissions of a Venture (owner ids), ONE row per task — the latest
 * version, exactly as the roadmap readiness engine counts them. A task reviewed
 * twice used to contribute both versions, so the report disagreed with Roadmap
 * Progress about how much reviewed work existed.
 */
export function listVentureReviewedSubmissionsForReport(owners) {
  return db.execute({
    sql: `SELECT s.review_decision, s.reviewed_at
              FROM venture_task_submissions s
              JOIN venture_tasks t ON t.id = s.task_id
              WHERE t.venture_id IN (${owners.map(() => "?").join(", ")})
                AND COALESCE(t.is_archived, FALSE) = FALSE
                AND s.review_decision IS NOT NULL
                AND s.version = (
                  SELECT MAX(s2.version) FROM venture_task_submissions s2
                   WHERE s2.task_id = s.task_id
                )`,
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

/** Active staff assignments of a Venture (code or internal id). */
export async function listVentureStaffAssignmentsForReport(id) {
  // `venture_staff_assignments.venture_id` is UUID on the live schema; the
  // report route hands the decorative VNT code from the URL. Passing that code
  // raw raises "invalid input syntax for type uuid" and emptied the staff block.
  const ventureId = await resolveVentureInternalId(id);
  return db.execute({
    sql: `SELECT responsibility_code, staff_contact_id, scope_type
              FROM venture_staff_assignments WHERE venture_id = ? AND status = 'active'`,
    args: [ventureId],
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
