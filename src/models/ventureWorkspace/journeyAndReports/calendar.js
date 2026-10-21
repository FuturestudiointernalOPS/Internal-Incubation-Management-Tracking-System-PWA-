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

/**
 * The Venture-facing sessions still ahead of `fromIso`, soonest first.
 *
 * `venture_facing` is the same audience filter the founder calendar uses: an
 * internal staff session is not the Venture's appointment and is never offered
 * to it. Cancelled sessions are excluded — a cancelled meeting is not a
 * commitment.
 */
export function listUpcomingVentureFacingSessions(id, dbId, fromIso, limit = 5) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
  return db.execute({
    sql: `SELECT id, title, session_type, status, location, meeting_link,
                 milestone_ref, journey_stage_id::text AS journey_stage_id,
                 to_char(start_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_time,
                 to_char(end_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS end_time
          FROM venture_sessions
          WHERE venture_facing = TRUE
            AND start_time IS NOT NULL
            AND COALESCE(LOWER(status), '') <> 'cancelled'
            AND start_time >= ?::timestamptz
            AND (venture_id = ? OR venture_id = ?)
          ORDER BY start_time ASC
          LIMIT ?`,
    args: [fromIso, id, dbId, safeLimit],
  });
}
