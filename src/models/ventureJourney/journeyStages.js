import db from "@/lib/db";

/**
 * Venture Journey model — Journey stages and milestone spine (REPOSITORY layer).
 *
 * The stage CRUD and the roadmap reads behind `/api/ventures/[id]/journey`.
 * Split verbatim out of `models/ventureJourney.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Milestones bound to a Journey stage (rich columns), for the roadmap spine. */
export async function listJourneyMilestonesByStage(dbId) {
  return db.execute({
    sql: `SELECT id, title, description, objective, status, progress, target_date,
                 priority, display_order, created_at, journey_stage_id
          FROM venture_milestones
          WHERE venture_id = ? AND journey_stage_id IS NOT NULL
          ORDER BY COALESCE(display_order, 0), created_at ASC`,
    args: [dbId],
  });
}

/** Milestone spine without the additive columns (pre-migration databases). */
export async function listJourneyMilestonesByStageLegacy(dbId) {
  return db.execute({
    sql: `SELECT id, title, status, progress, target_date, journey_stage_id
          FROM venture_milestones
          WHERE venture_id = ? AND journey_stage_id IS NOT NULL
          ORDER BY COALESCE(display_order, 0), created_at ASC`,
    args: [dbId],
  });
}

/** Evidence attached to the milestones bound to the Journey. */
export async function listJourneyDeliverablesByMilestoneIds(milestoneIds) {
  return db.execute({
    sql: `SELECT id, milestone_id, title, description, deliverable_type, status, approval_status,
                 due_date, attachment_url, attachment_name, rejection_reason, reviewer_name
          FROM venture_deliverables
          WHERE milestone_id::text = ANY(?)
          ORDER BY created_at ASC`,
    args: [milestoneIds],
  });
}

/** Task statuses per milestone bound to the Journey (archived tasks excluded). */
export async function listJourneyTaskStatusesByMilestoneIds(milestoneIds) {
  return db.execute({
    sql: "SELECT milestone_id, status FROM venture_tasks WHERE milestone_id::text = ANY(?) AND COALESCE(is_archived, FALSE) = FALSE",
    args: [milestoneIds],
  });
}

/** Task statuses per milestone, without the archive filter (pre-migration databases). */
export async function listJourneyTaskStatusesByMilestoneIdsLegacy(milestoneIds) {
  return db.execute({
    sql: "SELECT milestone_id, status FROM venture_tasks WHERE milestone_id::text = ANY(?)",
    args: [milestoneIds],
  });
}

/**
 * Current name of the reusable template a Journey stage was generated from.
 * `table` is chosen by the caller between the two known template tables.
 */
export async function getJourneyTemplateName(table, templateId) {
  return db.execute({
    sql: `SELECT name FROM ${table} WHERE id = ?`,
    args: [templateId],
  });
}

/** Stage count for a Venture (first-stage status decision). */
export async function countJourneyStagesByVenture(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS n FROM venture_journey_stages WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Create a Journey stage row. */
export async function insertJourneyStage({ ventureId, name, description, objective, startDate, targetDate, stageOrder, status }) {
  return db.execute({
    sql: `INSERT INTO venture_journey_stages (venture_id, name, description, objective, start_date, target_date, stage_order, status)
            VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
    args: [ventureId, name, description, objective, startDate, targetDate, stageOrder, status],
  });
}

/** Update a Journey stage's editable fields (args assembled by the controller). */
export async function updateJourneyStageFields(args) {
  return db.execute({
    sql: `UPDATE venture_journey_stages SET
            name = COALESCE(?, name),
            description = CASE WHEN ? = 1 THEN ? ELSE description END,
            objective = CASE WHEN ? = 1 THEN ? ELSE objective END,
            target_date = CASE WHEN ? = 1 THEN ?::date ELSE target_date END,
            start_date = CASE WHEN ? = 1 THEN ?::date ELSE start_date END
          WHERE id = ? AND venture_id = ?`,
    args,
  });
}

/** Mark a Journey stage active. */
export async function activateJourneyStage(stageId, dbId) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'active' WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
}

/** Return a Journey stage to its held (upcoming) state. */
export async function lockJourneyStage(stageId, dbId) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'upcoming', completed_at = NULL, approved_by = NULL WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
}

/** Hold the unreleased work of a Journey that is no longer active. */
export async function holdJourneyStageMilestones(dbId, stageId) {
  return db.execute({
    sql: `UPDATE venture_milestones SET status = 'upcoming', updated_at = NOW()
          WHERE venture_id = ? AND journey_stage_id = ? AND status IN ('blocked', 'not_started', 'locked')`,
    args: [dbId, stageId],
  });
}

/** Reopen a Journey stage (active again, previous approval cleared). */
export async function resetJourneyStage(stageId, dbId) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'active', completed_at = NULL, approved_by = NULL WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
}
