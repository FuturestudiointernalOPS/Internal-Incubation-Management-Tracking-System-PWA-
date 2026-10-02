import db from "@/lib/db";

/**
 * Communications — message-scope resolution queries (REPOSITORY layer).
 *
 * The lookups used to decide which groups, programs and members a message
 * reaches: recipient resolution for a program/role target, and the caller's own
 * group/program scope. Split verbatim out of `models/communications.js`
 * (same SQL, same order) — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** All FUTURE STUDIO staff member cids (role target '__staff__'). */
export async function getStaffMemberCids() {
  return db.execute({
    sql: `SELECT cid FROM contacts WHERE UPPER(TRIM(group_name)) = 'FUTURE STUDIO' OR role IN ('staff', 'intern', 'super_admin')`,
    args: [],
  });
}

/** Family row for a role/group target id (looked up by id::text). */
export async function findFamilyByIdText(targetId) {
  return db.execute({
    sql: "SELECT name, program_id FROM families WHERE id::text = ?",
    args: [String(targetId)],
  });
}

/** Contact cids whose group name matches a family name. */
export async function getContactsByFamilyGroupName(familyName) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE UPPER(TRIM(group_name)) = ?",
    args: [String(familyName).toUpperCase()],
  });
}

/** User-group cids whose group name matches a family name. */
export async function getUserGroupCidsByGroupName(familyName) {
  return db.execute({
    sql: "SELECT user_cid FROM user_groups WHERE UPPER(TRIM(group_name)) = ?",
    args: [String(familyName).toUpperCase()],
  });
}

/** Participant ids enrolled in a program (program-target recipients). */
export async function getParticipantIdsByProgramId(programId) {
  return db.execute({
    sql: "SELECT participant_id FROM participant_programs WHERE program_id::text = ?",
    args: [String(programId)],
  });
}

/** Staff ids assigned to a program (program-target recipients). */
export async function getProgramStaffIdsByProgramId(programId) {
  return db.execute({
    sql: "SELECT staff_id FROM v2_program_staff WHERE program_id::text = ?",
    args: [String(programId)],
  });
}

/** PM + assistant assignments for a program (program-target recipients). */
export async function getProgramAssigneeIdsByProgramId(programId) {
  return db.execute({
    sql: "SELECT assigned_pm_id, assigned_assistant_id FROM v2_programs WHERE id::text = ?",
    args: [String(programId)],
  });
}

/** Legacy contact cids carrying a program_id (program-target recipients). */
export async function getLegacyContactsByProgramId(programId) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE program_id::text = ?",
    args: [String(programId)],
  });
}

/** A user's contact row used to derive their message scope. */
export async function getContactMessageScopeById(cid) {
  return db.execute({
    sql: "SELECT group_name, role, program_id FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Group names a user belongs to via user_groups. */
export async function getUserGroupNamesByCid(cid) {
  return db.execute({
    sql: "SELECT group_name FROM user_groups WHERE user_cid = ?",
    args: [cid],
  });
}

/** Families whose trimmed, uppercased name matches one of the user's groups. */
export async function findFamiliesByMatchingGroupNames(groupNames) {
  const placeholders = groupNames.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id, program_id FROM families WHERE UPPER(TRIM(name)) IN (${placeholders})`,
    args: groupNames.map((groupName) => String(groupName).toUpperCase()),
  });
}

/** Program ids where the user is the assigned PM or appears as assistant. */
export async function getProgramIdsAssignedToUser(cid) {
  return db.execute({
    sql: "SELECT id::text AS id FROM v2_programs WHERE assigned_pm_id = ? OR assigned_assistant_id LIKE ?",
    args: [cid, `%${cid}%`],
  });
}

/** Program ids the user is staff on (cid or email match). */
export async function getProgramIdsForProgramStaff(cid, email) {
  return db.execute({
    sql: "SELECT program_id::text AS id FROM v2_program_staff WHERE staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)",
    args: [cid, email || ""],
  });
}

/** Program ids for teams the user handles. */
export async function getProgramIdsForTeamHandler(cid) {
  return db.execute({
    sql: "SELECT program_id::text AS id FROM v2_teams WHERE handler_id = ?",
    args: [cid],
  });
}

/** Family ids linked to any of the given program ids. */
export async function findFamilyIdsByProgramIds(programIds) {
  const placeholders = programIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT id FROM families WHERE program_id IN (${placeholders})`,
    args: programIds,
  });
}
