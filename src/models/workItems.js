import db from "@/lib/db";

/**
 * Work items — the management reads over EXISTING Venture work (REPOSITORY).
 *
 * The Projects view reads the same journey, milestones, tasks and deliverables
 * the Journey screen does. There is deliberately no second model of the work:
 * one statement per query, named after the data, no decisions.
 *
 * TWO RULES THIS FILE EXISTS TO KEEP
 *
 * 1. DATES ARE FORMATTED BY THE DATABASE, never by JS. A `date` column comes
 *    back from node-postgres as LOCAL midnight, so `toISOString()` on a server
 *    east of UTC renders every date one day early. `to_char(...)` returns a
 *    string with no timezone in it, so "12 Oct" is 12 Oct everywhere.
 *
 * 2. `venture_id` IS MATCHED IN BOTH FORMS. Two DDL generations wrote this
 *    column — the internal UUID (imported rows) and the VNT code (legacy rows)
 *    — so every read takes `(dbId, ventureCode)` and asks for either.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement.
 */

/** Journey stages of a Venture, with the calendar dates already formatted. */
export function selectWorkJourneyStages(dbId, ventureCode) {
  return db.execute({
    sql: `SELECT id::text AS id, name, stage_order, status,
                 to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(target_date, 'YYYY-MM-DD') AS target_date
          FROM venture_journey_stages
          WHERE venture_id::text IN (?, ?)
            AND COALESCE(is_archived, FALSE) = FALSE
          ORDER BY COALESCE(stage_order, 0), created_at`,
    args: [String(dbId), String(ventureCode)],
  });
}

/** Milestones of a Venture (archived ones excluded). */
export function selectWorkMilestones(dbId, ventureCode) {
  return db.execute({
    sql: `SELECT id::text AS id, title, description, objective, status, priority,
                 owner_cid, owner_name, support_name,
                 journey_stage_id::text AS journey_stage_id,
                 to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(COALESCE(target_date, due_date), 'YYYY-MM-DD') AS finish_date
          FROM venture_milestones
          WHERE venture_id::text IN (?, ?)
            AND COALESCE(is_archived, FALSE) = FALSE
          ORDER BY COALESCE(display_order, 0), created_at`,
    args: [String(dbId), String(ventureCode)],
  });
}

/** The Activities (tasks) of a Venture (archived ones excluded). */
export function selectWorkTasks(dbId, ventureCode) {
  return db.execute({
    sql: `SELECT id, milestone_id::text AS milestone_id, title, description,
                 status, priority, assigned_cid, assigned_name, support_name,
                 definition_of_done, source_ref,
                 to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(due_date, 'YYYY-MM-DD') AS finish_date
          FROM venture_tasks
          WHERE venture_id::text IN (?, ?)
            AND COALESCE(is_archived, FALSE) = FALSE
          ORDER BY COALESCE(display_order, 0), id`,
    args: [String(dbId), String(ventureCode)],
  });
}

/** The Deliverables of a Venture, with the Activity that produces them. */
export function selectWorkDeliverables(dbId, ventureCode) {
  return db.execute({
    sql: `SELECT id, milestone_id::text AS milestone_id, task_id, title, description,
                 status, approval_status, assigned_cid, assigned_name,
                 rejection_reason, reviewer_name,
                 to_char(due_date, 'YYYY-MM-DD') AS finish_date
          FROM venture_deliverables
          WHERE venture_id::text IN (?, ?)
          ORDER BY created_at, id`,
    args: [String(dbId), String(ventureCode)],
  });
}

/** Dependency edges between this Venture's work items. */
export function selectWorkDependencyEdges(dbId, ventureCode) {
  return db.execute({
    sql: `SELECT source_type, source_id::text AS source_id,
                 target_type, target_id::text AS target_id
          FROM venture_dependencies
          WHERE venture_id::text IN (?, ?)`,
    args: [String(dbId), String(ventureCode)],
  });
}
