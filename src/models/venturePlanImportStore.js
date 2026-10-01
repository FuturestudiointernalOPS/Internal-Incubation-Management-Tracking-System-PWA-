/**
 * Venture plan import — statements (REPOSITORY layer).
 *
 * Every statement behind the plan import: the owner lookups, the existing
 * programme reads, the draft CRUD, and the structural writes an apply runs. The
 * decisions (what a proposal is, which sheet carries the work, the first-journey
 * rule, owner resolution, the change diff, which edges to add) live in
 * `@/services/ventures/planImport`.
 *
 * The statements that run INSIDE a transaction take the transaction's `query`
 * runner as their first argument, so the service owns the transaction boundary
 * (`runInTransaction`) while every statement stays here.
 *
 * SQL is byte-identical to what used to sit inline in
 * `models/venturePlanImport.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

const PLAN_IMPORT_COLUMNS =
  "id, venture_id, file_name, file_kind, sheets, proposal, stats, unmatched_owners, warnings, status, created_by, created_at, updated_at, applied_at, applied_by";

// ── Transaction control ──────────────────────────────────────────────────────

/** Run the structural writes of an apply inside one transaction. */
export function runInTransaction(fn) {
  return db.transaction(fn);
}

// ── Owner resolution ─────────────────────────────────────────────────────────

/** Contacts whose email matches (case-insensitive), capped at 2 to spot ambiguity. */
export function selectOwnerByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) AND COALESCE(deleted, 0) = 0 LIMIT 2",
    args: [email],
  });
}

/** Contacts whose name matches (case-insensitive), capped at 3 to spot ambiguity. */
export function selectOwnerByName(name) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(name) = LOWER(?) AND COALESCE(deleted, 0) = 0 LIMIT 3",
    args: [name],
  });
}

// ── What the Venture already has ─────────────────────────────────────────────

/** A Venture's live journey stages, in display order. */
export function selectExistingJourneyStages(dbId) {
  return db.execute({
    sql: `SELECT id, name, status FROM venture_journey_stages
           WHERE venture_id = ? AND COALESCE(is_archived, FALSE) = FALSE
           ORDER BY stage_order ASC`,
    args: [dbId],
  });
}

/** A Venture's live milestones with their task count, in display order. */
export function selectExistingMilestones(dbId) {
  return db.execute({
    sql: `SELECT m.journey_stage_id, m.title, m.status,
                 (SELECT COUNT(*) FROM venture_tasks t
                   WHERE t.milestone_id = m.id AND COALESCE(t.is_archived, FALSE) = FALSE) AS task_count
            FROM venture_milestones m
           WHERE m.venture_id = ? AND COALESCE(m.is_archived, FALSE) = FALSE
           ORDER BY COALESCE(m.display_order, 0), m.created_at ASC`,
    args: [dbId],
  });
}

// ── The draft ────────────────────────────────────────────────────────────────

/** The Venture's open draft (or none). */
export function selectOpenPlanImport(ventureId) {
  return db.execute({
    sql: `SELECT ${PLAN_IMPORT_COLUMNS} FROM venture_plan_imports
          WHERE venture_id = ? AND status = 'proposed'
          ORDER BY created_at DESC LIMIT 1`,
    args: [ventureId],
  });
}

/** One draft by id, scoped to its Venture. */
export function selectPlanImport(id, ventureId) {
  return db.execute({
    sql: `SELECT ${PLAN_IMPORT_COLUMNS} FROM venture_plan_imports WHERE id = ? AND venture_id = ? LIMIT 1`,
    args: [id, ventureId],
  });
}

/** Save the reviewer's corrections onto an open draft. */
export function updatePlanImportProposalRow({ id, ventureId, proposal, stats, unmatchedOwners }) {
  return db.execute({
    sql: `UPDATE venture_plan_imports
             SET proposal = ?::jsonb, stats = ?::jsonb, unmatched_owners = ?::jsonb, updated_at = now()
           WHERE id = ? AND venture_id = ? AND status = 'proposed'
           RETURNING ${PLAN_IMPORT_COLUMNS}`,
    args: [JSON.stringify(proposal), JSON.stringify(stats), JSON.stringify(unmatchedOwners), id, ventureId],
  });
}

/** Close an open draft without applying it. */
export function discardPlanImportRow({ id, ventureId }) {
  return db.execute({
    sql: `UPDATE venture_plan_imports SET status = 'discarded', updated_at = now()
          WHERE id = ? AND venture_id = ? AND status = 'proposed'
          RETURNING id`,
    args: [id, ventureId],
  });
}

/** Close the draft as applied (the guarded, last step of an apply). */
export function applyPlanImportDraft({ actorCid, counts, importId, dbId }) {
  return db.execute({
    sql: `UPDATE venture_plan_imports
             SET status = 'applied', applied_at = now(), applied_by = ?, stats = ?::jsonb, updated_at = now()
           WHERE id = ? AND venture_id = ? AND status = 'proposed'
           RETURNING id`,
    args: [actorCid, JSON.stringify(counts), importId, dbId],
  });
}

// ── The draft, inside the create transaction ─────────────────────────────────

/** The Venture's currently open draft ids (to supersede them). */
export function selectOpenPlanImportIds(query, ventureId) {
  return query(
    "SELECT id FROM venture_plan_imports WHERE venture_id = ? AND status = 'proposed'",
    [ventureId],
  );
}

/** Supersede every open draft of the Venture. */
export function discardOpenPlanImports(query, ventureId) {
  return query(
    "UPDATE venture_plan_imports SET status = 'discarded', updated_at = now() WHERE venture_id = ? AND status = 'proposed'",
    [ventureId],
  );
}

/** Insert a fresh draft, returning its id. */
export function insertPlanImportRow(
  query,
  { ventureId, fileName, fileKind, sheets, proposal, stats, unmatchedOwners, warnings, actorCid },
) {
  return query(
    `INSERT INTO venture_plan_imports
       (venture_id, file_name, file_kind, sheets, proposal, stats, unmatched_owners, warnings, created_by)
     VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?)
     RETURNING id`,
    [
      ventureId,
      fileName,
      fileKind,
      JSON.stringify(sheets),
      JSON.stringify(proposal),
      JSON.stringify(stats),
      JSON.stringify(unmatchedOwners),
      JSON.stringify(warnings),
      actorCid,
    ],
  );
}

// ── The structure, inside the apply transaction ──────────────────────────────

/** The highest stage order already used in the Venture (0 when none). */
export function selectMaxStageOrder(query, dbId) {
  return query(
    "SELECT COALESCE(MAX(stage_order), 0) AS max_order FROM venture_journey_stages WHERE venture_id = ?",
    [dbId],
  );
}

/** Insert one journey stage (source tagged 'plan_import'). */
export function insertJourneyStage(
  query,
  { id, ventureId, name, description, objective, targetDate, stageOrder, status, startDate, importId },
) {
  return query(
    `INSERT INTO venture_journey_stages
       (id, venture_id, name, description, objective, target_date, stage_order, status, start_date,
        source_template_type, source_template_id, is_archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'plan_import', ?, FALSE)`,
    [id, ventureId, name, description, objective, targetDate, stageOrder, status, startDate, importId],
  );
}

/** Insert one milestone under a stage. */
export function insertMilestone(
  query,
  { id, ventureId, title, description, objective, status, priority, displayOrder, journeyStageId, startDate, targetDate, createdBy },
) {
  return query(
    `INSERT INTO venture_milestones
       (id, venture_id, title, description, objective, status, progress, priority, display_order,
        journey_stage_id, start_date, target_date, created_by, is_archived)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, FALSE)`,
    [id, ventureId, title, description, objective, status, priority, displayOrder, journeyStageId, startDate, targetDate, createdBy],
  );
}

/** Insert one task, returning its id (the dependency edges need it). */
export function insertTask(
  query,
  { ventureId, milestoneId, title, description, priority, startDate, dueDate, assignedCid, assignedName, displayOrder, labels },
) {
  return query(
    `INSERT INTO venture_tasks
       (venture_id, milestone_id, title, description, status, priority, start_date, due_date,
        assigned_cid, assigned_name, display_order, labels, checklist, is_archived)
     VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?, ?, ?, ?, ?::jsonb, '[]'::jsonb, FALSE)
     RETURNING id`,
    [ventureId, milestoneId, title, description, priority, startDate, dueDate, assignedCid, assignedName, displayOrder, JSON.stringify(labels)],
  );
}

/** Insert one deliverable under a milestone. */
export function insertDeliverable(
  query,
  { milestoneId, ventureId, title, dueDate, assignedCid, assignedName, createdBy },
) {
  return query(
    `INSERT INTO venture_deliverables
       (milestone_id, venture_id, title, deliverable_type, due_date, assigned_cid, assigned_name, created_by)
     VALUES (?, ?, ?, 'document', ?, ?, ?, ?)`,
    [milestoneId, ventureId, title, dueDate, assignedCid, assignedName, createdBy],
  );
}
