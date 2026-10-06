import db from "@/lib/db";

/**
 * Participant followups model — data access for GET /api/participant/followups
 */

export async function getFollowupEventsByParticipant(cid) {
  return db.execute({
    sql: `SELECT e.id, e.title, e.description, e.start_time, e.end_time,
                 e.event_type, e.location as meeting_link, e.created_by, e.program_id,
                 p.name as program_name
           FROM v2_events e
           LEFT JOIN v2_programs p ON e.program_id::text = p.id::text
           WHERE e.event_type = 'followup'
             AND e.participant_id = ?
           ORDER BY e.start_time DESC`,
    args: [cid],
  });
}

export async function getFollowupTableRowsByParticipant(cid) {
  return db.execute({
    sql: `SELECT f.id as fu_id, f.comment, f.scheduled_at, f.duration_minutes, 
                   f.meeting_link, f.notes, f.status as fu_status,
                   p.name as program_name
           FROM v2_followups f
           LEFT JOIN v2_programs p ON f.program_id::text = p.id::text
           LEFT JOIN v2_submissions s ON f.submission_id::text = s.id::text
           WHERE s.participant_id = ?
           ORDER BY f.scheduled_at DESC`,
    args: [cid],
  });
}