/**
 * Milestone progression engine — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/milestoneEngine`: the Venture code
 * lookup, the Journey stage/milestone reads, the release/hold/activation sweeps,
 * the dependency probe and the milestone-status sync writes. The decisions (what
 * availability means, the authority, the status derivation and combination) live
 * in the service.
 *
 * The sweeps interpolate two constants — the dependency guard and the held
 * statuses — which live here, right beside the SQL they belong to.
 *
 * SQL is byte-identical to what used to sit inline in
 * `src/lib/ventureMilestoneEngine.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { MILESTONE_UPCOMING, MILESTONE_BLOCKED } from "@/lib/ventureStatuses";

/** The archive guard appended to a sweep on a database that has the column. */
export const ARCHIVE_CLAUSE = "\n        AND COALESCE(is_archived, FALSE) = FALSE";

/** The same guard for a nested stage sub-select (deeper indentation). */
export const STAGE_ARCHIVE_CLAUSE = "\n            AND COALESCE(is_archived, FALSE) = FALSE";

/**
 * The dependency guard, shared by every release sweep: true when NO milestone
 * this row depends on is still unfinished. An edge (source -> target) means the
 * source BLOCKS the target, so the target frees up only once every source is
 * completed. Boundaries are matched as text (milestone ids are UUIDs).
 */
const NO_UNMET_BLOCKER = `
  NOT EXISTS (
    SELECT 1 FROM venture_dependencies d
    JOIN venture_milestones blocker ON blocker.id::text = d.source_id
    WHERE d.venture_id::text = venture_milestones.venture_id::text
      AND d.target_type = 'milestone' AND d.target_id = venture_milestones.id::text
      AND d.source_type = 'milestone'
      AND blocker.status <> 'completed'
  )`;

/** The held statuses a sweep may move: the two live states, plus the retired
 *  `locked` for rows written before the vocabulary migration ran. */
const HELD_STATUSES_SQL = `('upcoming', 'blocked', 'locked')`;

/** A milestone's tasks, read for their status alone. */
const milestoneTaskSql = (archiveClause) =>
  `SELECT status FROM venture_tasks WHERE milestone_id::text = ?${archiveClause}`;

// ── Venture code ─────────────────────────────────────────────────────────────

/** Venture id + VNT code from either form. */
export function selectVentureIdAndCodeByIdOrCode(id) {
  return db.execute({
    sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  });
}

// ── Journey stage reads ──────────────────────────────────────────────────────

/** One stage's status, scoped to its Venture. */
export function selectJourneyStageStatus(stageId, dbId) {
  return db.execute({
    sql: "SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [String(stageId), dbId],
  });
}

/** One stage's identity + status, scoped to its Venture (completion check). */
export function selectJourneyStageForCompletion(stageId, dbId) {
  return db.execute({
    sql: "SELECT id, name, status, stage_order FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [String(stageId), dbId],
  });
}

/** Live milestones of a stage (completion check). */
export function selectLiveMilestonesForStage(dbId, stageId) {
  return db.execute({
    sql: `SELECT id, status FROM venture_milestones
                     WHERE venture_id = ? AND journey_stage_id = ? AND COALESCE(is_archived, FALSE) = FALSE`,
    args: [dbId, String(stageId)],
  });
}

/** Live milestones of a stage, without the archive filter (fallback). */
export function selectLiveMilestonesForStagePlain(dbId, stageId) {
  return db.execute({
    sql: `SELECT id, status FROM venture_milestones WHERE venture_id = ? AND journey_stage_id = ?`,
    args: [dbId, String(stageId)],
  });
}

/** Close one Journey stage (every milestone completed). */
export function completeJourneyStageRow(cid, stageId, dbId) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'completed', completed_at = NOW(), approved_by = ? WHERE id = ? AND venture_id = ?",
    args: [cid, String(stageId), dbId],
  });
}

// ── Release sweep (stage-scoped) ─────────────────────────────────────────────

/** Offer a stage's held milestones, or mark them blocked on an unmet dependency. */
export function releaseHeldMilestonesForStage(archiveClause, dbId, stageId) {
  const statement = (clause) => `UPDATE venture_milestones
      SET status = CASE WHEN ${NO_UNMET_BLOCKER} THEN 'not_started' ELSE '${MILESTONE_BLOCKED}' END,
          updated_at = NOW()
      WHERE venture_id = ? AND journey_stage_id = ? AND status IN ${HELD_STATUSES_SQL}${clause}
      RETURNING id, status`;
  return db.execute({ sql: statement(archiveClause), args: [dbId, String(stageId)] });
}

// ── Venture-wide availability sweep ──────────────────────────────────────────

/** Activate every held Journey whose own start_date has arrived. */
export function activateDueJourneyStages(archiveClause, dbId) {
  const statement = (clause) => `UPDATE venture_journey_stages SET status = 'active'
      WHERE venture_id = ? AND status IN ('upcoming', 'locked')
        AND start_date IS NOT NULL AND start_date <= CURRENT_DATE${clause}
      RETURNING id`;
  return db.execute({ sql: statement(archiveClause), args: [dbId] });
}

/** Hold the milestones of every Journey that is not active (unreleased planning). */
export function holdMilestonesForInactiveStages(archiveClause, stageArchiveClause, dbId) {
  const statement = (clause, stageClause) => `UPDATE venture_milestones
      SET status = '${MILESTONE_UPCOMING}', updated_at = NOW()
      WHERE venture_id = ? AND status IN ('blocked', 'not_started', 'locked')${clause}
        AND journey_stage_id IN (
          SELECT id FROM venture_journey_stages
          WHERE venture_id = ? AND status <> 'active'${stageClause}
        )
      RETURNING id`;
  return db.execute({ sql: statement(archiveClause, stageArchiveClause), args: [dbId, dbId] });
}

/** Offer the held milestones of every ACTIVE Journey (dependency may block one). */
export function releaseHeldMilestonesForActiveStages(archiveClause, stageArchiveClause, dbId) {
  const statement = (clause, stageClause) => `UPDATE venture_milestones
      SET status = CASE WHEN ${NO_UNMET_BLOCKER} THEN 'not_started' ELSE '${MILESTONE_BLOCKED}' END,
          updated_at = NOW()
      WHERE venture_id = ? AND status IN ${HELD_STATUSES_SQL}${clause}
        AND journey_stage_id IN (
          SELECT id FROM venture_journey_stages
          WHERE venture_id = ? AND status = 'active'${stageClause}
        )
      RETURNING id, status`;
  return db.execute({ sql: statement(archiveClause, stageArchiveClause), args: [dbId, dbId] });
}

// ── Dependencies ─────────────────────────────────────────────────────────────

/** The unfinished milestones a milestone explicitly depends on. */
export function selectUnmetDependencies(dbId, milestoneId) {
  return db.execute({
    sql: `SELECT blocker.id, blocker.title, blocker.status
              FROM venture_dependencies d
              JOIN venture_milestones blocker ON blocker.id::text = d.source_id
              WHERE d.venture_id::text = ?::text
                AND d.target_type = 'milestone' AND d.target_id = ?
                AND d.source_type = 'milestone'
                AND blocker.status <> 'completed'
              ORDER BY blocker.title`,
    args: [String(dbId), String(milestoneId)],
  });
}

// ── Booking ──────────────────────────────────────────────────────────────────

/** One milestone (with the archive flag) for the booking gate. */
export function selectMilestoneForBooking(milestoneId, dbId) {
  return db.execute({
    sql: `SELECT id, title, status, journey_stage_id, is_archived
              FROM venture_milestones WHERE id::text = ? AND venture_id = ?`,
    args: [String(milestoneId), dbId],
  });
}

/** One milestone for the booking gate, without the archive column (fallback). */
export function selectMilestoneForBookingPlain(milestoneId, dbId) {
  return db.execute({
    sql: `SELECT id, title, status, journey_stage_id
                FROM venture_milestones WHERE id::text = ? AND venture_id = ?`,
    args: [String(milestoneId), dbId],
  });
}

/** One stage's identity + status for the booking gate. */
export function selectJourneyStageForBooking(stageId, dbId) {
  return db.execute({
    sql: `SELECT id, name, status FROM venture_journey_stages
              WHERE id = ? AND venture_id = ?`,
    args: [String(stageId), dbId],
  });
}

// ── Status sync ──────────────────────────────────────────────────────────────

/** One milestone's identity for the work-driven status sync. */
export function selectMilestoneForSync(milestoneId, dbId) {
  return db.execute({
    sql: "SELECT id, title, status, journey_stage_id FROM venture_milestones WHERE id = ? AND venture_id = ?",
    args: [milestoneId, dbId],
  });
}

/** A milestone's deliverables, for their states alone. */
export function selectDeliverableStatesForMilestone(milestoneId) {
  return db.execute({
    sql: "SELECT status, approval_status FROM venture_deliverables WHERE milestone_id::text = ?",
    args: [String(milestoneId)],
  });
}

/** A milestone's task statuses, archived rows excluded. */
export function selectActiveTaskStatusesForMilestone(milestoneId) {
  return db.execute({ sql: milestoneTaskSql(" AND COALESCE(is_archived, FALSE) = FALSE"), args: [String(milestoneId)] });
}

/** A milestone's task statuses, without the archive filter (fallback). */
export function selectTaskStatusesForMilestonePlain(milestoneId) {
  return db.execute({ sql: milestoneTaskSql(""), args: [String(milestoneId)] });
}

/** Move one milestone to the status its work implies. */
export function updateMilestoneStatusRow(target, milestoneId, dbId) {
  return db.execute({
    sql: "UPDATE venture_milestones SET status = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [target, milestoneId, dbId],
  });
}

/** Mark one milestone completed. */
export function completeMilestoneRow(milestoneId, dbId) {
  return db.execute({
    sql: "UPDATE venture_milestones SET status = 'completed', progress = 100, updated_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [milestoneId, dbId],
  });
}
