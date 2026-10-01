import db from "@/lib/db";

/**
 * Venture Journey model — data access for the venture journey/growth
 * controllers (`src/app/api/ventures/[id]/journey`, `/kpis`, `/lifecycle`,
 * `/lead`, `/validations`, `/investment-readiness`, `/business-model`,
 * `/playbook`, `/pmf`, `/interviews`, `/history`).
 *
 * Each function wraps exactly one SQL statement extracted 1:1 from the
 * controller it came from (SQL byte-identical, args order/count identical),
 * so behavior is unchanged. Queries that look duplicated are still extracted
 * one function per occurrence, per the MVC refactor extraction rules.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET/POST/PATCH /api/ventures/[id]/journey ────────────────────────────────

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

// ── GET/POST/PATCH /api/ventures/[id]/kpis ───────────────────────────────────

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

// ── POST /api/ventures/[id]/lifecycle ────────────────────────────────────────

/** Venture row (id + VNT code) resolved from a UUID-form id. */
export async function getLifecycleVentureByUuid(id) {
  return db.execute({
    sql: "SELECT id, venture_id FROM ventures WHERE id::text = ?",
    args: [id],
  });
}

/** Venture internal id resolved from the public VNT code (existence check). */
export async function getLifecycleVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Apply a lifecycle transition (pause/resume/archive) to a venture. */
export async function updateVentureLifecycleStatus(status, isArchived, ventureId) {
  return db.execute({
    sql: `UPDATE ventures
            SET status = ?, is_archived = COALESCE(?, is_archived), updated_at = NOW()
            WHERE venture_id = ?`,
    args: [status, isArchived, ventureId],
  });
}

// ── POST /api/ventures/[id]/lead ─────────────────────────────────────────────

/** Venture VNT code resolved from a UUID-form id. */
export async function getLeadVentureCodeByUuid(id) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id::text = ?",
    args: [id],
  });
}

/** Lead-founder venture membership for a contact (lead-change guard). */
export async function findLeadFounderMembership(ventureId, contactCid) {
  return db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND lead_founder = TRUE AND removed_at IS NULL",
    args: [ventureId, contactCid, contactCid],
  });
}

/** Audit a lead change in venture_activity_log. */
export async function logVentureLeadChanged(ventureId, actorCid, actorName, detailsJson) {
  return db.execute({
    sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details, created_at)
              VALUES (?, 'LEAD_CHANGED', ?, ?, ?::jsonb, NOW())`,
    args: [ventureId, actorCid, actorName, detailsJson],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/validations ────────────────────────────

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getValidationsVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** All validations for a venture, newest first. */
export async function getVentureValidations(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_validations WHERE venture_id = ? ORDER BY created_at DESC`,
    args: [ventureId],
  });
}

/** Create a validation entry for a venture. */
export async function createVentureValidation(ventureId, validationType, status, notes, createdBy) {
  return db.execute({
    sql: `INSERT INTO venture_validations (venture_id, validation_type, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?)`,
    args: [ventureId, validationType, status, notes, createdBy],
  });
}

/** Dynamic field update — updates/args are built by the controller. */
export async function updateVentureValidationFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_validations SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

// ── GET /api/ventures/[id]/investment-readiness ──────────────────────────────

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getInvestmentReadinessVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Approved/shared venture documents for the investment-readiness checklist. */
export async function getVentureInvestmentDocuments(ventureId) {
  return db.execute({
    sql: "SELECT name, category, approval_status FROM venture_documents WHERE venture_id = ? AND is_deleted = false ORDER BY approval_status, name",
    args: [ventureId],
  });
}

// ── GET/PUT /api/ventures/[id]/business-model ────────────────────────────────

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getBusinessModelVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** The venture's business model row (single-row lookup). */
export async function getVentureBusinessModel(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_business_models WHERE venture_id = ?`,
    args: [ventureId],
  });
}

/** Existing business model row id for a venture (upsert lookup). */
export async function findVentureBusinessModel(ventureId) {
  return db.execute({
    sql: "SELECT id FROM venture_business_models WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Dynamic field update — setClauses/upArgs are built by the controller. */
export async function updateVentureBusinessModel(setClauses, upArgs) {
  return db.execute({
    sql: `UPDATE venture_business_models SET ${setClauses.join(", ")} WHERE venture_id = ?`,
    args: upArgs,
  });
}

/** Dynamic field insert — insertCols/insertVals/insertArgs are built by the controller. */
export async function createVentureBusinessModel(insertCols, insertVals, insertArgs) {
  return db.execute({
    sql: `INSERT INTO venture_business_models (${insertCols.join(", ")}) VALUES (${insertVals.join(", ")})`,
    args: insertArgs,
  });
}

// ── GET /api/ventures/[id]/playbook ──────────────────────────────────────────

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getPlaybookVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Ensure the venture_facilitator_playbook table exists. */
export async function ensurePlaybookTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS venture_facilitator_playbook (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
      stage_order INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      objective TEXT,
      expected_outcome TEXT,
      questions TEXT,
      evidence TEXT,
      documents TEXT,
      mistakes TEXT,
      approval_criteria TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(venture_id, stage_order)
    )`,
  });
}

/** Existing playbook entry count for a venture (seed check). */
export async function countPlaybookEntries(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as c FROM venture_facilitator_playbook WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Seed one facilitator playbook stage for a venture. */
export async function insertPlaybookStage(ventureId, stage) {
  return db.execute({
    sql: "INSERT INTO venture_facilitator_playbook (venture_id, stage_order, stage_name, objective, expected_outcome, questions, evidence, documents, mistakes, approval_criteria) VALUES (?,?,?,?,?,?,?,?,?,?)",
    args: [ventureId, stage.stage_order, stage.stage_name, stage.objective, stage.expected_outcome, stage.questions, stage.evidence, stage.documents, stage.mistakes, stage.approval_criteria],
  });
}

/** All facilitator playbook entries for a venture, ordered by stage_order. */
export async function getPlaybookEntries(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_facilitator_playbook WHERE venture_id = ? ORDER BY stage_order ASC",
    args: [ventureId],
  });
}

// ── GET/POST /api/ventures/[id]/pmf ──────────────────────────────────────────

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getPmfVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** All PMF assessments for a venture, newest first. */
export async function getPmfAssessments(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_pmf_assessments WHERE venture_id = ? ORDER BY created_at DESC`,
    args: [ventureId],
  });
}

/** Create a PMF assessment for a venture. */
export async function createPmfAssessment(ventureId, customerFeedback, improvements, pmfProgress, createdBy) {
  return db.execute({
    sql: `INSERT INTO venture_pmf_assessments (venture_id, customer_feedback, improvements, pmf_progress, created_by)
            VALUES (?, ?, ?, ?, ?)`,
    args: [ventureId, customerFeedback, improvements, pmfProgress, createdBy],
  });
}

// ── GET/POST /api/ventures/[id]/interviews ───────────────────────────────────

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getInterviewsVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** All customer interviews for a venture, newest first. */
export async function getCustomerInterviews(ventureId) {
  return db.execute({
    sql: `SELECT * FROM venture_customer_interviews WHERE venture_id = ? ORDER BY created_at DESC`,
    args: [ventureId],
  });
}

/** Create a customer interview for a venture. */
export async function createCustomerInterview(ventureId, customerSegment, intervieweeName, interviewDate, notes, insights, createdBy) {
  return db.execute({
    sql: `INSERT INTO venture_customer_interviews (venture_id, customer_segment, interviewee_name, interview_date, notes, insights, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [ventureId, customerSegment, intervieweeName, interviewDate, notes, insights, createdBy],
  });
}

// ── GET /api/ventures/[id]/history ───────────────────────────────────────────

/** Venture record (by VNT code) for the history endpoint. */
export async function getVentureForHistory(ventureId) {
  return db.execute({
    sql: `SELECT * FROM ventures WHERE venture_id = ?`,
    args: [ventureId],
  });
}

/** Program header row for a venture's previous-program block. */
export async function getProgramById(programId) {
  return db.execute({
    sql: `SELECT id, name, start_date, end_date, deliverables FROM v2_programs WHERE id = ?`,
    args: [programId],
  });
}

/** All founders (incl. removed) of a venture, most recently joined first. */
export async function getVentureFounderHistory(ventureId) {
  return db.execute({
    sql: `
        SELECT vm.contact_id, vm.role, vm.joined_at, vm.removed_at, c.name as contact_name
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.member_type = 'founder'
        ORDER BY vm.joined_at DESC
      `,
    args: [ventureId],
  });
}

/** A founder's prior program enrollments, excluding the given program. */
export async function getFounderProgramHistory(participantId, programId) {
  return db.execute({
    sql: `
              SELECT pp.*, vp.name as program_name
              FROM participant_programs pp
              LEFT JOIN v2_programs vp ON CAST(pp.program_id AS TEXT) = CAST(vp.id AS TEXT)
              WHERE pp.participant_id = ? AND CAST(pp.program_id AS TEXT) != CAST(? AS TEXT)
              ORDER BY pp.enrolled_at DESC
            `,
    args: [participantId, programId],
  });
}
