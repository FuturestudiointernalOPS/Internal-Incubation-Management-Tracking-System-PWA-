import db from "@/lib/db";

/**
 * Participant assignments model — data access for GET/POST /api/participant/assignments
 */

export async function ensureSubmissionParticipantProgramIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_participant_program ON v2_submissions(participant_id, program_id)");
}

export async function ensureSubmissionDeliverableIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_deliverable ON v2_submissions(deliverable_id)");
}

export async function getAssignmentsContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, email, program_id, group_name, v2_team_id, team_id FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

export async function getAssignmentsProgramById(programId) {
  return db.execute({
    sql: "SELECT id, name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

export async function getAssignmentsDeliverablesByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

export async function getAssignmentsSubmissionsByProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

export async function getExistingSubmission(participantId, deliverableId) {
  return db.execute({
    sql: "SELECT id, file_url, version FROM v2_submissions WHERE participant_id = ? AND deliverable_id = ?",
    args: [participantId, deliverableId],
  });
}

export async function archiveSubmissionVersion(submissionId, participantId, deliverableId, fileUrl, version) {
  return db.execute({
    sql: "INSERT INTO v2_submission_versions (submission_id, participant_id, deliverable_id, file_url, version) VALUES (?, ?, ?, ?, ?)",
    args: [submissionId, participantId, deliverableId, fileUrl, version],
  });
}

export async function updateSubmissionVersion(fileUrl, submissionId) {
  return db.execute({
    sql: "UPDATE v2_submissions SET file_url = ?, status = 'pending', version = COALESCE(version, 1) + 1, updated_at = NOW() WHERE id = ?",
    args: [fileUrl, submissionId],
  });
}

export async function insertSubmission(participantId, programId, deliverableId, fileUrl) {
  return db.execute({
    sql: "INSERT INTO v2_submissions (participant_id, program_id, deliverable_id, file_url, status, version) VALUES (?, ?, ?, ?, 'pending', 1)",
    args: [participantId, programId, deliverableId, fileUrl],
  });
}