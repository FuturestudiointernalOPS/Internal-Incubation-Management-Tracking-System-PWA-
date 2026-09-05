import db from "@/lib/db";

/**
 * Forms & submissions model — data access for the platform form/collection,
 * submission/response and knowledge-bank controllers.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Route → function groups in this file:
 *  - src/app/api/platform/forms/route.js          → getPlatformFormByTextId … archivePlatformForm
 *  - src/app/api/platform/collections/route.js    → getPlatformCollectionById … createPlatformCollectionAuditLog
 *  - src/app/api/platform/notifications/route.js  → listPlatformNotifications … markPlatformNotificationRead
 *  - src/app/api/submissions/route.js             → getSubmissionProgramStatus … updateSubmissionsScoreForParticipant
 *  - src/app/api/responses/route.js               → getCampaignResponseStats … listFlaggedFormResponses
 *  - src/app/api/responses/review/route.js        → resolveFormResponseMatch … updateCampaignContactMatchStatus
 *  - src/app/api/respond/route.js                 → getLegacyFormGroupName … updateCampaignContactResponseStatus
 *  - src/app/api/knowledge/route.js               → createKnowledgeNote … deleteKnowledgeNote
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── src/app/api/platform/forms/route.js ─────────────────────────────────────

/** Platform form row matched by its text id (GET /api/platform/forms?id=X). */
export async function getPlatformFormByTextId(id) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id::text = ?",
    args: [id],
  });
}

/** Sections of a platform form, ordered for the builder (GET by id). */
export async function getPlatformFormSections(id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_sections WHERE form_id::text = ? ORDER BY sort_order",
    args: [id],
  });
}

/** Fields of a platform form, ordered for the builder (GET by id). */
export async function getPlatformFormFields(id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order",
    args: [id],
  });
}

/** Newest published snapshot row of a form (empty-live-tables fallback). */
export async function getLatestPlatformFormVersion(formId) {
  return db.execute({
    sql: "SELECT snapshot, created_at FROM platform_form_versions WHERE form_id = ? ORDER BY version DESC LIMIT 1",
    args: [formId],
  });
}

/** Platform forms matching optional collection/status filters, newest first. */
export async function listPlatformForms(collectionId, status) {
  let sql = "SELECT * FROM platform_forms WHERE 1=1";
  const args = [];

  if (collectionId) {
    sql += " AND collection_id = ?";
    args.push(parseInt(collectionId));
  }
  if (status && status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  sql += " ORDER BY updated_at DESC";

  return db.execute({ sql, args });
}

/** Platform form row by numeric id (publish path existence check). */
export async function getPlatformFormById(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Insert a version snapshot row for a published form. */
export async function createPlatformFormVersion(formId, version, snapshot, publishedBy) {
  return db.execute({
    sql: "INSERT INTO platform_form_versions (form_id, version, snapshot, published_by) VALUES (?, ?, ?, ?)",
    args: [formId, version, snapshot, publishedBy],
  });
}

/** Bump a form's version and mark it published. */
export async function publishPlatformForm(formId, version) {
  return db.execute({
    sql: "UPDATE platform_forms SET version = ?, status = 'published', updated_at = NOW() WHERE id = ?",
    args: [version, formId],
  });
}

/** Create a new platform form, returning the full row. */
export async function createPlatformForm({
  name,
  description,
  collection_id,
  visibility,
  settings,
  tags,
  owner_id,
  owner_name,
  created_by,
}) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, collection_id, visibility, settings, tags, owner_id, owner_name, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
    args: [
      name.trim(),
      description || null,
      collection_id ? parseInt(collection_id) : null,
      visibility || "internal",
      JSON.stringify(settings || {}),
      tags || [],
      owner_id || null,
      owner_name,
      created_by || null,
    ],
  });
}

/** Update an existing builder section (by id + form id). */
export async function updatePlatformFormSection({ formId, section }) {
  return db.execute({
    sql: "UPDATE platform_form_sections SET title = ?, description = ?, sort_order = ?, settings = ? WHERE id = ? AND form_id = ?",
    args: [
      section.title,
      section.description || null,
      section.sort_order || 0,
      JSON.stringify(section.settings || {}),
      parseInt(section.id),
      parseInt(formId),
    ],
  });
}

/** Insert a new builder section for a form. */
export async function createPlatformFormSection({ formId, section }) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, ?, ?, ?)",
    args: [parseInt(formId), section.title, section.description || null, section.sort_order || 0],
  });
}

/** Delete a builder field (by id + form id). */
export async function deletePlatformFormField({ formId, fieldId }) {
  return db.execute({
    sql: "DELETE FROM platform_form_fields WHERE id = ? AND form_id = ?",
    args: [parseInt(fieldId), parseInt(formId)],
  });
}

/** Update an existing builder field. sectionId is the FK-resolved value. */
export async function updatePlatformFormField({ formId, field, sectionId }) {
  return db.execute({
    sql: `UPDATE platform_form_fields
                    SET label = ?, field_type = ?, placeholder = ?, help_text = ?, required = ?,
                        options = ?, validation = ?, conditional_logic = ?, sort_order = ?,
                        section_id = ?, settings = ?, updated_at = NOW()
                    WHERE id = ? AND form_id = ?`,
    args: [
      field.label, field.field_type || "text", field.placeholder || null, field.help_text || null,
      field.required ? 1 : 0,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      field.conditional_logic ? JSON.stringify(field.conditional_logic) : null,
      field.sort_order || 0,
      sectionId,
      JSON.stringify(field.settings || {}),
      parseInt(field.id), parseInt(formId),
    ],
  });
}

/** Insert a new builder field, returning the created row. */
export async function createPlatformFormField({ formId, field, sectionId }) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, placeholder, help_text, required, options, validation, conditional_logic, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *`,
    args: [
      parseInt(formId),
      sectionId,
      field.field_type || "text",
      field.label,
      field.placeholder || null,
      field.help_text || null,
      field.required ? 1 : 0,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      field.conditional_logic ? JSON.stringify(field.conditional_logic) : null,
      field.sort_order || 0,
    ],
  });
}

/** Delete a builder section (by id + form id), after its fields moved away. */
export async function deletePlatformFormSection({ formId, sectionId }) {
  return db.execute({
    sql: "DELETE FROM platform_form_sections WHERE id = ? AND form_id = ?",
    args: [sectionId, parseInt(formId)],
  });
}

/** Touch a form's updated_at timestamp after a builder save. */
export async function touchPlatformForm(formId) {
  return db.execute({
    sql: "UPDATE platform_forms SET updated_at = NOW() WHERE id = ?",
    args: [parseInt(formId)],
  });
}

/** Metadata-only update of a form (only keys present in the payload). */
export async function updatePlatformFormMetadata({
  id,
  name,
  description,
  collection_id,
  visibility,
  tags,
  status,
  settings,
}) {
  const fields = [];
  const args = [];
  const updatable = { name, description, collection_id, visibility, tags, status };

  for (const [key, value] of Object.entries(updatable)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      args.push(key === "collection_id" && value ? parseInt(value) : value);
    }
  }
  if (settings !== undefined) {
    fields.push("settings = ?");
    args.push(JSON.stringify(settings));
  }
  fields.push("updated_at = NOW()");
  args.push(parseInt(id));

  return db.execute({
    sql: `UPDATE platform_forms SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Hard-delete: email logs attached to a form's run submissions. */
export async function deletePlatformEmailLogsForForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_email_log WHERE submission_id IN (SELECT s.id FROM platform_form_submissions s JOIN platform_form_runs r ON s.run_id = r.id WHERE r.form_id = ?)",
    args: [formId],
  });
}

/** Hard-delete: review rows attached to a form's run submissions. */
export async function deletePlatformSubmissionReviewsForForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_submission_reviews WHERE submission_id IN (SELECT s.id FROM platform_form_submissions s JOIN platform_form_runs r ON s.run_id = r.id WHERE r.form_id = ?)",
    args: [formId],
  });
}

/** Hard-delete: evaluation rows attached to a form's run submissions. */
export async function deletePlatformSubmissionEvaluationsForForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_submission_evaluations WHERE submission_id IN (SELECT s.id FROM platform_form_submissions s JOIN platform_form_runs r ON s.run_id = r.id WHERE r.form_id = ?)",
    args: [formId],
  });
}

/** Permanent delete of the form row itself. */
export async function deletePlatformForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Soft delete: archive the form. */
export async function archivePlatformForm(formId) {
  return db.execute({
    sql: "UPDATE platform_forms SET status = 'archived', updated_at = NOW() WHERE id = ?",
    args: [formId],
  });
}

// ── src/app/api/platform/collections/route.js ───────────────────────────────

/** Single collection row by numeric id (GET /api/platform/collections?id=X). */
export async function getPlatformCollectionById(id) {
  return db.execute({
    sql: "SELECT * FROM platform_collections WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Collections matching optional parent/status/owner/search filters, by name. */
export async function listPlatformCollections({ parentId, status, ownerId, search }) {
  let sql = "SELECT * FROM platform_collections WHERE 1=1";
  const args = [];

  if (parentId) {
    sql += " AND parent_id = ?";
    args.push(parseInt(parentId));
  }
  if (status && status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  if (ownerId) {
    sql += " AND owner_id = ?";
    args.push(ownerId);
  }
  if (search) {
    sql += " AND (name ILIKE ? OR description ILIKE ?)";
    args.push(`%${search}%`, `%${search}%`);
  }
  sql += " ORDER BY name ASC";

  return db.execute({ sql, args });
}

/** Parent lookup (id, parent_id) used to validate parent existence. */
export async function getPlatformCollectionParentById(parentId) {
  return db.execute({
    sql: "SELECT id, parent_id FROM platform_collections WHERE id = ?",
    args: [parseInt(parentId)],
  });
}

/** Create a collection, returning the full row. */
export async function createPlatformCollection({
  name,
  slug,
  description,
  parent_id,
  owner_id,
  owner_name,
  visibility,
  tags,
  category,
  color,
  created_by,
}) {
  return db.execute({
    sql: `INSERT INTO platform_collections
            (name, slug, description, parent_id, owner_id, owner_name, visibility, tags, category, color, created_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            RETURNING *`,
    args: [
      name.trim(),
      slug,
      description || null,
      parent_id ? parseInt(parent_id) : null,
      owner_id || null,
      owner_name || null,
      visibility || "internal",
      tags || [],
      category || null,
      color || "#FF6600",
      created_by || null,
    ],
  });
}

/** Full collection row by numeric id (update-path existence check). */
export async function getPlatformCollectionForUpdate(id) {
  return db.execute({
    sql: "SELECT * FROM platform_collections WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Metadata update of a collection (only keys present in the payload). */
export async function updatePlatformCollection({
  id,
  name,
  description,
  parent_id,
  owner_id,
  owner_name,
  visibility,
  tags,
  category,
  status,
  color,
}) {
  const fields = [];
  const args = [];
  const updatable = { name, description, parent_id, owner_id, owner_name, visibility, tags, category, status, color };

  for (const [key, value] of Object.entries(updatable)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      if (key === "parent_id") {
        args.push(value ? parseInt(value) : null);
      } else {
        args.push(value);
      }
    }
  }
  fields.push("updated_at = NOW()");
  args.push(parseInt(id));

  return db.execute({
    sql: `UPDATE platform_collections SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Soft delete: archive a collection, returning the updated row. */
export async function archivePlatformCollection(id) {
  return db.execute({
    sql: "UPDATE platform_collections SET status = 'archived', updated_at = NOW() WHERE id = ? RETURNING *",
    args: [parseInt(id)],
  });
}

/** Insert a collection audit log entry. */
export async function createPlatformCollectionAuditLog({
  collection_id,
  action,
  actor_id,
  actor_name,
  details,
}) {
  return db.execute({
    sql: `INSERT INTO platform_collection_audit (collection_id, action, actor_id, actor_name, details)
          VALUES (?, ?, ?, ?, ?)`,
    args: [collection_id, action, actor_id || null, actor_name || null, JSON.stringify(details)],
  });
}

// ── src/app/api/platform/notifications/route.js ─────────────────────────────

/** Unread (or all) platform notifications for a user, newest first. */
export async function listPlatformNotifications(cid, all) {
  const sql = all
    ? "SELECT * FROM platform_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    : "SELECT * FROM platform_notifications WHERE user_id = ? AND read = false ORDER BY created_at DESC LIMIT 20";

  return db.execute({ sql, args: [cid] });
}

/** Mark all of a user's unread notifications as read. */
export async function markAllPlatformNotificationsRead(cid) {
  return db.execute({
    sql: "UPDATE platform_notifications SET read = true WHERE user_id = ? AND read = false",
    args: [cid],
  });
}

/** Mark a single notification as read, scoped to its owner. */
export async function markPlatformNotificationRead(id, cid) {
  return db.execute({
    sql: "UPDATE platform_notifications SET read = true WHERE id = ? AND user_id = ?",
    args: [parseInt(id), cid],
  });
}

// ── src/app/api/submissions/route.js ────────────────────────────────────────

/** Program status lookup used to gate participant/team submissions. */
export async function getSubmissionProgramStatus(programId) {
  return db.execute({
    sql: "SELECT status FROM v2_programs WHERE id::text = ?",
    args: [String(programId)],
  });
}

/** A participant's own membership status within a program (completion gate). */
export async function getParticipantProgramSubmissionStatus(participantId, programId) {
  return db.execute({
    sql: `SELECT status FROM participant_programs
                  WHERE participant_id = ? AND program_id::text = ?
                  LIMIT 1`,
    args: [participantId, String(programId)],
  });
}

/** Migration safety: make sure v2_submissions.team_id exists (POST). */
export async function ensureSubmissionsTeamIdColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS team_id TEXT");
}

/** Highest existing version number for a participant + program (+ deliverable/document). */
export async function findMaxSubmissionVersion({
  participant_id,
  program_id,
  deliverable_id,
  document_id,
}) {
  let sql = "SELECT MAX(version_number) as max_ver FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ? AND (";
  const args = [participant_id || null, program_id];
  const conditions = [];

  if (deliverable_id) {
    conditions.push("deliverable_id::text = ?");
    args.push(deliverable_id);
  }
  if (document_id) {
    conditions.push("document_id = ?");
    args.push(document_id);
  }

  if (conditions.length > 0) {
    sql += conditions.join(" OR ") + ")";
    return db.execute({ sql, args });
  }
  // No deliverable/document filter: nothing to version against.
  return { rows: [] };
}

/** Insert a new submission version, returning its id. */
export async function createSubmission({
  program_id,
  deliverable_id,
  document_id,
  group_id,
  team_id,
  participant_id,
  file_url,
  supporting_url,
  status,
  feedback,
  version_number,
}) {
  return db.execute({
    sql: `INSERT INTO v2_submissions (
          program_id, deliverable_id, document_id, group_id, team_id, participant_id,
          file_url, supporting_url, status, feedback, version_number
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      program_id,
      deliverable_id,
      document_id,
      group_id || null,
      team_id || null,
      participant_id || null,
      file_url,
      supporting_url || null,
      status || "pending",
      feedback || null,
      version_number,
    ],
  });
}

/** Migration safety: role-lock column must exist before PATCH reads it. */
export async function ensureSubmissionsRoleLockColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS reviewed_by_role TEXT DEFAULT NULL");
}

/** Program id of a submission (used for facilitator assignment checks). */
export async function getSubmissionProgramId(id) {
  return db.execute({
    sql: "SELECT program_id FROM v2_submissions WHERE id::text = ?",
    args: [String(id)],
  });
}

/** True-check that a submission's participant belongs to one of the team ids. */
export async function checkSubmissionInFacilitatorTeamScope(id, teamIds) {
  return db.execute({
    sql:
      "SELECT 1 FROM v2_submissions s JOIN contacts c ON s.participant_id::text = c.cid WHERE s.id::text = ? AND c.v2_team_id IN (" +
      teamIds.map(() => "?").join(",") +
      ")",
    args: [String(id), ...teamIds],
  });
}

/** Submission + participant + deliverable + program details for a review. */
export async function getSubmissionReviewDetails(id) {
  return db.execute({
    sql: `
           SELECT s.id, s.program_id, s.participant_id, s.team_id,
                  s.status, s.reviewed_by_role, s.teacher_id,
                  c.email, c.name as participant_name,
                  d.title as deliverable_title, prog.assigned_pm_id,
                  prog.name as program_name
           FROM v2_submissions s
           LEFT JOIN contacts c ON s.participant_id::text = c.cid
           LEFT JOIN v2_document_requirements d ON s.deliverable_id::text = d.id::text
           LEFT JOIN v2_programs prog ON s.program_id::text = prog.id::text
           WHERE s.id::text = ?
        `,
    args: [id],
  });
}

/** Migration safety: v2_submissions.score column. */
export async function ensureSubmissionsScoreColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL");
}

/** Migration safety: v2_submissions.reviewed_by_role column (review path). */
export async function ensureSubmissionsReviewedByRoleColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS reviewed_by_role TEXT DEFAULT NULL");
}

/** Migration safety: v2_submissions.updated_at column. */
export async function ensureSubmissionsUpdatedAtColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()");
}

/** Migration safety: v2_followups.participant_cid column. */
export async function ensureSubmissionsFollowupsParticipantCidColumn() {
  return db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS participant_cid TEXT DEFAULT NULL");
}

/** Apply a review decision (status/feedback/score/role lock) to a submission. */
export async function updateSubmissionReview({
  id,
  status,
  feedback,
  score,
  hasNewScore,
  review_action,
  rejection_reason,
  role,
  teacherId,
}) {
  return db.execute({
    sql: `UPDATE v2_submissions SET
              status = ?, feedback = ?, score = COALESCE(?, score),
              review_action = ?, rejection_reason = ?,
              reviewed_by_role = ?, teacher_id = ?,
              approved_at = CURRENT_TIMESTAMP,
              updated_at = NOW()
            WHERE id = ?`,
    args: [
      status,
      feedback || null,
      hasNewScore ? parseInt(score) : null,
      review_action || null,
      rejection_reason || null,
      role || null,
      teacherId,
      id,
    ],
  });
}

/** Create the calendar event backing a scheduled follow-up. */
export async function createSubmissionFollowupEvent({
  program_id,
  title,
  description,
  start_time,
  end_time,
  location,
  participant_id,
  created_by,
}) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, location, participant_id, created_by)
                VALUES (?, ?, ?, 'followup', ?, ?, ?, ?, ?) RETURNING id`,
    args: [program_id, title, description, start_time, end_time, location, participant_id, created_by],
  });
}

/** Create the follow-up record itself. */
export async function createSubmissionFollowup({
  program_id,
  participant_cid,
  submission_id,
  comment,
  scheduled_at,
  duration_minutes,
  meeting_link,
  notes,
}) {
  return db.execute({
    sql: `INSERT INTO v2_followups (program_id, participant_cid, submission_id, comment, scheduled_at, duration_minutes, meeting_link, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
    args: [program_id, participant_cid, submission_id, comment, scheduled_at, duration_minutes, meeting_link, notes],
  });
}

/** Dispatch the in-app "submission reviewed" notification. */
export async function createSubmissionNotification(participantId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'submission', 0, NOW())`,
    args: [participantId, title, message],
  });
}

/** Propagate a review decision to sibling submissions of the same team. */
export async function propagateSubmissionToTeamMembers({
  status,
  score,
  hasNewScore,
  feedback,
  review_action,
  rejection_reason,
  role,
  teacherId,
  teamId,
  deliverableId,
  documentId,
  id,
  requesterCampForProp,
}) {
  const sql = `UPDATE v2_submissions SET
              status = ?, score = COALESCE(?, score), feedback = ?,
              review_action = ?, rejection_reason = ?,
              reviewed_by_role = ?, teacher_id = ?,
              approved_at = CURRENT_TIMESTAMP, updated_at = NOW()
            WHERE team_id::text = ?
              AND (deliverable_id::text = ? OR document_id::text = ?)
              AND id::text != ?
              ${
                requesterCampForProp
                  ? `AND NOT (
                      status IN ('approved','rejected')
                      AND reviewed_by_role IS NOT NULL
                      AND reviewed_by_role != ?
                    )`
                  : ""
              }`;
  const args = [
    status,
    hasNewScore ? parseInt(score) : null,
    feedback || null,
    review_action || null,
    rejection_reason || null,
    role || null,
    teacherId,
    teamId,
    deliverableId || String(documentId),
    documentId != null ? String(documentId) : deliverableId,
    id,
  ];
  if (requesterCampForProp) args.push(requesterCampForProp);
  return db.execute({ sql, args });
}

/** Migration safety: make sure v2_submissions.team_id exists (GET). */
export async function ensureSubmissionsTeamIdColumnForListing() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS team_id TEXT");
}

/** Submissions with filters; optional latest-version-per-deliverable mode. */
export async function listSubmissions({
  participant_id,
  team_id,
  group_id,
  program_id,
  deliverable_id,
  document_id,
  status,
  latest_only,
  facScopeFilter,
  facScopeArgs,
}) {
  let sql = `
       SELECT s.*,
              d.title as deliverable_title,
              d.week_number as deliverable_week,
              d.due_date as deliverable_due_date,
              c.name as participant_name, g.name as group_name
       FROM v2_submissions s
       LEFT JOIN v2_deliverables d ON s.deliverable_id::text = d.id::text
       LEFT JOIN contacts c ON s.participant_id::text = c.cid
       LEFT JOIN v2_groups g ON s.group_id::text = g.id::text
       WHERE 1=1
    `;
  let args = [];

  if (participant_id) {
    sql += " AND s.participant_id::text = ?";
    args.push(participant_id);
  }
  if (team_id) {
    sql += " AND s.team_id::text = ?";
    args.push(team_id);
  }
  if (group_id) {
    sql += " AND s.group_id::text = ?";
    args.push(group_id);
  }
  if (program_id) {
    sql += " AND s.program_id::text = ?";
    args.push(program_id);
  }
  if (deliverable_id) {
    sql += " AND s.deliverable_id::text = ?";
    args.push(deliverable_id);
  }
  if (document_id) {
    sql += " AND s.document_id = ?";
    args.push(Number(document_id));
  }
  if (status) {
    sql += " AND s.status = ?";
    args.push(status);
  }
  if (facScopeFilter) {
    sql += " AND " + facScopeFilter;
    args.push(...facScopeArgs);
  }

  // If latest_only, get the latest version per participant+deliverable
  if (latest_only) {
    sql = `
        SELECT s1.*,
               COALESCE(del.title, dr.title) as deliverable_title,
               COALESCE(del.week_number, dr.week_number) as deliverable_week,
               del.due_date as deliverable_due_date,
               c.name as participant_name, g.name as group_name
        FROM v2_submissions s1
        LEFT JOIN v2_deliverables del ON s1.deliverable_id::text = del.id::text
        LEFT JOIN v2_document_requirements dr ON s1.document_id = dr.id
        LEFT JOIN contacts c ON s1.participant_id::text = c.cid
        LEFT JOIN v2_groups g ON s1.group_id::text = g.id::text
        INNER JOIN (
          SELECT participant_id, COALESCE(deliverable_id::text, document_id::text) as lookup_id, MAX(version_number) as max_ver
          FROM v2_submissions
          WHERE 1=1
      `;
    let innerArgs = [];
    if (participant_id) {
      sql += " AND participant_id::text = ?";
      innerArgs.push(participant_id);
    }
    if (program_id) {
      sql += " AND program_id::text = ?";
      innerArgs.push(program_id);
    }
    if (deliverable_id) {
      sql += " AND (deliverable_id::text = ? OR document_id = ?)";
      innerArgs.push(deliverable_id, Number(deliverable_id) || 0);
    }
    if (facScopeFilter) {
      sql +=
        " AND participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
        facScopeArgs.map(() => "?").join(",") +
        "))";
      innerArgs.push(...facScopeArgs);
    }
    sql += " GROUP BY participant_id::text, COALESCE(deliverable_id::text, document_id::text)";
    sql += " ) s2";
    sql += " ON s1.participant_id::text = s2.participant_id AND COALESCE(s1.deliverable_id::text, s1.document_id::text) = s2.lookup_id AND s1.version_number = s2.max_ver";
    args = [...innerArgs];
  }

  sql += " ORDER BY s.created_at DESC";

  return db.execute({ sql, args });
}

/** Migration safety: score columns before an evaluation write (PUT). */
export async function ensureSubmissionScoresColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL");
}

/** Migration safety: evaluation_score column before an evaluation write (PUT). */
export async function ensureSubmissionEvaluationScoreColumn() {
  return db.execute("ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS evaluation_score INTEGER DEFAULT NULL");
}

/** Set score/evaluation columns on a single submission by id. */
export async function updateSubmissionScoreById({ score, evaluation_score, evaluation_data, id }) {
  return db.execute({
    sql: "UPDATE v2_submissions SET score = ?, evaluation_score = ?, evaluation_data = ?, updated_at = NOW() WHERE id = ?",
    args: [score, evaluation_score, evaluation_data, id],
  });
}

/** Set score/evaluation columns on every submission of a participant+program. */
export async function updateSubmissionsScoreForParticipant({
  score,
  evaluation_score,
  evaluation_data,
  participant_id,
  program_id,
}) {
  return db.execute({
    sql: "UPDATE v2_submissions SET score = ?, evaluation_score = ?, evaluation_data = ?, updated_at = NOW() WHERE participant_id::text = ? AND program_id::text = ?",
    args: [score, evaluation_score, evaluation_data, String(participant_id), String(program_id)],
  });
}

// ── src/app/api/responses/route.js ──────────────────────────────────────────

/** Per-campaign response tallies (yes/no/responded/sent/pending counts). */
export async function getCampaignResponseStats() {
  return db.execute(`
    SELECT
      c.id, c.name,
      COUNT(cc.id) as total,
      SUM(CASE WHEN cc.status = 'yes' THEN 1 ELSE 0 END) as yes_count,
      SUM(CASE WHEN cc.status = 'no' THEN 1 ELSE 0 END) as no_count,
      SUM(CASE WHEN cc.status = 'responded' THEN 1 ELSE 0 END) as other_responses,
      SUM(CASE WHEN cc.status = 'sent' THEN 1 ELSE 0 END) as pending_response,
      SUM(CASE WHEN cc.status = 'pending' THEN 1 ELSE 0 END) as unsent
    FROM campaigns c
    LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
}

/** All form responses joined with contact + form names, newest first. */
export async function listFormResponses() {
  return db.execute(`
      SELECT fr.*, c.email, c.name, f.name as form_name
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      ORDER BY fr.created_at DESC
    `);
}

/** Contact + campaign_contact status rows (detailed contacts list). */
export async function listCampaignContactsWithNames() {
  return db.execute(`
    SELECT cc.campaign_id, cc.contact_cid, cc.status, c.name, c.email
    FROM campaign_contacts cc
    JOIN contacts c ON cc.contact_cid = c.cid
  `);
}

/** Form responses flagged for manual matching, newest first. */
export async function listFlaggedFormResponses() {
  return db.execute(`
      SELECT fr.id as response_id, fr.answers, fr.confidence_score, fr.created_at, fr.cid, c.email, c.name, f.name as form_name
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      WHERE fr.match_status = 'flagged'
      ORDER BY fr.created_at DESC
    `);
}

// ── src/app/api/responses/review/route.js ───────────────────────────────────

/** Attach a contact to a form response and clear its flagged status. */
export async function resolveFormResponseMatch({ responseId, cid }) {
  return db.execute({
    sql: "UPDATE form_responses SET cid = ?, match_status = 'resolved' WHERE id = ?",
    args: [cid, responseId],
  });
}

/** Answers + form id of a single form response. */
export async function getFormResponseById(responseId) {
  return db.execute({
    sql: "SELECT answers, form_id FROM form_responses WHERE id = ?",
    args: [responseId],
  });
}

/** Sync campaign_contact status after a manual response match. */
export async function updateCampaignContactMatchStatus({ status, cid, formId }) {
  return db.execute({
    sql: "UPDATE campaign_contacts SET status = ? WHERE contact_cid = ? AND campaign_id IN (SELECT id FROM campaigns WHERE form_id = ?)",
    args: [status, cid, formId],
  });
}

// ── src/app/api/respond/route.js ────────────────────────────────────────────

/** Legacy forms table: group_name owning a form id (public respond). */
export async function getLegacyFormGroupName(formId) {
  return db.execute({
    sql: "SELECT group_name FROM forms WHERE form_id = ?",
    args: [formId],
  });
}

/** Contact cid matched by email (public respond identity resolution). */
export async function findContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?)",
    args: [email],
  });
}

/** Contact cid matched by phone (public respond identity resolution). */
export async function findContactCidByPhone(phone) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE phone = ?",
    args: [phone],
  });
}

/** Contact cid matched by fuzzy name (public respond identity resolution). */
export async function findContactCidByName(name) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(name) LIKE LOWER(?)",
    args: [`%${name}%`],
  });
}

/** Create the anonymous public-responder contact row. */
export async function createPublicResponseContact({ cid, name, email, phone, groupName }) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, phone, group_name) VALUES (?, ?, ?, ?, ?)",
    args: [cid, name, email, phone, groupName],
  });
}

/** Record a form response from a public (or known) contact. */
export async function createFormResponse({
  formId,
  cid,
  answers,
  publicData,
  confidenceScore,
  matchStatus,
  groupName,
}) {
  return db.execute({
    sql: "INSERT INTO form_responses (form_id, cid, answers, confidence_score, match_status, group_name) VALUES (?, ?, ?, ?, ?, ?)",
    args: [formId, cid, JSON.stringify({ ...answers, ...publicData }), confidenceScore, matchStatus, groupName],
  });
}

/** Sync campaign_contact status after a public response. */
export async function updateCampaignContactResponseStatus({ status, cid, formId }) {
  return db.execute({
    sql: `UPDATE campaign_contacts
              SET status = ?
              WHERE contact_cid = ? AND campaign_id IN (SELECT id FROM campaigns WHERE form_id = ?)`,
    args: [status, cid, formId],
  });
}

// ── src/app/api/knowledge/route.js ──────────────────────────────────────────

/** Insert a knowledge note, returning its generated id. */
export async function createKnowledgeNote({ title, description, url }) {
  return db.execute({
    sql: "INSERT INTO v2_knowledge_bank (title, description, url) VALUES (?, ?, ?) RETURNING id",
    args: [title, description, url],
  });
}

/** Attach a file row to a knowledge note (create path). */
export async function createKnowledgeAttachment(noteId, name, url) {
  return db.execute({
    sql: "INSERT INTO v2_knowledge_attachments (note_id, name, url) VALUES (?, ?, ?)",
    args: [noteId, name, url],
  });
}

/** All knowledge notes, newest first. */
export async function listKnowledgeNotes() {
  return db.execute("SELECT * FROM v2_knowledge_bank ORDER BY created_at DESC");
}

/** All knowledge attachment rows. */
export async function listKnowledgeAttachments() {
  return db.execute("SELECT * FROM v2_knowledge_attachments");
}

/** Archive (or restore) a knowledge note. */
export async function archiveKnowledgeNote(id, is_archived) {
  return db.execute({
    sql: "UPDATE v2_knowledge_bank SET is_archived = ? WHERE id = ?",
    args: [is_archived ? 1 : 0, id],
  });
}

/** Edit a knowledge note's title/description. */
export async function updateKnowledgeNote(id, title, description) {
  return db.execute({
    sql: "UPDATE v2_knowledge_bank SET title = ?, description = ? WHERE id = ?",
    args: [title, description, id],
  });
}

/** Attach a file row to a knowledge note (edit path). */
export async function insertKnowledgeAttachment(noteId, name, url) {
  return db.execute({
    sql: "INSERT INTO v2_knowledge_attachments (note_id, name, url) VALUES (?, ?, ?)",
    args: [noteId, name, url],
  });
}

/** Delete a knowledge note by id. */
export async function deleteKnowledgeNote(id) {
  return db.execute({
    sql: "DELETE FROM v2_knowledge_bank WHERE id = ?",
    args: [id],
  });
}
