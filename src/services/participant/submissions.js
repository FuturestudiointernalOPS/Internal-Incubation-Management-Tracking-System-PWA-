/**
 * Participant service — participant / team submissions.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — who may read or
 * create whose submissions, the self-scope fallback, and the view-only gate of
 * a completed program. Every statement lives in `@/models/participantPortal`.
 * No SQL, no HTTP: a refusal is a value ({ error, status }) the HTTP boundary
 * turns into a response.
 */

import { getSubmissionProgramCompletionStatus } from "@/models/participantPortal";

// Roles that may read anybody's submissions.
const PRIVILEGED_READ_ROLES = ["staff", "super_admin", "program_manager", "facilitator"];
// Roles that may write on anybody's behalf and ignore the view-only gate.
const PRIVILEGED_WRITE_ROLES = ["staff", "super_admin", "program_manager"];

/**
 * Which submissions a GET may read. Internal roles read anything; everyone else
 * reads their own (and a team member may read their team's). A caller that asks
 * for nobody in particular implicitly asks for themselves.
 */
export function resolveSubmissionReadScope({ role, sessionCid, participantId, teamId }) {
  if (PRIVILEGED_READ_ROLES.includes(role)) return { participantId, teamId };

  if (participantId && String(participantId) !== String(sessionCid)) {
    return { error: "You can only access your own submissions.", status: 403 };
  }
  if (teamId && role !== "team") {
    return { error: "You cannot access team submissions.", status: 403 };
  }
  if (!participantId && !teamId) return { participantId: sessionCid, teamId };
  return { participantId, teamId };
}

/**
 * Which submissions a POST may create. Same shape as the read scope, plus
 * `privileged` (which decides whether the view-only gate applies).
 */
export function resolveSubmissionWriteScope({ role, sessionCid, participantId, teamId }) {
  if (PRIVILEGED_WRITE_ROLES.includes(role)) {
    return { participantId, teamId, privileged: true };
  }

  if (participantId && String(participantId) !== String(sessionCid)) {
    return { error: "You can only create your own submissions.", status: 403 };
  }
  if (teamId && role !== "team") {
    return { error: "You cannot create team submissions.", status: 403 };
  }
  if (!participantId && !teamId) {
    return { participantId: sessionCid, teamId, privileged: false };
  }
  return { participantId, teamId, privileged: false };
}

/**
 * The view-only gate (Phase 2C): a participant / team cannot submit into a
 * completed program (person-level completion or program-level). Staff / PM /
 * super_admin manage regardless of program status. Fails OPEN, as before: a
 * failed completion read never blocks a submission.
 */
export async function isProgramViewOnly({ role, sessionCid, programId }) {
  if (!programId || PRIVILEGED_WRITE_ROLES.includes(role)) return false;
  try {
    const completionCheck = await getSubmissionProgramCompletionStatus(sessionCid, programId);
    const programStatus = String(completionCheck.rows[0]?.status || "").toLowerCase();
    return programStatus === "completed";
  } catch (_) {
    return false;
  }
}
