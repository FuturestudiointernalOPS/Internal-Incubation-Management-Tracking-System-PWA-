import db from "@/lib/db";

/**
 * Participant timeline & certificates model
 */

export async function getParticipantTimeline(cid, limit) {
  return db.execute({
    sql: `SELECT id, event_type, description, context_module, context_id, created_at
            FROM contact_timeline
            WHERE contact_cid = ?
              AND (context_module IS NULL OR context_module != 'crm')
            ORDER BY created_at DESC
            LIMIT ?`,
    args: [cid, limit],
  });
}

export async function getParticipantCertificates(cid) {
  return db.execute({
    sql: `SELECT CAST(pp.program_id AS TEXT) AS program_id,
                   p.name AS program_name,
                   pp.certificate_issued,
                   pp.completed_at,
                   pp.accepted_at
            FROM participant_programs pp
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
            WHERE pp.participant_id = ? AND pp.certificate_issued = true
            ORDER BY p.name ASC`,
    args: [cid],
  });
}