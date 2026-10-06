import db from "@/lib/db";

/**
 * Participant submissions model — data access for GET/POST /api/participant/submissions
 */

export async function getSubmissionsByParticipantOrTeam(teamId, participantId, programId) {
  let query =
    "SELECT *, document_id AS requirement_id FROM v2_submissions WHERE ";
  let args = [];

  if (teamId) {
    query += "team_id = ?";
    args.push(teamId);
  } else {
    query += "participant_id = ?";
    args.push(participantId);
  }

  if (programId) {
    query += " AND program_id = ?";
    args.push(programId);
  }

  return db.execute({ sql: query, args });
}

export async function getSubmissionProgramCompletionStatus(participantCid, programId) {
  return db.execute({
    sql: `SELECT COALESCE(pp.status, p.status) AS status
              FROM v2_programs p
              LEFT JOIN participant_programs pp
                ON pp.program_id::text = p.id::text AND pp.participant_id = ?
              WHERE p.id::text = ?
              LIMIT 1`,
    args: [String(participantCid), String(programId)],
  });
}

export async function insertParticipantSubmission(participantId, teamId, programId, requirementId, fileUrl) {
  return db.execute({
    sql: "INSERT INTO v2_submissions (participant_id, team_id, program_id, deliverable_id, file_url, status) VALUES (?, ?, ?, ?, ?, 'pending')",
    args: [
      participantId || null,
      teamId || null,
      programId,
      requirementId,
      fileUrl || null,
    ],
  });
}