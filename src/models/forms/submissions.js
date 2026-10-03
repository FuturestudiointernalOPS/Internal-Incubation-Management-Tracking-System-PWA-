import db from "@/lib/db";

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
