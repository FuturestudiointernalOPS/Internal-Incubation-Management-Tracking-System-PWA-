import db from "@/lib/db";

/**
 * Teams model — data access for the program-teams controller
 * (`src/app/api/pm/teams/route.js`).
 *
 * Each function wraps exactly one SQL statement that used to live inline in the
 * controller (GET list, POST create + member linking + credentials emails,
 * PATCH handler/member/venture-ready updates, DELETE). SQL is byte-identical to
 * the original queries, so behavior is unchanged. Statements the controller
 * runs in both its POST (team creation) and PATCH (member update) flows are
 * mirrored 1:1 here — one exported function per former call site.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

/** All teams, optionally narrowed to one program (v2_programs id). */
export async function getTeams(programId) {
  let sql = "SELECT * FROM v2_teams";
  let args = [];

  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }

  return db.execute({ sql, args });
}

/** Create a team record (name = sub-team, group_name = parent group, approved by default). */
export async function createTeam(team) {
  const {
    id,
    program_id,
    name,
    handler_id,
    handler_name,
    password,
    team_username,
    group_name,
    leader_id,
  } = team;
  return db.execute({
    sql: "INSERT INTO v2_teams (id, program_id, name, handler_id, handler_name, password, team_username, group_name, leader_id, is_venture_ready) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true) RETURNING *",
    args: [
      id,
      program_id,
      name,
      handler_id || null,
      handler_name || null,
      password,
      team_username,
      group_name || null,
      leader_id || null,
    ],
  });
}

/** Assign UUID-based participants (v2_participants) to the newly created team. */
export async function linkParticipantsToNewTeam(teamId, participantIds) {
  const placeholders = participantIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE v2_participants SET v2_team_id = ? WHERE id IN (${placeholders})`,
    args: [teamId, ...participantIds],
  });
}

/** Assign contact-based participants (contacts table) to the newly created team. */
export async function linkContactsToNewTeam(teamId, contactIds) {
  const placeholders = contactIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET v2_team_id = ? WHERE cid IN (${placeholders})`,
    args: [teamId, ...contactIds],
  });
}

/** email/name rows for v2_participants just linked (POST shared-credentials email). */
export async function getNewTeamParticipantMembers(participantIds) {
  const placeholders = participantIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT email, name FROM v2_participants WHERE id IN (${placeholders})`,
    args: [...participantIds],
  });
}

/** email/name rows for contacts just linked (POST shared-credentials email). */
export async function getNewTeamContactMembers(contactIds) {
  const placeholders = contactIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT email, name FROM contacts WHERE cid IN (${placeholders})`,
    args: [...contactIds],
  });
}

/** Reassign the team's facilitator/oversight handler. */
export async function updateTeamHandler(team_id, handler_id, handler_name) {
  return db.execute({
    sql: "UPDATE v2_teams SET handler_id = ?, handler_name = ? WHERE id = ?",
    args: [handler_id || null, handler_name || null, team_id],
  });
}

/** Unassign a UUID-based participant (v2_participants) from their team. */
export async function removeParticipantFromTeam(member_id, team_id) {
  return db.execute({
    sql: "UPDATE v2_participants SET v2_team_id = NULL WHERE id = ? AND v2_team_id = ?",
    args: [String(member_id), team_id],
  });
}

/** Unassign a contact-based participant (contacts table) from their team. */
export async function removeContactFromTeam(member_id, team_id) {
  return db.execute({
    sql: "UPDATE contacts SET v2_team_id = NULL WHERE cid = ? AND v2_team_id = ?",
    args: [String(member_id), team_id],
  });
}

/** Flip a team's venture-ready flag (venture approval workflow). */
export async function setTeamVentureReady(team_id, is_venture_ready) {
  return db.execute({
    sql: "UPDATE v2_teams SET is_venture_ready = ? WHERE id::text = ?",
    args: [is_venture_ready ? 1 : 0, team_id],
  });
}

/** Full team row by id (PATCH member-update path / 404 gate). */
export async function getTeamById(team_id) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE id = ?",
    args: [team_id],
  });
}

/** Assign UUID-based participants (v2_participants) to an existing team (PATCH flow). */
export async function linkParticipantsToTeam(teamId, participantIds) {
  const placeholders = participantIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE v2_participants SET v2_team_id = ? WHERE id IN (${placeholders})`,
    args: [teamId, ...participantIds],
  });
}

/** Assign contact-based participants (contacts table) to an existing team (PATCH flow). */
export async function linkContactsToTeam(teamId, contactIds) {
  const placeholders = contactIds.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE contacts SET v2_team_id = ? WHERE cid IN (${placeholders})`,
    args: [teamId, ...contactIds],
  });
}

/** email/name rows for v2_participants just added (PATCH assignment email). */
export async function getTeamParticipantMembers(participantIds) {
  return db.execute({
    sql: `SELECT email, name FROM v2_participants WHERE id IN (${participantIds.map(() => "?").join(",")})`,
    args: [...participantIds],
  });
}

/** email/name rows for contacts just added (PATCH assignment email). */
export async function getTeamContactMembers(contactIds) {
  return db.execute({
    sql: `SELECT email, name FROM contacts WHERE cid IN (${contactIds.map(() => "?").join(",")})`,
    args: [...contactIds],
  });
}

/** Delete a team by id. */
export async function deleteTeam(id) {
  return db.execute({
    sql: "DELETE FROM v2_teams WHERE id = ?",
    args: [id],
  });
}
