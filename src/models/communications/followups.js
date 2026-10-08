import db from "@/lib/db";

/**
 * Communications — follow-up reads and writes (REPOSITORY layer).
 *
 * Split verbatim out of `models/communications.js` — see docs/LAYER_SPLIT.md.
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Safe migration: ensure v2_followups.created_by exists. */
export async function ensureFollowupsCreatedByColumn() {
  return db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS created_by TEXT");
}

/**
 * GET /api/followups — follow-up rows with participant/deliverable names,
 * filtered by query params and the requester's visibility role.
 */
export async function listFollowups({
  programId,
  participantId,
  submissionId,
  status,
  session,
}) {
  let sql = `
      SELECT f.*, c.name as participant_name, d.title as deliverable_title
      FROM v2_followups f
      LEFT JOIN contacts c ON f.participant_id::text = c.cid
      LEFT JOIN v2_submissions s ON f.submission_id = s.id
      LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id
      WHERE 1=1
    `;
  const args = [];

  if (programId) {
    sql += " AND f.program_id = ?";
    args.push(programId);
  }
  if (participantId) {
    sql += " AND f.participant_id = ?";
    args.push(participantId);
  }
  if (submissionId) {
    sql += " AND f.submission_id = ?";
    args.push(submissionId);
  }
  if (status) {
    sql += " AND f.status = ?";
    args.push(status);
  }

  // Visibility: super_admin sees all; participants see their own; everyone
  // else sees follow-ups they assigned. Legacy rows (created_by NULL) remain
  // visible to non-participant staff so historical data is not lost.
  if (session?.role === "participant") {
    sql += " AND f.participant_id = ?";
    args.push(session.cid);
  } else if (session?.role !== "super_admin") {
    sql += " AND (f.created_by IS NULL OR f.created_by = ?)";
    args.push(session.cid);
  }

  sql += " ORDER BY f.scheduled_at DESC";

  return db.execute({ sql, args });
}

/**
 * Check whether a participant belongs to one of the facilitator's teams
 * (POST follow-up scope guard).
 */
export async function isContactInFacilitatorTeams(participantId, teamIds) {
  return db.execute({
    sql: "SELECT 1 FROM contacts c WHERE c.cid = ? AND c.v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")",
    args: [String(participantId), ...teamIds],
  });
}

/** Create a follow-up record and return the full row. */
export async function insertFollowup({
  programId,
  participantId,
  submissionId,
  weekNumber,
  comment,
  scheduledAt,
  durationMinutes,
  meetingLink,
  notes,
  createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO v2_followups (
          program_id, participant_id, submission_id, week_number,
          comment, scheduled_at, duration_minutes, meeting_link, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?) RETURNING *`,
    args: [
      programId,
      participantId || null,
      submissionId || null,
      weekNumber || null,
      comment || null,
      scheduledAt,
      durationMinutes || 30,
      meetingLink || null,
      notes || null,
      createdBy || null,
    ],
  });
}

/** Mirror a follow-up as a calendar event in v2_events (non-blocking). */
export async function insertFollowupCalendarEvent({
  programId,
  title,
  description,
  startTime,
  endTime,
  participantId,
  createdBy,
}) {
  return db.execute({
    sql: `INSERT INTO v2_events (program_id, title, description, event_type, start_time, end_time, participant_id, created_by)
              VALUES (?, ?, ?, 'followup', ?, ?, ?, ?)`,
    args: [
      programId,
      title,
      description,
      startTime,
      endTime,
      participantId || null,
      createdBy || "staff",
    ],
  });
}

/** Flag a linked submission as pending follow-up. */
export async function markSubmissionPendingFollowup(submissionId) {
  return db.execute({
    sql: "UPDATE v2_submissions SET status = 'pending_followup', updated_at = NOW() WHERE id = ?",
    args: [submissionId],
  });
}

/** Follow-up program/participant for scope checks (PATCH path). */
export async function getFollowupById(id) {
  return db.execute({
    sql: "SELECT program_id, participant_id FROM v2_followups WHERE id = ?",
    args: [id],
  });
}

/**
 * Check whether a participant belongs to one of the facilitator's teams
 * (PATCH follow-up scope guard).
 */
export async function isContactInFacilitatorTeamsForUpdate(participantId, teamIds) {
  return db.execute({
    sql: "SELECT 1 FROM contacts c WHERE c.cid = ? AND c.v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")",
    args: [String(participantId), ...teamIds],
  });
}

/** Update a follow-up's editable fields (COALESCE per provided field). */
export async function updateFollowup({
  id,
  status,
  notes,
  meetingLink,
  scheduledAt,
}) {
  return db.execute({
    sql: `UPDATE v2_followups SET
              status = COALESCE(?, status),
              notes = COALESCE(?, notes),
              meeting_link = COALESCE(?, meeting_link),
              scheduled_at = COALESCE(?, scheduled_at)
            WHERE id = ?`,
    args: [
      status || null,
      notes || null,
      meetingLink || null,
      scheduledAt || null,
      id,
    ],
  });
}
