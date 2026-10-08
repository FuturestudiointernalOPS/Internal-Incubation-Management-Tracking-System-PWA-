import db from "@/lib/db";

/**
 * Org teams store — the `v2_teams` (CRM / organization team) CRUD and the
 * member-linking reads/writes behind `/api/teams`.
 *
 * Split out of `src/models/groups.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/groups` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET / POST / PUT / DELETE /api/teams (CRM / org teams) ───────────────────

/** Org teams (v2_teams + contacts member counts), optionally by team id or program id. */
export async function getOrgTeams(programId, teamId) {
  let sql = `SELECT t.*, (SELECT COUNT(*) FROM contacts WHERE team_id = t.id) AS members_count FROM v2_teams t`;
  let args = [];
  const conditions = [];

  // Team role: restrict to own team
  if (teamId) {
    conditions.push("t.id = ?");
    args.push(teamId);
  } else if (programId && programId !== "all") {
    conditions.push("t.program_id = ?");
    args.push(programId);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY t.name ASC";

  return db.execute({ sql, args });
}

/** Member contact rows of one org team (GET member details). */
export async function getOrgTeamMembers(teamId) {
  return db.execute({
    sql: "SELECT cid, name, email, role, group_name FROM contacts WHERE team_id = ? AND deleted = 0",
    args: [teamId],
  });
}

/** Create an org team record with generated credentials, returning the full row. */
export async function createOrgTeam(
  teamId,
  program_id,
  name,
  handler_id,
  handler_name,
  password,
  team_username,
) {
  return db.execute({
    sql: "INSERT INTO v2_teams (id, program_id, name, handler_id, handler_name, password, team_username) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
    args: [
      teamId,
      program_id,
      name,
      handler_id || null,
      handler_name || null,
      password,
      team_username,
    ],
  });
}

/** Emails of v2_participants being linked to an org team by participant id. */
export async function getOrgTeamParticipantEmails(memberIds) {
  return db.execute({
    sql: `SELECT email FROM v2_participants WHERE id::text IN (${memberIds.map(() => "?").join(",")})`,
    args: memberIds,
  });
}

/** Link contacts to an org team by matching email (POST member linking). */
export async function linkOrgTeamContactsByEmail(teamId, emails) {
  const emailPlaceholders = emails.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET team_id = ? WHERE email IN (${emailPlaceholders})`,
    args: [teamId, ...emails],
  });
}

/** Link contacts to an org team by direct cid match (POST fallback). */
export async function linkOrgTeamContactsByCid(teamId, memberIds) {
  const placeholders = memberIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET team_id = ? WHERE cid IN (${placeholders})`,
    args: [teamId, ...memberIds],
  });
}

/** Update an org team's mutable fields — dynamic SET built by the controller (PUT). */
export async function updateOrgTeam(sets, args) {
  return db.execute({
    sql: `UPDATE v2_teams SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

/** Clear all member links of an org team (PUT re-link step). */
export async function clearOrgTeamMemberLinks(teamId) {
  return db.execute({
    sql: "UPDATE contacts SET team_id = NULL WHERE team_id = ?",
    args: [teamId],
  });
}

/**
 * Re-link contacts to an org team by direct cid match (PUT re-link step).
 * Byte-identical query to linkOrgTeamContactsByCid; extracted separately so
 * each original inline call site maps 1:1 to a model function.
 */
export async function linkOrgTeamContactsByCidOnUpdate(teamId, memberIds) {
  const placeholders = memberIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET team_id = ? WHERE cid IN (${placeholders})`,
    args: [teamId, ...memberIds],
  });
}

/**
 * Clear all member links of an org team before deleting it (DELETE step).
 * Byte-identical query to clearOrgTeamMemberLinks; extracted separately so
 * each original inline call site maps 1:1 to a model function.
 */
export async function clearOrgTeamMemberLinksOnDelete(teamId) {
  return db.execute({
    sql: "UPDATE contacts SET team_id = NULL WHERE team_id = ?",
    args: [teamId],
  });
}

/** Delete an org team by id (DELETE /api/teams). */
export async function deleteOrgTeam(id) {
  return db.execute({
    sql: "DELETE FROM v2_teams WHERE id = ?",
    args: [id],
  });
}
