import db from "@/lib/db";

// ── GET/POST/PUT /api/ventures ───────────────────────────────────────────────

/** Ventures list with founder/member counts and optional directory filters. */
export async function listVenturesWithCounts({ effectiveContactId, assignedStaffId, status, search }) {
  let sql = `
      SELECT v.*,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.venture_id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.venture_id AND vm.member_type != 'founder' AND vm.removed_at IS NULL) as member_count
      FROM ventures v WHERE 1=1
    `;
  const args = [];

  if (effectiveContactId) {
    sql += " AND v.venture_id IN (SELECT vm.venture_id FROM venture_members vm WHERE vm.user_cid = ? OR vm.contact_id = ?)";
    args.push(effectiveContactId, effectiveContactId);
  }

  // Delegated staff/program_manager: assigned Ventures OR Ventures they are a
  // member of — never the whole directory.
  if (assignedStaffId) {
    sql += " AND (v.venture_id IN (SELECT venture_id FROM venture_staff_assignments WHERE staff_contact_id = ? AND status = 'active') OR v.venture_id IN (SELECT vm.venture_id FROM venture_members vm WHERE vm.user_cid = ? OR vm.contact_id = ?))";
    args.push(assignedStaffId, assignedStaffId, assignedStaffId);
  }

  if (status) {
    sql += " AND v.status = ?";
    args.push(status);
  }

  if (search) {
    sql += " AND (LOWER(v.name) LIKE ? OR LOWER(v.venture_id) LIKE ? OR LOWER(v.industry) LIKE ?)";
    const searchPattern = `%${search.toLowerCase()}%`;
    args.push(searchPattern, searchPattern, searchPattern);
  }

  sql += " ORDER BY v.created_at DESC";

  return db.execute({ sql, args });
}

/** contact_timeline 'venture_updated' event after a PUT update. */
export async function recordVentureUpdatedTimeline({ contact_cid, venture_id, updated_fields }) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                  VALUES (?, 'venture_updated', ?, 'ventures', ?, ?, ?::jsonb)`,
    args: [contact_cid, `Updated venture ${venture_id}`, venture_id, contact_cid, JSON.stringify({ updated_fields })],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/members ────────────────────────────────

// ── GET /api/ventures/[id]/dashboard ─────────────────────────────────────────

// ── GET /api/ventures/[id]/progress ──────────────────────────────────────────

/** Internal ventures.id by VNT code — progress resolveVentureDbId helper. */
export async function getVentureDbIdForProgress(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Average milestone progress for a venture. */
export async function getAverageVentureMilestoneProgress(dbId) {
  return db.execute({
    sql: "SELECT AVG(progress) as avg_progress FROM venture_milestones WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Standup count for a venture (progress widget). */
export async function countVentureStandupsByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_standups WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Retro count for a venture (progress widget). */
export async function countVentureRetrosByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_retros WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Profile-score fields of a venture by internal id. */
export async function getVentureProfileFields(dbId) {
  return db.execute({
    sql: "SELECT name, description, mission, vision, industry, sector, business_stage, website FROM ventures WHERE id = ?",
    args: [dbId],
  });
}

/** Active founder count by VNT code (progress founders %, arg is the VNT code). */
export async function countVentureFoundersByCode(venture_id) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL",
    args: [venture_id],
  });
}

/** Non-deleted document count for a venture (progress widget). */
export async function countVentureDocumentsByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_documents WHERE venture_id = ? AND is_deleted = false",
    args: [dbId],
  });
}

/** Business-model existence row for a venture (progress widget). */
export async function getFirstVentureBusinessModelId(dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_business_models WHERE venture_id = ? LIMIT 1",
    args: [dbId],
  });
}

/** Customer interview count for a venture (progress widget). */
export async function countVentureCustomerInterviews(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_customer_interviews WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Validation count for a venture (progress widget). */
export async function countVentureValidations(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_validations WHERE venture_id = ?",
    args: [dbId],
  });
}

/** PMF assessment count for a venture (progress widget). */
export async function countVenturePmfAssessments(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_pmf_assessments WHERE venture_id = ?",
    args: [dbId],
  });
}

// ── GET/POST/PATCH/DELETE /api/ventures/[id]/tasks ───────────────────────────

/** Internal ventures.id by VNT code — tasks resolveVentureDbId helper. */
/** Milestone row (id + stage) verified to belong to one Venture. */
export async function getVentureMilestoneForDeliverables(dbId, milestoneId) {
  return db.execute({
    sql: "SELECT id, journey_stage_id FROM venture_milestones WHERE id::text = ? AND venture_id = ?",
    args: [String(milestoneId), dbId],
  });
}

export async function getVentureDbIdForTasks(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Insert a venture task review (staff accept/reject/revision). */
export async function insertVentureTaskReview({ task_id, reviewer_cid, reviewer_name, decision, comments }) {
  return db.execute({
    sql: `INSERT INTO venture_task_reviews (task_id, reviewer_cid, reviewer_name, decision, comments, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())`,
    args: [parseInt(task_id), reviewer_cid || null, reviewer_name || null, decision, comments || null],
  });
}

/** Whether a task has an approved submission (review-gated completion). */
export async function hasApprovedTaskSubmission(taskId) {
  return db.execute({
    sql: "SELECT 1 FROM venture_task_submissions WHERE task_id = ? AND review_decision = 'approved' ORDER BY version DESC LIMIT 1",
    args: [taskId],
  });
}

/** Tasks of a Venture (by code-or-uuid) among the given ids, for bulk archive. */
export async function listTasksForArchive(id, ids) {
  return db.execute({
    sql: `SELECT t.id, t.title FROM venture_tasks t
          JOIN ventures v ON (t.venture_id::text = v.id::text OR t.venture_id::text = v.venture_id)
          WHERE (v.venture_id = ? OR v.id::text = ?)
            AND t.id::text = ANY(?)`,
    args: [id, id, ids],
  });
}

// ── GET/POST /api/ventures/[id]/tasks/[taskId]/submissions ───────────────────

/** One venture task by id. */
export async function getVentureTaskById(taskId) {
  return db.execute({ sql: "SELECT * FROM venture_tasks WHERE id = ?", args: [taskId] });
}

/** A task's submission history, oldest first. */
export async function listVentureTaskSubmissions(taskId) {
  return db.execute({
    sql: `SELECT id, task_id, version, status, file_url, file_name, file_type, file_size,
                 notes, submitted_by, submitted_by_name, reviewed_by, review_decision,
                 review_comment, reviewed_at, created_at
          FROM venture_task_submissions WHERE task_id = ?
          ORDER BY version ASC`,
    args: [taskId],
  });
}

/** The next submission version number for a task. */
export async function getNextTaskSubmissionVersion(taskId) {
  return db.execute({
    sql: "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM venture_task_submissions WHERE task_id = ?",
    args: [taskId],
  });
}

/** Append a task submission version, returning the new id. */
export async function insertTaskSubmission({
  taskId,
  version,
  fileUrl,
  fileName,
  fileType,
  fileSize,
  notes,
  submittedBy,
  submittedByName,
}) {
  return db.execute({
    sql: `INSERT INTO venture_task_submissions
          (task_id, version, status, file_url, file_name, file_type, file_size, notes, submitted_by, submitted_by_name)
          VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`,
    args: [taskId, version, "submitted", fileUrl, fileName, fileType, fileSize, notes, submittedBy, submittedByName],
  });
}

/** Move a task into in_progress (a submission means work is happening). */
export async function setVentureTaskInProgress(taskId) {
  return db.execute({ sql: "UPDATE venture_tasks SET status = 'in_progress' WHERE id = ?", args: [taskId] });
}

/** One submission of a task, by id. */
export async function getTaskSubmission(submissionId, taskId) {
  return db.execute({
    sql: "SELECT * FROM venture_task_submissions WHERE id = ? AND task_id = ?",
    args: [submissionId, taskId],
  });
}

/** Record a review outcome on a submission. */
export async function reviewTaskSubmission({ submissionId, decision, comment, reviewedBy }) {
  return db.execute({
    sql: `UPDATE venture_task_submissions
          SET review_decision = ?, review_comment = ?, reviewed_by = ?, reviewed_at = NOW()
          WHERE id = ?`,
    args: [decision, comment, reviewedBy, submissionId],
  });
}

/** Set a task's status. */
export async function setVentureTaskStatus(taskId, status) {
  return db.execute({ sql: "UPDATE venture_tasks SET status = ? WHERE id = ?", args: [status, taskId] });
}

/** A milestone's journey stage id (submission-review notification context). */
export async function getMilestoneJourneyStageId(milestoneId) {
  return db.execute({
    sql: "SELECT journey_stage_id FROM venture_milestones WHERE id = ? AND journey_stage_id IS NOT NULL",
    args: [milestoneId],
  });
}

// ── GET /api/ventures/[id]/submissions/review-queue ──────────────────────────

// Base queue query (no LIMIT). The full-access path appends LIMIT 20 so its
// behavior stays byte-identical to the pre-scoping route.
const VENTURE_REVIEW_QUEUE_SQL = `SELECT s.id AS submission_id, s.task_id, s.version, s.file_url, s.file_name, s.notes,
                 s.submitted_by_name, s.created_at,
                 t.title AS task_title,
                 t.milestone_id,
                 m.title AS milestone_title
          FROM venture_task_submissions s
          JOIN venture_tasks t ON t.id = s.task_id
          LEFT JOIN venture_milestones m ON m.id::text = t.milestone_id::text
          WHERE t.venture_id = ?
            AND s.review_decision IS NULL
            AND s.version = (SELECT MAX(s2.version) FROM venture_task_submissions s2 WHERE s2.task_id = s.task_id)
          ORDER BY s.created_at DESC`;
const VENTURE_REVIEW_QUEUE_SQL_FULL = `${VENTURE_REVIEW_QUEUE_SQL}
          LIMIT 20`;

/** The latest unreviewed submission per task; restricted omits the SQL LIMIT. */
export function selectVentureReviewQueue(dbId, restricted) {
  return db.execute({
    sql: restricted ? VENTURE_REVIEW_QUEUE_SQL : VENTURE_REVIEW_QUEUE_SQL_FULL,
    args: [dbId],
  });
}

// ── /api/ventures/[id]/notes ─────────────────────────────────────────────────

/** The canonical code behind a Venture db id (notes id resolver). */
export async function getVentureCodeByDbId(id) {
  return db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [id] });
}

/** Whether a responsibility may view the internal_notes area. */
export async function getInternalNotesViewPermission(responsibilityCode) {
  return db.execute({
    sql: "SELECT allowed FROM venture_permission_matrix WHERE responsibility_code = ? AND area = 'internal_notes' AND action = 'view'",
    args: [responsibilityCode],
  });
}

/** A contact's active assignment rows on a Venture, by id desc. */
export async function listActiveStaffAssignmentsByCode(ventureCode, cid) {
  return db.execute({
    sql: "SELECT id, scope_type, scope_ref_type, scope_ref_id, responsibility_code FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' ORDER BY id DESC",
    args: [ventureCode, cid],
  });
}

/** A Venture's live notes, optionally narrowed to a scope reference. */
export function listVentureNotes({ ventureCode, scopeType, scopeId }) {
  let sql = "SELECT * FROM venture_notes WHERE venture_id = ? AND is_archived = FALSE";
  const args = [ventureCode];
  if (scopeType) {
    sql += " AND scope_ref_type = ?";
    args.push(String(scopeType));
  }
  if (scopeId) {
    sql += " AND scope_ref_id = ?";
    args.push(String(scopeId));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Insert an internal note (with optional attachments), returning the new id. */
export function insertVentureNote({ ventureCode, authorCid, authorName, title, body, scopeRefType, scopeRefId, attachments }) {
  return db.execute({
    sql: `INSERT INTO venture_notes (venture_id, author_cid, author_name, title, body, scope_ref_type, scope_ref_id${attachments ? ", attachments" : ""})
            VALUES (?,?,?,?,?,?,?${attachments ? ", ?::jsonb" : ""}) RETURNING id`,
    args: attachments
      ? [ventureCode, authorCid, authorName, title, body, scopeRefType, scopeRefId, JSON.stringify(attachments)]
      : [ventureCode, authorCid, authorName, title, body, scopeRefType, scopeRefId],
  });
}

/** One note of a Venture, by id. */
export async function getVentureNote(noteId, ventureCode) {
  return db.execute({ sql: "SELECT * FROM venture_notes WHERE id = ? AND venture_id = ?", args: [noteId, ventureCode] });
}

/** Soft-archive one note. */
export async function archiveVentureNote(noteId) {
  return db.execute({ sql: "UPDATE venture_notes SET is_archived = TRUE, updated_at = NOW() WHERE id = ?", args: [noteId] });
}

// ── /api/ventures/[id]/operating-plans (+ [planId], [planId]/sections) ───────

/** A Venture's operating plans with their section counts. */
export async function listVentureOperatingPlans(ventureCode) {
  return db.execute({
    sql: `SELECT p.*,
        (SELECT COUNT(*) FROM venture_plan_sections s WHERE s.plan_id = p.id) AS section_count,
        (SELECT COUNT(*) FROM venture_plan_sections s WHERE s.plan_id = p.id AND s.status = 'completed') AS completed_sections
        FROM venture_operating_plans p WHERE p.venture_id = ? ORDER BY p.created_at DESC`,
    args: [ventureCode],
  });
}

/** Insert an operating plan, returning the new id. */
export async function insertVentureOperatingPlan({ ventureCode, name, objective, createdBy }) {
  return db.execute({
    sql: "INSERT INTO venture_operating_plans (venture_id, name, objective, created_by) VALUES (?,?,?,?) RETURNING id",
    args: [ventureCode, name, objective, createdBy],
  });
}

/** One operating plan of a Venture, by id (full row). */
export async function getVentureOperatingPlan(planId, ventureCode) {
  return db.execute({ sql: "SELECT * FROM venture_operating_plans WHERE id = ? AND venture_id = ?", args: [planId, ventureCode] });
}

/** A plan's sections, in display order. */
export async function listVenturePlanSections(planId) {
  return db.execute({ sql: "SELECT * FROM venture_plan_sections WHERE plan_id = ? ORDER BY sort_order, id", args: [planId] });
}

/** A plan's links (joined to its sections), in order. */
export async function listVenturePlanLinks(planId) {
  return db.execute({
    sql: `SELECT l.* FROM venture_plan_links l
          JOIN venture_plan_sections s ON s.id = l.section_id
          WHERE s.plan_id = ? ORDER BY l.id`,
    args: [planId],
  });
}

/** Update a plan's name/objective/status (COALESCE: absent = unchanged). */
export async function updateVentureOperatingPlan({ planId, ventureCode, name, objective, status }) {
  return db.execute({
    sql: "UPDATE venture_operating_plans SET name = COALESCE(?, name), objective = COALESCE(?, objective), status = COALESCE(?, status), updated_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [name, objective, status, planId, ventureCode],
  });
}

/** Existence check: an operating plan of a Venture, by id. */
export async function ventureOperatingPlanExists(planId, ventureCode) {
  return db.execute({ sql: "SELECT id FROM venture_operating_plans WHERE id = ? AND venture_id = ?", args: [planId, ventureCode] });
}

/** Archive an operating plan. */
export async function archiveVentureOperatingPlan(planId, ventureCode) {
  return db.execute({ sql: "UPDATE venture_operating_plans SET status = 'archived', updated_at = NOW() WHERE id = ? AND venture_id = ?", args: [planId, ventureCode] });
}

/** Existence check: a live (non-archived) plan of a Venture. */
export async function liveVenturePlanExists(planId, ventureCode) {
  return db.execute({ sql: "SELECT id FROM venture_operating_plans WHERE id = ? AND venture_id = ? AND status <> 'archived'", args: [planId, ventureCode] });
}

/** Existence check: a section of a plan. */
export async function venturePlanSectionExists(sectionId, planId) {
  return db.execute({ sql: "SELECT id FROM venture_plan_sections WHERE id = ? AND plan_id = ?", args: [sectionId, planId] });
}

/** Insert a plan link (idempotent). */
export async function insertVenturePlanLink({ sectionId, refType, refId, label, createdBy }) {
  return db.execute({
    sql: "INSERT INTO venture_plan_links (section_id, ref_type, ref_id, label, created_by) VALUES (?,?,?,?,?) ON CONFLICT (section_id, ref_type, ref_id) DO NOTHING",
    args: [sectionId, refType, refId, label, createdBy],
  });
}

/** Insert a plan section, returning the new id. */
export async function insertVenturePlanSection({ planId, title, objective, instructions, sortOrder }) {
  return db.execute({
    sql: "INSERT INTO venture_plan_sections (plan_id, title, objective, instructions, sort_order) VALUES (?,?,?,?,?) RETURNING id",
    args: [planId, title, objective, instructions, sortOrder],
  });
}

/** Update a section's fields (COALESCE: absent = unchanged). */
export async function updateVenturePlanSection({ sectionId, planId, title, objective, instructions, status, sortOrder }) {
  return db.execute({
    sql: `UPDATE venture_plan_sections SET
              title = COALESCE(?, title),
              objective = COALESCE(?, objective),
              instructions = COALESCE(?, instructions),
              status = COALESCE(?, status),
              sort_order = COALESCE(?, sort_order),
              updated_at = NOW()
            WHERE id = ? AND plan_id = ?`,
    args: [title, objective, instructions, status, sortOrder, sectionId, planId],
  });
}

/** A link of a plan, by id. */
export async function getVenturePlanLink(linkId, planId) {
  return db.execute({
    sql: "SELECT l.id FROM venture_plan_links l JOIN venture_plan_sections s ON s.id = l.section_id WHERE l.id = ? AND s.plan_id = ?",
    args: [linkId, planId],
  });
}

/** Delete a plan link. */
export async function deleteVenturePlanLink(linkId) {
  return db.execute({ sql: "DELETE FROM venture_plan_links WHERE id = ?", args: [linkId] });
}

/** Delete a plan section. */
export async function deleteVenturePlanSection(sectionId, planId) {
  return db.execute({ sql: "DELETE FROM venture_plan_sections WHERE id = ? AND plan_id = ?", args: [sectionId, planId] });
}

// ── POST /api/ventures/[id]/journey/apply-template ───────────────────────────

/** An active plan template, by id. */
export async function getActiveVenturePlanTemplate(templateId) {
  return db.execute({ sql: "SELECT id, name FROM venture_plan_templates WHERE id = ? AND is_active = TRUE", args: [templateId] });
}

/** A template's sections (title + objective), in order. */
export async function listVenturePlanTemplateSections(templateId) {
  return db.execute({ sql: "SELECT title, objective FROM venture_plan_template_sections WHERE template_id = ? ORDER BY sort_order, id", args: [templateId] });
}

/** How many journey stages a Venture db id already has. */
export async function countVentureJourneyStages(dbId) {
  return db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_journey_stages WHERE venture_id = ?", args: [dbId] });
}

/** Insert one journey stage generated from a template. */
export async function insertJourneyStageFromTemplate({ dbId, name, description, stageOrder, status, templateType, templateId }) {
  return db.execute({
    sql: `INSERT INTO venture_journey_stages (venture_id, name, description, stage_order, status, source_template_type, source_template_id)
          VALUES (?,?,?,?,?,?,?)`,
    args: [dbId, name, description, stageOrder, status, templateType, templateId],
  });
}

// ── /api/venture-permissions/responsibilities ────────────────────────────────

/** Insert a Venture responsibility definition. */
export async function insertVentureResponsibility({ code, name, description, createdBy }) {
  return db.execute({
    sql: "INSERT INTO venture_responsibilities (code, name, description, created_by) VALUES (?,?,?,?)",
    args: [code, name, description, createdBy],
  });
}

/** Update a Venture responsibility (COALESCE: absent = unchanged). */
export async function updateVentureResponsibility({ code, name, description, isActive }) {
  return db.execute({
    sql: "UPDATE venture_responsibilities SET name = COALESCE(?, name), description = COALESCE(?, description), is_active = COALESCE(?, is_active), updated_at = NOW() WHERE code = ?",
    args: [name, description, isActive, code],
  });
}

// ── /api/venture-plan-templates ──────────────────────────────────────────────

/** A plan's Venture id + name (template save guard). */
export async function getPlanVentureIdAndName(planId) {
  return db.execute({ sql: "SELECT venture_id, name FROM venture_operating_plans WHERE id = ?", args: [planId] });
}

/** Activate/deactivate a plan template. */
export async function setVenturePlanTemplateActive(id, isActive) {
  return db.execute({ sql: "UPDATE venture_plan_templates SET is_active = ?, updated_at = NOW() WHERE id = ?", args: [isActive, id] });
}

// ── GET /api/ventures/[id]/calendar ──────────────────────────────────────────

/** Venture-facing canonical sessions for the founder calendar (both id forms). */
export async function listVentureFacingSessionsForCalendar(id, dbId) {
  return db.execute({
    sql: `SELECT id, title, session_type, coach_name, location, meeting_link, status,
        preparation_notes, milestone_ref, journey_stage_id,
        to_char(start_time, 'YYYY-MM-DD') as date, to_char(start_time, 'HH24:MI') as start_time
        FROM venture_sessions WHERE venture_facing = TRUE AND start_time IS NOT NULL AND (venture_id = ? OR venture_id = ?)
        ORDER BY start_time`,
    args: [id, dbId],
  });
}

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

