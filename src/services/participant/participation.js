/**
 * Participant service — "is this person a participant?" (SERVICE layer).
 *
 * THE single answer, used by the side menu, the participant dashboard, the
 * workspace hub and the landing decision. Before this, each surface asked a
 * slightly different question (one counted any membership, one required an
 * active one, one also accepted the older group/program links), so a person
 * whose relationship was recorded through the older path could see their
 * learning but get no program door.
 *
 * Rules:
 *   - `participant_programs` is authoritative, whatever the lifecycle status.
 *     A COMPLETED seat keeps the door open, read-only, instead of losing it.
 *   - The older links (contact program field, group name → program, older
 *     participant records by email) count only when the modern table has no
 *     row for the person — the exact rule the program content applies, read
 *     from the same statement.
 *   - A program that no longer exists grants nothing, so the door always leads
 *     somewhere real.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, statements in
 * `@/models/participant-membership`. No SQL, no HTTP.
 */

import {
  getParticipantParticipationSnapshot,
  getParticipantProgramIds,
} from "@/models/participant-membership";

const isCompletedStatus = (status) => String(status || "").toLowerCase() === "completed";

const EMPTY_PARTICIPATION = {
  programIds: [],
  memberships: [],
  hasCompleted: false,
  isProgramParticipant: false,
};

function seatFromRow(row) {
  const completed = isCompletedStatus(row.status);
  return {
    program_id: String(row.program_id),
    status: row.status || "active",
    program_name: row.program_name || null,
    program_exists: true,
    completed_at: row.completed_at || null,
    outcome: row.outcome || null,
    certificate_issued: row.certificate_issued === true,
    completed,
    readOnly: completed,
    legacy: row.source === "legacy",
  };
}

/**
 * Resolve the person's programs, with the lifecycle status of each.
 *
 * @param {{cid?: string, email?: string, contact?: Object}} who
 * @returns {Promise<{
 *   programIds: string[],
 *   memberships: Array<Object>,
 *   hasCompleted: boolean,
 *   isProgramParticipant: boolean,
 * }>}
 */
export async function resolveParticipantParticipation({ cid, email } = {}) {
  if (!cid) return EMPTY_PARTICIPATION;

  let rows = [];
  try {
    const snapshot = await getParticipantParticipationSnapshot({ cid, email });
    rows = snapshot.rows || [];
  } catch (_) {
    // A deployment where the combined read is unavailable still gets a door:
    // the guarded id lookup below answers for the modern memberships.
    try {
      const ids = await getParticipantProgramIds({ cid, email });
      rows = ids.map((programId) => ({ program_id: programId, source: "membership" }));
    } catch {
      return EMPTY_PARTICIPATION;
    }
  }

  const memberships = [];
  for (const row of rows) {
    if (row?.program_id == null) continue;
    // A seat whose program no longer exists has no content to open.
    if (row.program_exists === false) continue;
    memberships.push(seatFromRow(row));
  }

  return {
    programIds: memberships.map((membership) => membership.program_id),
    memberships,
    hasCompleted: memberships.some((membership) => membership.completed),
    // The door is open exactly when there is a program the content can show.
    isProgramParticipant: memberships.length > 0,
  };
}

/**
 * The participation of one person in one program, with its read-only flag.
 * `null` when they hold no seat in it.
 */
export async function resolveProgramSeat({ cid, email, programId } = {}) {
  const participation = await resolveParticipantParticipation({ cid, email });
  const membership = participation.memberships.find(
    (entry) => String(entry.program_id) === String(programId),
  );
  return membership || null;
}
