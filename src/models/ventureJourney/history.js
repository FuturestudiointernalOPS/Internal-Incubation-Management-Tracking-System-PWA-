import db from "@/lib/db";

/**
 * Venture Journey model — venture history (REPOSITORY layer).
 *
 * The venture/previous-program/founder-history reads behind
 * `/api/ventures/[id]/history`. Split verbatim out of
 * `models/ventureJourney.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Venture record (by VNT code) for the history endpoint. */
export async function getVentureForHistory(ventureId) {
  return db.execute({
    sql: `SELECT * FROM ventures WHERE venture_id = ?`,
    args: [ventureId],
  });
}

/** Program header row for a venture's previous-program block. */
export async function getProgramById(programId) {
  return db.execute({
    sql: `SELECT id, name, start_date, end_date, deliverables FROM v2_programs WHERE id = ?`,
    args: [programId],
  });
}

/** All founders (incl. removed) of a venture, most recently joined first. */
export async function getVentureFounderHistory(ventureId) {
  return db.execute({
    sql: `
        SELECT vm.contact_id, vm.role, vm.joined_at, vm.removed_at, c.name as contact_name
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.member_type = 'founder'
        ORDER BY vm.joined_at DESC
      `,
    args: [ventureId],
  });
}

/** A founder's prior program enrollments, excluding the given program. */
export async function getFounderProgramHistory(participantId, programId) {
  return db.execute({
    sql: `
              SELECT pp.*, vp.name as program_name
              FROM participant_programs pp
              LEFT JOIN v2_programs vp ON CAST(pp.program_id AS TEXT) = CAST(vp.id AS TEXT)
              WHERE pp.participant_id = ? AND CAST(pp.program_id AS TEXT) != CAST(? AS TEXT)
              ORDER BY pp.enrolled_at DESC
            `,
    args: [participantId, programId],
  });
}
