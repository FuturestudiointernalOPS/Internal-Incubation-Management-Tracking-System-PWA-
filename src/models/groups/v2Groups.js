import db from "@/lib/db";

/**
 * V2 groups store — the legacy `v2_groups` / `v2_group_members` reads and
 * writes still used by the V1 pages (`/api/v2/groups`, `/api/group-members`,
 * `/api/superadmin/groups/assignment`).
 *
 * Split out of `src/models/groups.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/groups` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── POST/PUT/GET /api/v2/groups (legacy V2 API, still used by V1 pages) ─────

/** System-group guard: existing Facilitators group for a program (POST). */
export async function findV2FacilitatorsGroupByProgram(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'",
    args: [programId],
  });
}

/** Create a v2 group, returning its id (POST). */
export async function createV2Group(programId, name, projectDescription, groupType, isSystem) {
  return db.execute({
    sql: `INSERT INTO v2_groups (program_id, name, project_description, type, is_system)
             VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [programId, name, projectDescription, groupType, isSystem],
  });
}

/** System-group guard: name/type/is_system of a v2 group by text-cast id (PUT). */
export async function getV2GroupSystemFlagsById(id) {
  return db.execute({
    sql: "SELECT name, type, is_system FROM v2_groups WHERE CAST(id AS TEXT) = ?",
    args: [String(id)],
  });
}

/** Update a v2 group's mutable fields — dynamic SET built by the controller (PUT). */
export async function updateV2GroupFields(fields, args) {
  return db.execute({
    sql: `UPDATE v2_groups SET ${fields.join(", ")} WHERE CAST(id AS TEXT) = ?`,
    args,
  });
}

/** Families rendered as groups for the merged v2 groups list (GET). */
export async function getFamilyGroupRowsByProgram(programId) {
  let sql = "SELECT CAST(f.id AS TEXT) as id, f.program_id, f.name, f.description as project_description, f.lead_facilitator_id, c.name as lead_facilitator_name, 'participant' as type, 0 as is_system, f.created_at FROM families f LEFT JOIN contacts c ON f.lead_facilitator_id = c.cid";
  let args = [];
  if (programId) {
    sql += " WHERE f.program_id = ?";
    args.push(programId);
  }
  return db.execute({ sql, args });
}

/** v2_groups rows for the merged v2 groups list (GET). */
export async function getV2GroupRowsByProgram(programId) {
  let sql = "SELECT CAST(id AS TEXT) as id, program_id, name, project_description, type, is_system, created_at FROM v2_groups";
  let args = [];
  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }
  return db.execute({ sql, args });
}

// ── POST / GET /api/group-members ────────────────────────────────────────────

/** The owning program of a group (POST — resolves the membership write's scope). */
export async function getGroupProgramId(groupId) {
  return db.execute({
    sql: "SELECT program_id FROM v2_groups WHERE CAST(id AS TEXT) = ?",
    args: [String(groupId)],
  });
}

/** A participant's memberships with each group's program id (POST duplicate rule). */
export async function getParticipantGroupPrograms(participantId) {
  return db.execute({
    sql: `SELECT gm.id, g.program_id
              FROM v2_group_members gm
              LEFT JOIN v2_groups g ON g.id = gm.group_id
             WHERE CAST(gm.participant_id AS TEXT) = ?`,
    args: [String(participantId)],
  });
}

/** Insert one group membership (POST). */
export async function insertGroupMember(groupId, participantId) {
  return db.execute({
    sql: "INSERT INTO v2_group_members (group_id, participant_id) VALUES (?, ?) RETURNING *",
    args: [groupId, participantId],
  });
}

/** A group's memberships (GET). */
export async function getGroupMembers(groupId) {
  return db.execute({
    sql: "SELECT * FROM v2_group_members WHERE CAST(group_id AS TEXT) = ?",
    args: [String(groupId)],
  });
}

/** The participant rows behind a group's memberships (GET embedded resource). */
export async function getGroupMemberParticipants(groupId) {
  return db.execute({
    sql: `SELECT p.*
              FROM v2_participants p
              JOIN v2_group_members gm ON gm.participant_id = p.id
             WHERE CAST(gm.group_id AS TEXT) = ?`,
    args: [String(groupId)],
  });
}

// ── POST /api/superadmin/groups/assignment ───────────────────────────────────

/** Program existence check before assigning a group (v2_programs by id). */
export async function getV2ProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Assign program_id/program_name to every contact in a group (case-insensitive). */
export async function updateContactsProgramAssignment(programId, programName, groupName) {
  return db.execute({
    sql: "UPDATE contacts SET program_id = ?, program_name = ? WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
    args: [programId, programName || null, groupName],
  });
}

/** Contacts of a group (cid, email, name, phone) for the assignment loop. */
export async function getAssignmentContactsByGroupName(groupName) {
  return db.execute({
    sql: "SELECT cid, email, name, phone FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
    args: [groupName],
  });
}

/** Sync the participant_programs junction row for an assigned contact. */
export async function insertParticipantProgramMembership(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                VALUES (?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}
