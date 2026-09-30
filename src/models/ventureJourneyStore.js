/**
 * Venture Journey stage / archive / template — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/journey`: the journey STAGE
 * table's schema guard and CRUD, the stage archive/restore/delete engine, and
 * the Journey template library (save + apply). The decisions — the first-stage
 * status, the filed-work guard, the ordered swap, the template naming and the
 * counters — live in the service.
 *
 * Distinct from `./ventureJourney.js`, which serves the OTHER journey-surface
 * endpoints (kpis, lifecycle, lead, validations, …); this store exists only for
 * `services/ventures/journey.js`.
 *
 * The statements that run INSIDE a transaction take the transaction's `query`
 * runner as their first argument, so the service owns the transaction boundary
 * (`runInTransaction`) while every statement stays here.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventureJourneys.js`,
 * `src/lib/ventureJourneyArchive.js` and `src/lib/ventureJourneyTemplates.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { milestoneHasFiledWork as milestoneHasFiledWorkProbe } from "@/lib/ventureArchive";

// ── Transaction control ──────────────────────────────────────────────────────

/** Run the ordered swap / cascade delete / template copy inside one transaction. */
export function runInTransaction(fn) {
  return db.transaction(fn);
}

// ── The stage table (schema guard) ───────────────────────────────────────────

/** Create the journey stage table when missing and add the configurable columns. */
export async function ensureJourneyTableSchema() {
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS venture_journey_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      objective TEXT,
      target_date DATE,
      stage_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      completed_at TIMESTAMPTZ,
      approved_by TEXT REFERENCES contacts(cid),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(venture_id, stage_order)
    )`,
  });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS objective TEXT" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS target_date DATE" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS start_date DATE" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ALTER COLUMN status SET DEFAULT 'upcoming'" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS archived_by TEXT" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_type TEXT" });
  await db.execute({ sql: "ALTER TABLE venture_journey_stages ADD COLUMN IF NOT EXISTS source_template_id TEXT" });
}

// ── Venture id resolution ────────────────────────────────────────────────────

/** Venture internal id (UUID) from a UUID-form id. */
export function selectVentureIdByUuid(ventureId) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE id::text = ?", args: [ventureId] });
}

/** Venture internal id (UUID) from the public VNT code. */
export function selectVentureIdByCode(ventureId) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
}

// ── Stage reads ──────────────────────────────────────────────────────────────

const STAGE_CORE_COLS = `id, name, description, objective, start_date, target_date, stage_order,
                 status, completed_at, created_at`;
const STAGE_TEMPLATE_COLS = ", source_template_type, source_template_id";
const STAGE_ARCHIVE_COLS = ", is_archived, archived_at";

/** Ordered stages, with the archive columns (falls back when not migrated). */
export function selectJourneyStagesWithArchive(dbId, { includeArchived = false } = {}) {
  const hideArchived = !includeArchived;
  return db.execute({
    sql: `SELECT ${STAGE_CORE_COLS}${STAGE_TEMPLATE_COLS}${STAGE_ARCHIVE_COLS}
            FROM venture_journey_stages WHERE venture_id = ?${hideArchived ? " AND (is_archived = FALSE OR is_archived IS NULL)" : ""}
            ORDER BY stage_order ASC`,
    args: [dbId],
  });
}

/** Ordered stages with template provenance but no archive columns. */
export function selectJourneyStagesWithTemplate(dbId) {
  return db.execute({
    sql: `SELECT ${STAGE_CORE_COLS}${STAGE_TEMPLATE_COLS}
            FROM venture_journey_stages WHERE venture_id = ?
            ORDER BY stage_order ASC`,
    args: [dbId],
  });
}

/** Ordered stages, core columns only (pre-template databases). */
export function selectJourneyStagesCore(dbId) {
  return db.execute({
    sql: `SELECT ${STAGE_CORE_COLS}
            FROM venture_journey_stages WHERE venture_id = ?
            ORDER BY stage_order ASC`,
    args: [dbId],
  });
}

/** One stage row, scoped to its Venture. */
export function selectJourneyStageRow(dbId, stageId) {
  return db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
}

/** The next free stage_order for a Venture. */
export function selectNextJourneyStageOrder(dbId) {
  return db.execute({
    sql: "SELECT COALESCE(MAX(stage_order), 0) + 1 AS next_order FROM venture_journey_stages WHERE venture_id = ?",
    args: [dbId],
  });
}

// ── Stage write statements (transaction: query runner first) ─────────────────

/** The ordered stage ids/orders of a Venture (swap input). */
export function selectJourneyStageOrders(query, dbId) {
  return query("SELECT id, stage_order FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC", [dbId]);
}

/** Park a stage at a negative sentinel order (swap step 1). */
export function parkJourneyStageOrder(query, stageId) {
  return query("UPDATE venture_journey_stages SET stage_order = -1 WHERE id = ?", [stageId]);
}

/** Write one stage's order (swap step 2/3, and the delete renumber). */
export function setJourneyStageOrder(query, stageOrder, stageId) {
  return query("UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?", [stageOrder, stageId]);
}

/** Write one stage's order outside a transaction (the archive renumber). */
export function updateJourneyStageOrder(stageOrder, stageId) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?",
    args: [stageOrder, stageId],
  });
}

/** Delete one stage, scoped to its Venture (cursor form). */
export function deleteJourneyStageRow(query, stageId, dbId) {
  return query("DELETE FROM venture_journey_stages WHERE id = ? AND venture_id = ?", [stageId, dbId]);
}

/** The remaining stage ids in order (renumber input). */
export function selectJourneyStageIdsInOrder(query, dbId) {
  return query("SELECT id FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC", [dbId]);
}

// ── Archive / restore / delete statements ────────────────────────────────────

/** A stage row (id + name) as the archive/delete guard reads it. */
export function selectJourneyStageForArchive(dbId, stageId) {
  return db.execute({
    sql: "SELECT id, name FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [stageId, dbId],
  });
}

/** Soft-delete one stage. */
export function archiveJourneyStageRow(actorCid, stageId, dbId) {
  return db.execute({
    sql: `UPDATE venture_journey_stages
              SET is_archived = TRUE, archived_at = COALESCE(archived_at, NOW()), archived_by = COALESCE(archived_by, ?)
              WHERE id = ? AND venture_id = ?`,
    args: [actorCid, stageId, dbId],
  });
}

/** Restore one soft-deleted stage. */
export function restoreJourneyStageRow(stageId, dbId) {
  return db.execute({
    sql: `UPDATE venture_journey_stages
              SET is_archived = FALSE, archived_at = NULL, archived_by = NULL
              WHERE id = ? AND venture_id = ?`,
    args: [stageId, dbId],
  });
}

/** Milestone ids bound to one stage. */
export function selectStageMilestoneIds(dbId, stageId) {
  return db.execute({
    sql: "SELECT id FROM venture_milestones WHERE venture_id = ? AND journey_stage_id = ?",
    args: [dbId, String(stageId)],
  });
}

/** Every remaining stage id in order (renumber input, cursor form). */
export function selectJourneyStageIdsOrdered(dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
    args: [dbId],
  });
}

/** Task ids of a milestone (child-cleanup input). */
export function selectMilestoneTaskIds(milestoneId) {
  return db.execute({
    sql: "SELECT id FROM venture_tasks WHERE milestone_id = ?",
    args: [String(milestoneId)],
  });
}

/** Remove a task's staff reviews (best-effort cleanup). */
export function deleteTaskReviewsForTask(taskId) {
  return db.execute({ sql: "DELETE FROM venture_task_reviews WHERE task_id = ?", args: [taskId] });
}

/** Remove a task's comments (best-effort cleanup). */
export function deleteTaskCommentsForTask(taskId) {
  return db.execute({ sql: "DELETE FROM venture_task_comments WHERE task_id = ?", args: [taskId] });
}

/** Remove a task's attachments (best-effort cleanup). */
export function deleteTaskAttachmentsForTask(taskId) {
  return db.execute({ sql: "DELETE FROM venture_task_attachments WHERE task_id = ?", args: [taskId] });
}

/** Remove the notes filed against one stage. */
export function deleteJourneyStageNotes(stageId) {
  return db.execute({
    sql: "DELETE FROM venture_notes WHERE scope_ref_type = 'journey_stage' AND scope_ref_id = ?",
    args: [stageId],
  });
}

/** Delete a milestone's deliverables (cascade, cursor form). */
export function deleteDeliverablesForMilestone(query, milestoneId) {
  return query("DELETE FROM venture_deliverables WHERE milestone_id = ?", [String(milestoneId)]);
}

/** Delete a milestone's tasks (cascade, cursor form). */
export function deleteTasksForMilestone(query, milestoneId) {
  return query("DELETE FROM venture_tasks WHERE milestone_id = ?", [String(milestoneId)]);
}

/** Delete one milestone, scoped to its Venture (cursor form). */
export function deleteMilestoneRow(query, milestoneId, dbId) {
  return query("DELETE FROM venture_milestones WHERE id = ? AND venture_id = ?", [String(milestoneId), dbId]);
}

/**
 * Filed-work probe for one milestone. The milestone archive engine
 * (`@/lib/ventureArchive`) owns the three statements and is not migrated yet, so
 * the store borrows its db — the probe is a repository concern either way.
 */
export function milestoneHasFiledWork(milestoneId) {
  return milestoneHasFiledWorkProbe(db, milestoneId);
}

// ── Template library ─────────────────────────────────────────────────────────

/** The template library with structural counts (newest first). */
export function selectJourneyTemplatesWithCounts() {
  return db.execute({
    sql: `SELECT t.id, t.name, t.description, t.created_by, t.created_at,
             (SELECT COUNT(*) FROM venture_journey_template_stages s WHERE s.template_id = t.id) AS stage_count,
             (SELECT COUNT(*) FROM venture_journey_template_milestones m
                JOIN venture_journey_template_stages s ON s.id = m.stage_id
                WHERE s.template_id = t.id) AS milestone_count,
             (SELECT COUNT(*) FROM venture_journey_template_tasks k
                JOIN venture_journey_template_milestones m ON m.id = k.milestone_id
                JOIN venture_journey_template_stages s ON s.id = m.stage_id
                WHERE s.template_id = t.id) AS task_count
          FROM venture_journey_templates t
          ORDER BY t.created_at DESC`,
    args: [],
  });
}

/** A Venture's stages to capture into a template. */
export function selectJourneyStagesForTemplate(dbId) {
  return db.execute({
    sql: `SELECT * FROM venture_journey_stages WHERE venture_id = ?
          ORDER BY stage_order ASC`,
    args: [dbId],
  });
}

/** Insert the template header (cursor form). */
export function insertJourneyTemplateRow(query, { id, name, description, createdBy }) {
  return query(
    `INSERT INTO venture_journey_templates (id, name, description, created_by)
       VALUES (?, ?, ?, ?)`,
    [id, name, description, createdBy],
  );
}

/** Insert one template stage (cursor form). */
export function insertJourneyTemplateStageRow(query, { id, templateId, name, description, objective, stageOrder }) {
  return query(
    `INSERT INTO venture_journey_template_stages
           (id, template_id, name, description, objective, stage_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [id, templateId, name, description, objective, stageOrder],
  );
}

/** Milestones bound to a stage (capture input, cursor form). */
export function selectMilestonesForJourneyStage(query, stageId) {
  return query(
    `SELECT * FROM venture_milestones WHERE journey_stage_id = ?
         ORDER BY COALESCE(display_order, 0), created_at ASC`,
    [stageId],
  );
}

/** Insert one template milestone (cursor form). */
export function insertJourneyTemplateMilestoneRow(query, { id, stageId, title, description, objective, priority, displayOrder }) {
  return query(
    `INSERT INTO venture_journey_template_milestones
             (id, stage_id, title, description, objective, priority, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, stageId, title, description, objective, priority, displayOrder],
  );
}

/** Top-level tasks of a milestone (capture input, cursor form). */
export function selectTopLevelTasksForMilestone(query, milestoneId) {
  return query(
    `SELECT * FROM venture_tasks
           WHERE milestone_id = ? AND parent_task_id IS NULL
           ORDER BY COALESCE(display_order, 0), created_at ASC`,
    [milestoneId],
  );
}

/** Insert one template task (cursor form). */
export function insertJourneyTemplateTaskRow(query, { id, milestoneId, title, description, priority, labelsJson, checklistJson, reviewRequired, requiredDeliverableType, displayOrder }) {
  return query(
    `INSERT INTO venture_journey_template_tasks
               (id, milestone_id, title, description, priority, labels, checklist,
                review_required, required_deliverable_type, display_order)
             VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)`,
    [id, milestoneId, title, description, priority, labelsJson, checklistJson, reviewRequired, requiredDeliverableType, displayOrder],
  );
}

// ── Template apply ───────────────────────────────────────────────────────────

/** Highest stage_order on a Venture (apply CONTINUES the numbering). */
export function selectMaxJourneyStageOrder(dbId) {
  return db.execute({
    sql: "SELECT COALESCE(MAX(stage_order), 0) AS max_order FROM venture_journey_stages WHERE venture_id = ?",
    args: [dbId],
  });
}

/** A template header (id + name) by id. */
export function selectJourneyTemplateById(templateId) {
  return db.execute({
    sql: "SELECT id, name FROM venture_journey_templates WHERE id = ?",
    args: [templateId],
  });
}

/** The template's stages in order (apply input, cursor form). */
export function selectTemplateStagesForApply(query, templateId) {
  return query(
    `SELECT * FROM venture_journey_template_stages WHERE template_id = ?
       ORDER BY stage_order ASC`,
    [templateId],
  );
}

/** Insert one fresh journey stage from a template (cursor form). */
export function insertJourneyStageFromTemplateRow(query, { dbId, name, description, objective, stageOrder, status, templateId }) {
  return query(
    `INSERT INTO venture_journey_stages
           (venture_id, name, description, objective, stage_order, status,
            source_template_type, source_template_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [dbId, name, description, objective, stageOrder, status, "journey", String(templateId)],
  );
}

/** The template's milestones for one stage (apply input, cursor form). */
export function selectTemplateMilestonesForStage(query, stageId) {
  return query(
    `SELECT * FROM venture_journey_template_milestones WHERE stage_id = ?
         ORDER BY COALESCE(display_order, 0), created_at ASC`,
    [stageId],
  );
}

/** Insert one fresh milestone from a template (cursor form). */
export function insertMilestoneFromTemplateRow(query, { id, dbId, title, description, objective, status, priority, displayOrder, stageId, createdBy }) {
  return query(
    `INSERT INTO venture_milestones
             (id, venture_id, title, description, objective, status, progress,
              priority, display_order, journey_stage_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    [id, dbId, title, description, objective, status, priority, displayOrder, stageId, createdBy],
  );
}

/** The template's tasks for one milestone (apply input, cursor form). */
export function selectTemplateTasksForMilestone(query, milestoneId) {
  return query(
    `SELECT * FROM venture_journey_template_tasks WHERE milestone_id = ?
           ORDER BY COALESCE(display_order, 0), created_at ASC`,
    [milestoneId],
  );
}

/** Insert one fresh task from a template (cursor form). */
export function insertTaskFromTemplateRow(query, { dbId, milestoneId, title, description, priority, labelsJson, checklistJson, displayOrder, reviewRequired, requiredDeliverableType }) {
  return query(
    `INSERT INTO venture_tasks
               (venture_id, milestone_id, title, description, status, priority,
                labels, checklist, display_order, review_required,
                required_deliverable_type)
             VALUES (?, ?, ?, ?, 'backlog', ?, ?::jsonb, ?::jsonb, ?, ?, ?)`,
    [dbId, milestoneId, title, description, priority, labelsJson, checklistJson, displayOrder, reviewRequired, requiredDeliverableType],
  );
}
