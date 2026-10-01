/**
 * GROUP MEMBERS (v2 team membership) — the add/list use-cases.
 *
 * A membership write belongs to the group's program, so the caller must be
 * staffed there (the scope guard stays on the route, which resolves the program
 * first). A participant may belong to at most ONE team per program — that
 * "already assigned" decision lives here.
 *
 * The reads and writes go through `@/models/groups`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  getGroupProgramId,
  getParticipantGroupPrograms,
  insertGroupMember,
  getGroupMembers,
  getGroupMemberParticipants,
} from "@/models/groups";

/** The program a group belongs to, or null when the group does not exist. */
export async function resolveGroupProgram(groupId) {
  const { rows } = await getGroupProgramId(groupId);
  return rows[0]?.program_id ?? null;
}

/** Whether the participant already has a team in this program. */
export async function isParticipantInProgram(participantId, programId) {
  const { rows } = await getParticipantGroupPrograms(participantId);
  return rows.some((row) => String(row.program_id) === String(programId));
}

/** Insert the membership, returning the new row (or null). */
export async function addMemberToGroup({ groupId, participantId }) {
  const { rows } = await insertGroupMember(groupId, participantId);
  return rows[0] ?? null;
}

/** The group's members, each with its participant row nested (`v2_participants`). */
export async function listGroupMembersWithParticipants(groupId) {
  const [{ rows: members }, { rows: participants }] = await Promise.all([
    getGroupMembers(groupId),
    getGroupMemberParticipants(groupId),
  ]);
  const byId = new Map(participants.map((participant) => [String(participant.id), participant]));
  return members.map((member) => ({
    ...member,
    v2_participants: byId.get(String(member.participant_id)) ?? null,
  }));
}
