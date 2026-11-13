import db from "@/lib/db";

/**
 * Member dashboard model — data access for the ONE personal dashboard.
 *
 * The unified member dashboard (`/dashboard`) composes blocks that already have
 * their own repository (participation, ventures, learning, investor). Only the
 * facilitation block needed a NEW statement: "which programs does this person
 * actually facilitate?". It lives here, in the model layer, so the service that
 * assembles the dashboard still runs no SQL.
 *
 * The `v2_program_staff` table is the same source the facilitator area's own
 * guard reads (`hasAnyFacilitatorAssignment`), so the dashboard cannot claim a
 * facilitation the area would refuse. `staff_id` holds a cid for recent rows
 * and an email for legacy ones, hence the two matches — the same fallback the
 * rest of the authorization layer uses.
 */
export async function listFacilitatedPrograms(cid, email = null) {
  if (!cid) return { rows: [] };

  const hasEmail = !!(email && String(email).trim());
  const sql = hasEmail
    ? `SELECT DISTINCT CAST(p.id AS TEXT) AS id, p.name, p.status
         FROM v2_programs p
         JOIN v2_program_staff s ON CAST(s.program_id AS TEXT) = CAST(p.id AS TEXT)
        WHERE s.role = 'facilitator'
          AND (s.staff_id = ? OR LOWER(TRIM(s.staff_id)) = LOWER(?))
        ORDER BY p.name ASC`
    : `SELECT DISTINCT CAST(p.id AS TEXT) AS id, p.name, p.status
         FROM v2_programs p
         JOIN v2_program_staff s ON CAST(s.program_id AS TEXT) = CAST(p.id AS TEXT)
        WHERE s.role = 'facilitator' AND s.staff_id = ?
        ORDER BY p.name ASC`;

  return db.execute({
    sql,
    args: hasEmail ? [cid, String(email).trim()] : [cid],
  });
}

/**
 * The next sessions of the programs a facilitator animates.
 *
 * The participant home already merges the sessions of the programs the person
 * ATTENDS; a facilitator who attends none of them would otherwise see no
 * session at all on their dashboard. The ids passed here are the ones
 * `listFacilitatedPrograms` just resolved, so this read can never widen the
 * audience of a program the person does not facilitate.
 */
export async function listUpcomingSessionsForPrograms(programIds = [], limit = 6) {
  const ids = (programIds || []).map((id) => String(id)).filter(Boolean);
  if (ids.length === 0) return { rows: [] };

  const placeholders = ids.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT CAST(s.id AS TEXT) AS id,
                 s.title,
                 COALESCE(s.start_at, s.scheduled_date) AS date,
                 s.start_time,
                 s.week_number,
                 CAST(s.program_id AS TEXT) AS program_id,
                 p.name AS program_name
            FROM v2_sessions s
            LEFT JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(s.program_id AS TEXT)
           WHERE CAST(s.program_id AS TEXT) IN (${placeholders})
             AND COALESCE(s.start_at, s.scheduled_date) >= CURRENT_DATE
           ORDER BY COALESCE(s.start_at, s.scheduled_date) ASC
           LIMIT ${Number(limit) || 6}`,
    args: ids,
  });
}
