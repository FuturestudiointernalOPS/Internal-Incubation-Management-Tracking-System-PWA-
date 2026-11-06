import db from "@/lib/db";

// ── Investor meeting slots + confirmed meetings ─────────────────────────────

export async function insertMeetingSlot({
  workspaceId,
  proposedBy,
  proposedByType = "investor",
  startAt,
  durationMinutes = 30,
  timezone = null,
}) {
  return db.execute({
    sql: `INSERT INTO investor_meeting_slots
            (workspace_id, proposed_by, proposed_by_type, start_at, duration_minutes, proposer_timezone, status)
          VALUES (?, ?, ?, ?, ?, ?, 'proposed') RETURNING *`,
    args: [workspaceId, proposedBy, proposedByType, startAt, durationMinutes, timezone],
  });
}

export async function insertMeetingSlots({ workspaceId, proposedBy, proposedByType, slots, timezone }) {
  if (!Array.isArray(slots) || slots.length === 0) return { rows: [] };
  const valueSql = slots.map(() => "(?::uuid, ?::text, ?::text, ?::timestamptz, ?::integer, ?::text)").join(", ");
  const slotArgs = slots.flatMap((slot) => [
    workspaceId,
    proposedBy,
    proposedByType,
    slot.startAt,
    slot.durationMinutes,
    timezone,
  ]);
  return db.execute({
    sql: `WITH locked_workspace AS (
            SELECT id FROM relationship_workspaces WHERE id = ? FOR UPDATE
          )
          INSERT INTO investor_meeting_slots
            (workspace_id, proposed_by, proposed_by_type, start_at, duration_minutes, proposer_timezone, status)
          SELECT proposed.workspace_id, proposed.proposed_by, proposed.proposed_by_type,
                 proposed.start_at, proposed.duration_minutes, proposed.proposer_timezone, 'proposed'
            FROM (VALUES ${valueSql}) AS proposed(
              workspace_id, proposed_by, proposed_by_type, start_at, duration_minutes, proposer_timezone
            )
            CROSS JOIN locked_workspace
           WHERE proposed.workspace_id = locked_workspace.id
             AND (SELECT COUNT(*) FROM investor_meeting_slots
                   WHERE workspace_id = locked_workspace.id AND status = 'proposed') + ? <= 3
          RETURNING *`,
    args: [workspaceId, ...slotArgs, slots.length],
  });
}

export async function listSlotsForWorkspace(workspaceId) {
  return db.execute({
    sql: "SELECT * FROM investor_meeting_slots WHERE workspace_id = ? ORDER BY start_at ASC",
    args: [workspaceId],
  });
}

export async function getSlotById(id) {
  return db.execute({ sql: "SELECT * FROM investor_meeting_slots WHERE id = ?", args: [id] });
}

export async function getMeetingById(meetingId) {
  return db.execute({
    sql: "SELECT * FROM relationship_meetings WHERE id = ?",
    args: [meetingId],
  });
}

export async function acceptSlot(id) {
  return db.execute({
    sql: `UPDATE investor_meeting_slots
             SET status = 'accepted', responded_at = NOW()
           WHERE id = ? AND status = 'proposed'
           RETURNING *`,
    args: [id],
  });
}

export async function expireOtherSlots({ workspaceId, keepId }) {
  return db.execute({
    sql: `UPDATE investor_meeting_slots SET status = 'expired', responded_at = NOW()
           WHERE workspace_id = ? AND id <> ? AND status = 'proposed'`,
    args: [workspaceId, keepId],
  });
}

/** Insert the confirmed meeting. Legacy scheduled_date/time are filled too. */
export async function insertConfirmedMeeting({
  workspaceId,
  startAt,
  durationMinutes = 30,
  videoLink = null,
  timezone = null,
  meetingType = "introductory",
  location = "video",
}) {
  const dt = new Date(startAt);
  const dateStr = dt.toISOString().slice(0, 10);
  const timeStr = dt.toISOString().slice(11, 19);
  return db.execute({
    sql: `INSERT INTO relationship_meetings
            (workspace_id, meeting_type, scheduled_date, scheduled_time, start_at,
             duration_minutes, video_link, timezone, location, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
          RETURNING *`,
    args: [workspaceId, meetingType, dateStr, timeStr, startAt, durationMinutes, videoLink, timezone, location],
  });
}

export async function updateMeetingSchedule({ meetingId, startAt, durationMinutes = null, timezone = null }) {
  const dt = new Date(startAt);
  return db.execute({
    sql: `UPDATE relationship_meetings
             SET start_at = ?, scheduled_date = ?, scheduled_time = ?,
                 duration_minutes = COALESCE(?, duration_minutes),
                 timezone = COALESCE(?, timezone),
                 reminder_24h_sent_at = NULL, reminder_6h_sent_at = NULL,
                 reminder_1h_sent_at = NULL, updated_at = NOW()
           WHERE id = ? AND status IN ('confirmed', 'scheduled') RETURNING *`,
    args: [startAt, dt.toISOString().slice(0, 10), dt.toISOString().slice(11, 19), durationMinutes, timezone, meetingId],
  });
}

export async function updateMeetingStatus({ meetingId, status }) {
  return db.execute({
    sql: `UPDATE relationship_meetings SET status = ?, updated_at = NOW()
           WHERE id = ? AND status IN ('confirmed', 'scheduled') RETURNING *`,
    args: [status, meetingId],
  });
}

export async function updateMeetingOutcome({ meetingId, status, outcomeCode = null, note = null, actionItems = null }) {
  return db.execute({
    sql: `UPDATE relationship_meetings
               SET status = ?, outcome_code = ?, outcome = COALESCE(?, outcome),
                   action_items = COALESCE(?, action_items), updated_at = NOW()
             WHERE id = ? AND status IN ('confirmed', 'scheduled') RETURNING *`,
    args: [status, outcomeCode, note, actionItems, meetingId],
  });
}

export async function listInvestorMeetingFeedback({ investorProfileId, meetingIds }) {
  if (!investorProfileId || meetingIds.length === 0) return { rows: [] };
  const placeholders = meetingIds.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT meeting_id, interest, note
              FROM investor_meeting_feedback
             WHERE investor_profile_id = ? AND meeting_id IN (${placeholders})`,
    args: [investorProfileId, ...meetingIds],
  });
}

export async function upsertInvestorMeetingFeedback({ meetingId, investorProfileId, interest, note }) {
  return db.execute({
    sql: `INSERT INTO investor_meeting_feedback (meeting_id, investor_profile_id, interest, note)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (meeting_id, investor_profile_id)
          DO UPDATE SET interest = EXCLUDED.interest, note = EXCLUDED.note, updated_at = NOW()
          RETURNING meeting_id, interest, note`,
    args: [meetingId, investorProfileId, interest, note],
  });
}

export async function markConfirmationEmailSent(meetingId) {
  return db.execute({
    sql: "UPDATE relationship_meetings SET confirmation_email_sent_at = NOW() WHERE id = ?",
    args: [meetingId],
  });
}

export async function markReminderSent({ meetingId, which }) {
  const column =
    which === "24h"
      ? "reminder_24h_sent_at"
      : which === "1h"
        ? "reminder_1h_sent_at"
        : which === "6h"
          ? "reminder_6h_sent_at"
          : "reminder_daily_sent_at";
  return db.execute({
    sql: `UPDATE relationship_meetings SET ${column} = NOW() WHERE id = ?`,
    args: [meetingId],
  });
}

export async function claimMeetingReminder({ meetingId, which }) {
  const column = reminderColumn(which);
  return db.execute({
    sql: `UPDATE relationship_meetings
             SET ${column} = NOW()
           WHERE id = ? AND status = 'confirmed' AND ${column} IS NULL
           RETURNING id`,
    args: [meetingId],
  });
}

export async function releaseMeetingReminderClaim({ meetingId, which }) {
  const column = reminderColumn(which);
  return db.execute({
    sql: `UPDATE relationship_meetings
             SET ${column} = NULL
           WHERE id = ? AND status = 'confirmed'`,
    args: [meetingId],
  });
}

function reminderColumn(which) {
  const columns = {
    "24h": "reminder_24h_sent_at",
    "6h": "reminder_6h_sent_at",
    "1h": "reminder_1h_sent_at",
  };
  const column = columns[which];
  if (!column) throw new Error(`Unknown meeting reminder window: ${which}`);
  return column;
}

export async function listMeetingsDueIn24h() {
  return db.execute({
    sql: `SELECT * FROM relationship_meetings
           WHERE status = 'confirmed' AND start_at > NOW() + INTERVAL '23 hours'
             AND start_at <= NOW() + INTERVAL '24 hours' AND reminder_24h_sent_at IS NULL`,
    args: [],
  });
}

export async function listMeetingsDueIn1h() {
  return db.execute({
    sql: `SELECT * FROM relationship_meetings
           WHERE status = 'confirmed' AND start_at > NOW() + INTERVAL '30 minutes'
             AND start_at <= NOW() + INTERVAL '1 hour' AND reminder_1h_sent_at IS NULL`,
    args: [],
  });
}

/** The 6-hour-before sweep: any confirmed meeting starting within the next
 *  six hours that has not yet been reminded. */
export async function listMeetingsDueIn6h() {
  return db.execute({
    sql: `SELECT * FROM relationship_meetings
           WHERE status = 'confirmed'
             AND start_at > NOW()
             AND start_at <= NOW() + INTERVAL '6 hours'
             AND reminder_6h_sent_at IS NULL`,
    args: [],
  });
}

/** The daily sweep: confirmed meetings later today not yet reminded. */
export async function listMeetingsDueToday() {
  return db.execute({
    sql: `SELECT * FROM relationship_meetings
           WHERE status = 'confirmed'
             AND start_at::date = CURRENT_DATE
             AND start_at > NOW()
             AND reminder_daily_sent_at IS NULL
           ORDER BY start_at ASC`,
    args: [],
  });
}

// ── Phase 6 — meeting scope (investor / founder / studio) ────────────────────

export async function listWorkspacesByInvestor(investorId) {
  return db.execute({
    sql: `SELECT rw.*, v.name AS venture_name
            FROM relationship_workspaces rw
            LEFT JOIN ventures v ON v.id::text = rw.venture_id::text
           WHERE rw.investor_id = ?`,
    args: [investorId],
  });
}

export async function listWorkspacesByVentureIds(ventureIds) {
  const list = (ventureIds || []).map(String).filter(Boolean);
  if (list.length === 0) return { rows: [] };
  const placeholders = list.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT rw.*, v.name AS venture_name
            FROM relationship_workspaces rw
            LEFT JOIN ventures v ON v.id::text = rw.venture_id::text
           WHERE CAST(rw.venture_id AS TEXT) IN (${placeholders})`,
    args: list,
  });
}
