import db from "@/lib/db";

/**
 * Legacy participant portal full-state model — data access for GET /api/participant/full-state
 */

export async function getFullStateContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE email = ?",
    args: [email],
  });
}

export async function getFullStateProgramByName(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE name = ?",
    args: [groupName],
  });
}

export async function getFullStateSubmissionsByParticipant(cid) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ?",
    args: [cid],
  });
}

export async function getFullStateSessionsByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id = ?",
    args: [groupName],
  });
}

export async function getFullStateNotificationsByRecipient(email) {
  return db.execute({
    sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC",
    args: [email],
  });
}

export async function getFullStateKpisByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
    args: [groupName],
  });
}

export async function getFullStateDocumentsByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
    args: [groupName],
  });
}

export async function getFullStateFollowupsByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 3",
    args: [groupName],
  });
}

export async function getFullStateTeamByGroupName(groupName) {
  return db.execute({
    sql: "SELECT t.* FROM v2_teams t JOIN contacts c ON c.cid = t.handler_id WHERE UPPER(TRIM(c.group_name)) = UPPER(TRIM(?)) LIMIT 1",
    args: [groupName],
  });
}

export async function getFullStateFamilyByName(groupName) {
  return db.execute({
    sql: "SELECT * FROM families WHERE name = ?",
    args: [groupName],
  });
}