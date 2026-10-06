import db from "@/lib/db";

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
