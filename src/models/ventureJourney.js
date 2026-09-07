import db from "@/lib/db";

/**
 * Venture Journey model — data access for the venture journey/growth
 * controllers (`src/app/api/ventures/[id]/journey`, `/kpis`, `/lifecycle`,
 * `/lead`, `/validations`, `/investment-readiness`, `/business-model`,
 * `/playbook`, `/pmf`, `/interviews`, `/history`, `/approve`, and
 * `src/app/api/ventures/promote`).
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

// ── GET/PATCH /api/ventures/[id]/journey ─────────────────────────────────────

/** Venture internal id (UUID) resolved from the public VNT code. */
export async function getJourneyVentureId(ventureId) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Ensure the venture_journey_stages table exists. */
export async function ensureJourneyStagesTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS venture_journey_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      stage_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      completed_at TIMESTAMPTZ,
      approved_by TEXT REFERENCES contacts(cid),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(venture_id, stage_order)
    )`,
  });
}

/** Existing journey stage count for a venture (seed check). */
export async function countJourneyStages(ventureId) {
  return db.execute({
    sql: "SELECT COUNT(*) as c FROM venture_journey_stages WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Seed one standard journey stage (first stage is 'active'). */
export async function insertJourneyStage(ventureId, name, description, stageOrder, status) {
  return db.execute({
    sql: "INSERT INTO venture_journey_stages (venture_id, name, description, stage_order, status) VALUES (?, ?, ?, ?, ?)",
    args: [ventureId, name, description, stageOrder, status],
  });
}

/** Highest stage_order currently seeded for a venture. */
export async function getJourneyMaxStageOrder(ventureId) {
  return db.execute({
    sql: "SELECT MAX(stage_order) as max_order FROM venture_journey_stages WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Add a growth stage missing from an existing venture (conflict-safe). */
export async function insertMissingJourneyStage(ventureId, name, description, stageOrder) {
  return db.execute({
    sql: "INSERT INTO venture_journey_stages (venture_id, name, description, stage_order, status) VALUES (?, ?, ?, ?, 'locked') ON CONFLICT (venture_id, stage_order) DO NOTHING",
    args: [ventureId, name, description, stageOrder],
  });
}

/** All journey stages for a venture, ordered by stage_order. */
export async function getJourneyStages(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
    args: [ventureId],
  });
}

/** A single journey stage scoped to a venture. */
export async function getJourneyStageById(stageId, ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
    args: [stageId, ventureId],
  });
}

/** Mark a journey stage completed, recording the approver. */
export async function completeJourneyStage(approvedBy, stageId) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'completed', completed_at = NOW(), approved_by = ? WHERE id = ?",
    args: [approvedBy, stageId],
  });
}

/** Unlock the next locked journey stage (stage_order + 1). */
export async function unlockJourneyStage(ventureId, stageOrder) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'active' WHERE venture_id = ? AND stage_order = ? AND status = 'locked'",
    args: [ventureId, stageOrder],
  });
}

/** Lock this stage and every later stage (reset action). */
export async function lockJourneyStagesFrom(ventureId, stageOrder) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'locked', completed_at = NULL, approved_by = NULL WHERE venture_id = ? AND stage_order >= ?",
    args: [ventureId, stageOrder],
  });
}

/** Re-activate a reset journey stage. */
export async function activateJourneyStage(ventureId, stageOrder) {
  return db.execute({
    sql: "UPDATE venture_journey_stages SET status = 'active' WHERE venture_id = ? AND stage_order = ?",
    args: [ventureId, stageOrder],
  });
}

/** All journey stages after a stage action (PATCH re-read). Same SQL as getJourneyStages — kept 1:1. */
export async function getJourneyStagesAfterUpdate(ventureId) {
  return db.execute({
    sql: "SELECT * FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
    args: [ventureId],
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

/** Active venture_members row for a contact (participant visibility check). */
export async function isVentureMemberContact(ventureId, contactId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL`,
    args: [ventureId, contactId],
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

// ── POST /api/ventures/[id]/approve ──────────────────────────────────────────

/** Venture record (by VNT code) for the approval flow. */
export async function getVentureForApproval(ventureId) {
  return db.execute({
    sql: "SELECT * FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Activate an approved venture. */
export async function activateVenture(ventureId) {
  return db.execute({
    sql: "UPDATE ventures SET status = 'active', updated_at = NOW() WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Founder emails/names to notify on approval (three-source UNION by VNT code). */
export async function getFoundersForVentureApproval(ventureId) {
  return db.execute({
    sql: `SELECT f.email, f.name
              FROM venture_founders f
              WHERE f.venture_id = ? AND f.email IS NOT NULL
              UNION
              SELECT c.email, c.name
              FROM venture_members vm
              JOIN contacts c ON vm.contact_id = c.cid
              WHERE vm.venture_id = ? AND vm.member_type = 'founder' AND vm.removed_at IS NULL
              UNION
              SELECT c.email, c.name
              FROM ventures v
              JOIN contacts c ON v.created_by = c.cid
              WHERE v.venture_id = ?`,
    args: [ventureId, ventureId, ventureId],
  });
}

/** Contact cid resolved from an email (case-insensitive, non-deleted). */
export async function getContactCidByLowerEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0",
    args: [email],
  });
}

/** Create a password-setup token for an approved venture founder. */
export async function createApprovalPasswordSetupToken(token, tokenHash, contactCid, userEmail) {
  return db.execute({
    sql: `INSERT INTO password_setup_tokens (token, token_hash, contact_cid, user_email, role, token_type, expires_at)
                      VALUES (?, ?, ?, ?, 'founder', 'venture_approval', NOW() + INTERVAL '48 hours')`,
    args: [token, tokenHash, contactCid, userEmail],
  });
}

// ── POST /api/ventures/promote ───────────────────────────────────────────────

/** Team row resolved from a UUID-form team id. */
export async function getTeamByTextId(teamId) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE id::text = ?",
    args: [teamId],
  });
}

/** First venture-ready team in a program (promotion candidate). */
export async function getVentureReadyTeamByProgram(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE program_id::text = ? AND is_venture_ready = 1 LIMIT 1",
    args: [programId],
  });
}

/** Fallback: any team in a program. */
export async function getFirstTeamByProgram(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE program_id::text = ? LIMIT 1",
    args: [programId],
  });
}

/** Program row resolved from a UUID-form program id. */
export async function getProgramByTextId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Team lead contact row (cid/name/email). */
export async function getLeadContactById(contactCid) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
    args: [contactCid],
  });
}

/** Venture VNT code matching a company name (case-insensitive dup check). */
export async function findVentureByCompanyName(companyName) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
    args: [companyName],
  });
}

/** Intake form fields (id + settings) for key-mapped prefill. */
export async function getFormFieldsByFormId(formId) {
  return db.execute({
    sql: "SELECT id, settings FROM platform_form_fields WHERE form_id = ?",
    args: [formId],
  });
}

/** Create the pre-filled intake submission (promotion pipeline). */
export async function createPromotionSubmission(runId, submitterId, submitterName, dataJson, invitationId) {
  return db.execute({
    sql: `INSERT INTO platform_form_submissions
              (run_id, submitter_id, submitter_name, status, data, invitation_id, submitted_at, updated_at)
            VALUES (?, ?, ?, 'submitted', ?::jsonb, ?, NOW(), NOW())
            RETURNING id`,
    args: [runId, submitterId, submitterName, dataJson, invitationId],
  });
}
