import db from "@/lib/db";

/**
 * Venture workspace model — data access for the venture workspace controllers
 * (`src/app/api/ventures/route.js` and the `[id]` routes for members, dashboard,
 * progress, tasks, blockers, standups, retros, calendar, milestones, followups
 * and action-plans).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so a
 * handful of lookups (e.g. the ventures.id-by-code resolvers) intentionally
 * repeat the same SQL across functions. Queries that also exist in
 * "@/lib/ventures" are kept here without cross-file coupling.
 */

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

// ── GET/POST/PATCH /api/ventures/[id]/blockers ───────────────────────────────

/** Internal ventures.id by VNT code — blockers resolveVentureDbId helper. */
export async function getVentureDbIdForBlockers(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture blockers with creator names, newest first. */
export async function listVentureBlockersWithCreators(venture_id) {
  return db.execute({
    sql: `SELECT b.*, c.name as creator_name FROM blockers b LEFT JOIN contacts c ON b.user_id = c.cid WHERE b.venture_id = ? ORDER BY b.created_at DESC`,
    args: [venture_id],
  });
}

/** Task existence check scoped to a venture. */
export async function getVentureTaskByVentureId(task_id, venture_id) {
  return db.execute({
    sql: "SELECT id FROM venture_tasks WHERE id = ? AND venture_id = ?",
    args: [task_id, venture_id],
  });
}

/** Contact display name for the blocker creator. */
export async function getContactNameByCid(cid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Schema backfill: drop the legacy blockers task fkey constraint (best-effort). */
export async function dropBlockersTaskForeignKeyIfExists() {
  return db.execute({
    sql: "ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_task_id_fkey",
    args: [],
  });
}

/** Schema backfill: ensure the blockers supporting_url column (best-effort). */
export async function addSupportingUrlColumnToBlockers() {
  return db.execute({
    sql: "ALTER TABLE blockers ADD COLUMN IF NOT EXISTS supporting_url TEXT",
    args: [],
  });
}

/** Insert a retro-sourced venture blocker (status defaults to 'active'). */
export async function insertVentureBlocker({ task_id, title, description, venture_id, venture_retro_id, user_id, user_name, supporting_url }) {
  return db.execute({
    sql: "INSERT INTO blockers (task_id, title, description, venture_id, venture_retro_id, status, user_id, user_name, supporting_url) VALUES (?,?,?,?,?,'active',?,?,?)",
    args: [task_id, title, description || null, venture_id, venture_retro_id, user_id, user_name || "", supporting_url || null],
  });
}

/** Creator of a venture blocker (resolve permission check). */
export async function getVentureBlockerCreator(blocker_id, venture_id) {
  return db.execute({
    sql: "SELECT user_id FROM blockers WHERE id = ? AND venture_id = ?",
    args: [blocker_id, venture_id],
  });
}

/** Mark a venture blocker resolved (records who resolved it). */
export async function resolveVentureBlocker(blocker_id, resolved_by) {
  return db.execute({
    sql: "UPDATE blockers SET status='resolved', resolved_at=NOW(), resolved_by=? WHERE id=?",
    args: [resolved_by, blocker_id],
  });
}

// ── GET/POST /api/ventures/[id]/standups ─────────────────────────────────────

/** Internal ventures.id by VNT code — standups resolveVentureDbId helper. */
export async function getVentureDbIdForStandups(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Standup row id for a venture/week (current-week submitted check). */
export async function getStandupForWeek(venture_id, week_number, year) {
  return db.execute({
    sql: "SELECT id FROM venture_standups WHERE venture_id = ? AND week_number = ? AND year = ? LIMIT 1",
    args: [venture_id, week_number, year],
  });
}

/** All venture standups with creator names, newest week/year first. */
export async function listVentureStandupsWithCreators(venture_id) {
  return db.execute({
    sql: `SELECT vs.*, c.name as creator_name FROM venture_standups vs LEFT JOIN contacts c ON vs.created_by = c.cid WHERE vs.venture_id = ? ORDER BY vs.year DESC, vs.week_number DESC`,
    args: [venture_id],
  });
}

/** Insert a weekly venture standup. */
export async function insertVentureStandup({ venture_id, week_number, year, top_priorities, expected_deliverables, weekly_priorities, created_by }) {
  return db.execute({
    sql: "INSERT INTO venture_standups (venture_id, week_number, year, top_priorities, expected_deliverables, weekly_priorities, created_by) VALUES (?,?,?,?,?,?,?)",
    args: [venture_id, week_number, year, top_priorities || null, expected_deliverables || null, weekly_priorities || null, created_by],
  });
}

// ── GET/POST /api/ventures/[id]/retros ───────────────────────────────────────

/** Internal ventures.id by VNT code — retros resolveVentureDbId helper. */
export async function getVentureDbIdForRetros(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Retro row id for a venture/week (current-week submitted check). */
export async function getRetroForWeek(venture_id, week_number, year) {
  return db.execute({
    sql: "SELECT id FROM venture_retros WHERE venture_id = ? AND week_number = ? AND year = ? LIMIT 1",
    args: [venture_id, week_number, year],
  });
}

/** All venture retros with creator names, newest week/year first. */
export async function listVentureRetrosWithCreators(venture_id) {
  return db.execute({
    sql: "SELECT vr.*, c.name as creator_name FROM venture_retros vr LEFT JOIN contacts c ON vr.created_by = c.cid WHERE vr.venture_id = ? ORDER BY vr.year DESC, vr.week_number DESC",
    args: [venture_id],
  });
}

/** Insert a weekly venture retro. */
export async function insertVentureRetro({ venture_id, week_number, year, completed_tasks, outstanding_tasks, carry_forward_notes, created_by }) {
  return db.execute({
    sql: "INSERT INTO venture_retros (venture_id, week_number, year, completed_tasks, outstanding_tasks, carry_forward_notes, created_by) VALUES (?,?,?,?,?,?,?)",
    args: [venture_id, week_number, year, completed_tasks || null, outstanding_tasks || null, carry_forward_notes || null, created_by],
  });
}

// ── GET /api/ventures/[id]/calendar ──────────────────────────────────────────

/** Internal ventures.id by VNT code — calendar resolveVentureDbId helper. */
export async function getVentureDbIdForCalendar(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture tasks with due dates (calendar events). */
export async function listVentureTasksWithDueDates(venture_id) {
  return db.execute({
    sql: "SELECT id, title, due_date as date, status, priority FROM venture_tasks WHERE venture_id = ? AND due_date IS NOT NULL ORDER BY due_date",
    args: [venture_id],
  });
}

/** Venture milestones with target dates (calendar events). */
export async function listVentureMilestonesWithTargetDates(venture_id) {
  return db.execute({
    sql: "SELECT id, title, target_date as date, status FROM venture_milestones WHERE venture_id = ? AND target_date IS NOT NULL ORDER BY target_date",
    args: [venture_id],
  });
}

/** Venture action plans with deadlines (calendar events). */
export async function listVentureActionPlansWithDeadlines(venture_id) {
  return db.execute({
    sql: "SELECT id, title, deadline as date, status, priority FROM venture_action_plans WHERE venture_id = ? AND deadline IS NOT NULL ORDER BY deadline",
    args: [venture_id],
  });
}

/** Coaching sessions with session dates (calendar events). */
export async function listVentureCoachingSessionsForCalendar(venture_id) {
  return db.execute({
    sql: `SELECT vcs.id, CONCAT(c.name, ' Coaching') as title, vcs.session_date as date, c.name as advisor_name, vcs.location, vcs.meeting_link, vcs.start_time FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? AND vcs.session_date IS NOT NULL ORDER BY vcs.session_date`,
    args: [venture_id],
  });
}

/** Coaching follow-up dates as separate calendar events. */
export async function listVentureCoachingFollowUpDates(venture_id) {
  return db.execute({
    sql: `SELECT vcs.id, CONCAT('Follow-up: ', c.name) as title, vcs.follow_up_date as date, c.name as advisor_name FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? AND vcs.follow_up_date IS NOT NULL ORDER BY vcs.follow_up_date`,
    args: [venture_id],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/milestones ─────────────────────────────

/** Internal ventures.id by VNT code — milestones GET resolver. */
export async function getVentureDbIdForMilestoneList(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Internal ventures.id by VNT code — milestones POST resolver. */
export async function getVentureDbIdForMilestoneCreate(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** All milestones of a Venture db id, newest first. */
export async function listVentureMilestonesByDbId(ventureDbId) {
  return db.execute({ sql: "SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY created_at DESC", args: [ventureDbId] });
}

/** Whether a journey stage belongs to a Venture db id. */
export async function ventureJourneyStageExists(stageId, ventureDbId) {
  return db.execute({ sql: "SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?", args: [stageId, ventureDbId] });
}

/** Insert one milestone (id supplied by the caller). */
export async function insertVentureMilestone({
  id,
  ventureDbId,
  title,
  description,
  targetDate,
  status,
  createdBy,
  journeyStageId,
  objective,
  startDate,
  priority,
  ownerCid,
  ownerName,
  displayOrder,
}) {
  return db.execute({
    sql: `INSERT INTO venture_milestones (id, venture_id, title, description, target_date, status, progress, created_by, journey_stage_id, objective, start_date, priority, owner_cid, owner_name, display_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, ventureDbId, title, description, targetDate, status, createdBy, journeyStageId, objective, startDate, priority, ownerCid, ownerName, displayOrder],
  });
}

/** The BEFORE state of a milestone, for field-level history. */
export async function getVentureMilestoneBeforeUpdate(milestoneId, ventureDbId) {
  return db.execute({
    sql: `SELECT title, description, objective, status, progress, target_date, start_date,
                 priority, owner_cid, owner_name, journey_stage_id, display_order
            FROM venture_milestones WHERE id = ? AND venture_id = ?`,
    args: [milestoneId, ventureDbId],
  });
}

/** The Venture's db id + code by code-or-uuid id (milestone completion authority). */
export async function getVentureIdAndCode(id) {
  return db.execute({
    sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  });
}

/** Apply controller-built SET clauses to a milestone row. */
export async function updateVentureMilestoneFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_milestones SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

/** The legacy-schema fallback: the same update without the updated_at clause. */
export async function updateVentureMilestoneValueFields(valueClauses, args) {
  return db.execute({
    sql: `UPDATE venture_milestones SET ${valueClauses.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

/** A milestone's title + journey stage, by id. */
export async function getVentureMilestoneTitleAndStage(milestoneId) {
  return db.execute({
    sql: "SELECT title, journey_stage_id FROM venture_milestones WHERE id = ?",
    args: [milestoneId],
  });
}

// ── GET /api/ventures/[id]/followups ─────────────────────────────────────────

/** Internal ventures.id by VNT code — followups GET resolver. */
export async function getVentureDbIdForFollowups(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Follow-ups for a venture (v2_followups via its venture_id column). */
export async function listVentureFollowups(venture_id) {
  return db.execute({
    sql: "SELECT * FROM v2_followups WHERE venture_id = ? ORDER BY created_at DESC",
    args: [venture_id],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/action-plans ───────────────────────────

/** Internal ventures.id by VNT code — action-plans resolveVentureDbId helper. */
export async function getVentureDbIdForActionPlans(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture action plans with owner names, optionally scoped to a milestone. */
export async function listVentureActionPlans(venture_id, milestone_id) {
  let sql, args;
  if (milestone_id) {
    sql = `SELECT ap.*, c.name as owner_name FROM venture_action_plans ap LEFT JOIN contacts c ON ap.owner_contact_id = c.cid WHERE ap.venture_id = ? AND ap.milestone_id = ? ORDER BY ap.created_at DESC`;
    args = [venture_id, milestone_id];
  } else {
    sql = `SELECT ap.*, c.name as owner_name FROM venture_action_plans ap LEFT JOIN contacts c ON ap.owner_contact_id = c.cid WHERE ap.venture_id = ? ORDER BY ap.created_at DESC`;
    args = [venture_id];
  }
  return db.execute({ sql, args });
}

/** Insert a venture action plan (priority defaults to 'medium'). */
export async function insertVentureActionPlan({ venture_id, milestone_id, title, priority, deadline, owner_contact_id, created_by }) {
  return db.execute({
    sql: `INSERT INTO venture_action_plans (venture_id, milestone_id, title, priority, deadline, owner_contact_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [venture_id, milestone_id || null, title, priority || "medium", deadline || null, owner_contact_id || null, created_by],
  });
}

/** Apply controller-built SET clauses to a venture action plan row. */
export async function updateVentureActionPlanFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_action_plans SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

// ── GET /api/ventures/assigned ───────────────────────────────────────────────

/** A staff member's active Venture assignments, optionally filtered to one Venture. */
export async function listVenturesAssignedToStaff(staffCid, ventureFilter) {
  let sql = `
      SELECT a.id, a.responsibility_code, vr.name AS responsibility_name,
             a.scope_type, a.scope_ref_type, a.scope_ref_id, a.notes, a.created_at AS assigned_at,
             v.venture_id, v.company_name, v.name, v.status, v.business_stage, v.industry, v.country
      FROM venture_staff_assignments a
      JOIN ventures v ON v.venture_id = a.venture_id
      LEFT JOIN venture_responsibilities vr ON vr.code = a.responsibility_code
      WHERE a.staff_contact_id = ? AND a.status = 'active'
    `;
  const args = [staffCid];
  if (ventureFilter) {
    sql += " AND a.venture_id = ?";
    args.push(ventureFilter);
  }
  sql += " ORDER BY v.company_name NULLS LAST, v.name NULLS LAST, a.id DESC";

  return db.execute({ sql, args });
}

// ── GET /api/ventures/[id]/my-access ─────────────────────────────────────────

/** The canonical VNT code for a code-or-uuid id, or none. */
export async function getVentureCodeByIdOrCode(id) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE venture_id = ? OR id::text = ? LIMIT 1",
    args: [id, id],
  });
}

/** A contact's active assignment rows for one Venture (my-access facts). */
export async function listActiveVentureAssignmentsForAccess(ventureCode, cid) {
  return db.execute({
    sql: `SELECT responsibility_code, scope_type, scope_ref_type, scope_ref_id
                FROM venture_staff_assignments
                WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active'`,
    args: [ventureCode, cid],
  });
}

// ── GET /api/ventures/[id]/history ───────────────────────────────────────────

/** Whether a contact is an active member of a Venture (by code or either cid column). */
export async function isActiveVentureMember(ventureId, cid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND removed_at IS NULL LIMIT 1",
    args: [ventureId, cid || "", cid || ""],
  });
}

// ── GET /api/ventures/[id]/venture-history ───────────────────────────────────

/** Internal ventures.id for a code-or-uuid id, or none. */
export async function getVentureDbIdByCodeOrId(id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  });
}

/** Venture history events for the given owner ids (code + internal id). */
export async function listVentureHistoryEvents(owners) {
  return db.execute({
    sql: `SELECT event_type, description, metadata, created_by, created_at
              FROM venture_history WHERE venture_id IN (${owners.map(() => "?").join(", ")})
              ORDER BY created_at ASC LIMIT 300`,
    args: owners,
  });
}

/** A Venture's readable internal notes (venture-history, staff only). */
export async function listVentureHistoryNotes(owners) {
  return db.execute({
    sql: `SELECT id, title, body, author_name, scope_ref_type, scope_ref_id, created_at
                  FROM venture_notes WHERE venture_id IN (${owners.map(() => "?").join(", ")}) AND is_archived = FALSE
                  ORDER BY created_at DESC LIMIT 50`,
    args: owners,
  });
}

/** A Venture's submission review decisions (venture-history). */
export async function listVentureHistoryReviewDecisions(owners) {
  return db.execute({
    sql: `SELECT s.version, s.status, s.review_decision, s.review_comment, s.reviewed_at,
                     s.submitted_by_name, s.reviewed_by, s.created_at,
                     t.title AS task_title
              FROM venture_task_submissions s
              JOIN venture_tasks t ON t.id = s.task_id
              WHERE t.venture_id IN (${owners.map(() => "?").join(", ")}) AND s.review_decision IS NOT NULL
              ORDER BY s.reviewed_at DESC NULLS LAST LIMIT 100`,
    args: owners,
  });
}

/** A Venture's session notes (venture-history, staff only). */
export async function listVentureHistorySessionNotes(owners) {
  return db.execute({
    sql: `SELECT sn.id, sn.note_type, sn.content, sn.author_name, sn.created_at,
                         s.title AS session_title, s.start_time, s.journey_stage_id, s.milestone_ref
                  FROM venture_session_notes sn
                  JOIN venture_sessions s ON s.id = sn.session_id
                  WHERE s.venture_id IN (${owners.map(() => "?").join(", ")})
                  ORDER BY sn.created_at DESC LIMIT 50`,
    args: owners,
  });
}

// ── POST /api/ventures/[id]/coach-invite ─────────────────────────────────────

/** Company/name of a Venture by code-or-uuid id (coach invite label). */
export async function getVentureNameByIdOrCode(id) {
  return db.execute({
    sql: "SELECT company_name, name FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/staff-assignments ──────────────────────

/** Existing Venture code check before assigning staff. */
export async function getVentureCodeForAssignment(ventureId) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Live contact check before assigning staff. */
export async function getLiveContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE cid = ? AND deleted = 0",
    args: [cid],
  });
}

/** An existing active assignment of the same person / responsibility / scope. */
export async function findDuplicateVentureAssignment({
  ventureId,
  staffContactId,
  responsibilityCode,
  scopeType,
  scopeRefId,
}) {
  return db.execute({
    sql: `SELECT 1 FROM venture_staff_assignments
            WHERE venture_id = ? AND staff_contact_id = ? AND responsibility_code = ?
              AND scope_type = ? AND COALESCE(scope_ref_id,'') = COALESCE(?, '') AND status = 'active'`,
    args: [ventureId, staffContactId, responsibilityCode, scopeType, scopeRefId],
  });
}

/** Task totals (all + completed) for a venture, the completed statuses injected. */
export async function countVentureTasksWithCompletedStatuses(dbId, completedStatuses) {
  const completedSet = completedStatuses.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT COUNT(*) as total, SUM(CASE WHEN status IN (${completedSet}) THEN 1 ELSE 0 END) as done FROM venture_tasks WHERE venture_id = ?`,
    args: [...completedStatuses, dbId],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/members ────────────────────────────────

/** Existence check: a Venture by its VNT code. */
export async function getVentureByCode(ventureId) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
}

/** A Venture's active roster with contact names/emails, grouped by type. */
export async function listVentureMembersWithContacts(ventureCode) {
  return db.execute({
    sql: `
        SELECT vm.*, c.name as contact_name, c.email as contact_email
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.removed_at IS NULL
        ORDER BY vm.member_type, vm.joined_at DESC
      `,
    args: [ventureCode],
  });
}

/** Existing active roster row whose contact email matches (case-insensitive). */
export async function findVentureMemberByEmail(ventureCode, email) {
  return db.execute({
    sql: `SELECT 1 FROM venture_members vm
            JOIN contacts c ON c.cid = COALESCE(vm.contact_id, vm.user_cid)
            WHERE vm.venture_id = ? AND vm.removed_at IS NULL AND LOWER(c.email) = LOWER(?)
            LIMIT 1`,
    args: [ventureCode, email],
  });
}

/** A Venture's display name (company_name first, legacy name fallback). */
export async function getVentureDisplayNameByCode(ventureCode) {
  return db.execute({
    sql: "SELECT COALESCE(NULLIF(company_name, ''), name) AS venture_name FROM ventures WHERE venture_id = ? LIMIT 1",
    args: [ventureCode],
  });
}

/** One roster row (type, contact, role) of a Venture, by id. */
export async function getVentureMemberById(memberId, ventureId) {
  return db.execute({
    sql: "SELECT member_type, contact_id, role FROM venture_members WHERE id = ? AND venture_id = ?",
    args: [memberId, ventureId],
  });
}

/** The contact id behind one roster row, by id. */
export async function getVentureMemberContactId(memberId, ventureId) {
  return db.execute({
    sql: "SELECT contact_id FROM venture_members WHERE id = ? AND venture_id = ?",
    args: [memberId, ventureId],
  });
}

/** Soft-remove one roster row. */
export async function archiveVentureMember(memberId, ventureId) {
  return db.execute({
    sql: "UPDATE venture_members SET removed_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [memberId, ventureId],
  });
}

/** Apply controller-built SET clauses to a roster row. */
export async function updateVentureMemberFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_members SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

// ── POST /api/ventures/[id]/milestones/archive ───────────────────────────────

/** Milestones of a Venture (by code-or-uuid) among the given ids, with the Venture's db id. */
export async function listMilestonesForArchive(id, ids) {
  return db.execute({
    sql: `SELECT m.id, m.title, m.journey_stage_id, v.id AS venture_db_id FROM venture_milestones m
          JOIN ventures v ON (m.venture_id::text = v.id::text OR m.venture_id::text = v.venture_id)
          WHERE (v.venture_id = ? OR v.id::text = ?)
            AND m.id::text = ANY(?)`,
    args: [id, id, ids],
  });
}
