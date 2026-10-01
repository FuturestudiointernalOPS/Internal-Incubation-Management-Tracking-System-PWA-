// =============================================================================
// Objective (KPI) progress — statements (REPOSITORY layer)
//
// Every read/write the objective-progress calculation needs. The rate itself is
// computed in `@/services/programs/kpiProgress`.
//
// SQL is byte-identical to what used to sit inline in `models/kpi-progress.js`.
//
// Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
// no decisions.
// =============================================================================
import db from "@/lib/db";

/**
 * The names of the KPIs belonging to the given programs.
 *
 * One query for as many programs as are asked about, so a screen that has to name
 * the KPIs cited by a list of reports does not ask once per program - and, being a
 * plain catalogue read, it never triggers the recalculation that the per-program
 * progress read performs when it finds no cached row.
 */
export async function listKpiNamesForPrograms(programIds) {
  const programIdsList = [
    ...new Set(
      (programIds || [])
        .filter((id) => id !== null && id !== undefined)
        .map((id) => String(id)),
    ),
  ];
  if (programIdsList.length === 0) return { rows: [] };

  const placeholders = programIdsList.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT id, title, program_id FROM v2_kpis
          WHERE program_id::text IN (${placeholders})`,
    args: programIdsList,
  });
}

/** Every objective of a programme. */
export function listKpisForProgram(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

/**
 * The active participant base of a programme — canonical source:
 * participant_programs membership + active contacts, matching /api/participants
 * and the PM full-state. v2_participants is intake/history only and may be empty
 * or hold duplicates, which made the rate collapse to 0 / inflate wrongly.
 */
export function countActiveParticipants(programId) {
  return db.execute({
    sql: `SELECT COUNT(*) AS count
            FROM participant_programs pp
            JOIN contacts c ON pp.participant_id = c.cid
            WHERE CAST(pp.program_id AS TEXT) = ?
              AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
              AND LOWER(COALESCE(c.status, '')) = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM v2_program_staff ps
                WHERE CAST(ps.program_id AS TEXT) = ?
                  AND ps.role = 'facilitator'
                  AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
              )`,
    args: [String(programId), String(programId)],
  });
}

/** Every deliverable (document requirement) of a programme. */
export function listDocumentRequirements(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ?",
    args: [programId],
  });
}

/**
 * Approved submissions of a programme (optionally narrowed to one participant).
 *
 * A submission may store the requirement id in EITHER deliverable_id or
 * document_id (the participant form writes both; older flows wrote only one), so
 * both columns are returned and the caller reduces each row to a single
 * deliverable reference before counting — otherwise one approval could be
 * counted twice.
 */
export function listApprovedSubmissions(programId, participantId) {
  let sql = `SELECT s.participant_id, s.deliverable_id, s.document_id
      FROM v2_submissions s
      WHERE s.program_id::text = ? AND s.status = 'approved'`;
  const args = [programId];
  if (participantId) {
    sql += ` AND s.participant_id::text = ?`;
    args.push(participantId);
  }
  return db.execute({ sql, args });
}

/** Clear a programme's cached progress (before a wholesale rewrite). */
export function clearKpiProgressCache(programId) {
  return db.execute({
    sql: "DELETE FROM kpi_progress WHERE program_id = ?",
    args: [String(programId)],
  });
}

/**
 * Write the computed rows wholesale. Rows are written exactly as computed — no
 * "never downgrade to zero" guard: a rate that truly falls must be able to fall.
 */
export function insertKpiProgressRows(programId, entries) {
  const cacheArgs = [];
  const values = entries.map((entry) => {
    cacheArgs.push(
      String(programId),
      String(entry.kpi_id),
      entry.title.substring(0, 255),
      entry.completion_rate,
      entry.participant_count,
      entry.approved_count,
    );
    return "(?, ?, ?, ?, ?, ?, NOW())";
  });

  return db.execute({
    sql: `INSERT INTO kpi_progress (program_id, kpi_id, kpi_name, completion_rate, participant_count, approved_count, calculated_at)
                  VALUES ${values.join(", ")}
                  ON CONFLICT (program_id, kpi_id) DO UPDATE SET
                  kpi_name = EXCLUDED.kpi_name,
                  completion_rate = EXCLUDED.completion_rate,
                  participant_count = EXCLUDED.participant_count,
                  approved_count = EXCLUDED.approved_count,
                  calculated_at = NOW()`,
    args: cacheArgs,
  });
}

/** When a programme's progress was last calculated (or null). */
export function getLastKpiCalculatedAt(programId) {
  return db.execute({
    sql: "SELECT MAX(calculated_at) AS last FROM kpi_progress WHERE program_id = ?",
    args: [String(programId)],
  });
}
