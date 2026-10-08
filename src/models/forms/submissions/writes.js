import db from "@/lib/db";

/**
 * Forms & submissions model — submission writes (REPOSITORY layer).
 *
 * Versioning, creation, review decisions, follow-ups, notifications, team
 * propagation and the score/evaluation writers. Split verbatim out of
 * `models/forms/submissions.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

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
