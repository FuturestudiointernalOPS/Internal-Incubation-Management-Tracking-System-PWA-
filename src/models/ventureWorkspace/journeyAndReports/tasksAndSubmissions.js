import db from "@/lib/db";

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
