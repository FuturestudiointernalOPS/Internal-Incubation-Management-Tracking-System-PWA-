/**
 * DELIVERABLE SUBMISSIONS — the scope helpers.
 *
 * Pure (and near-pure) functions that bind a caller to their own identity / team
 * and resolve the facilitator's group scope for a program read. The route keeps
 * the HTTP answer; these return values or plain objects.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { getFacilitatorTeamScope } from "@/models/authorization/accessQueries";
import { hasProgramManagementAccess } from "@/server/authz/capabilities";

/** Bind a team-entity session to its own team; others keep the chosen teamId. */
export function bindSubmissionTeamScope({ session, teamId }) {
  if (session?.role === "team") {
    const ownTeamId = String(session.cid || "");
    if (teamId && String(teamId) !== ownTeamId) {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    return { teamId: ownTeamId };
  }
  return { teamId };
}

/**
 * Own-scope fallback: without a program context, non-management / non-staff /
 * non-team sessions (participants, members, …) read only their own rows.
 */
export function applyOwnSubmissionScope({ session, participantId, programId }) {
  if (
    session &&
    !programId &&
    !hasProgramManagementAccess(session.role) &&
    session.role !== "staff" &&
    session.role !== "team"
  ) {
    return session.cid;
  }
  return participantId;
}

/** Whether a program-scoped read needs the facilitator scope filter. */
export function needsFacilitatorSubmissionScope(session, programId) {
  return Boolean(
    session &&
      programId &&
      !hasProgramManagementAccess(session.role) &&
      session.role !== "staff" &&
      session.role !== "team",
  );
}

/**
 * The facilitator's group/team scope filter for a program read, or
 * `{ empty: true }` when they have no record scope (deny-closed).
 */
export async function resolveFacilitatorSubmissionScope({ programId, sessionCid }) {
  const scope = await getFacilitatorTeamScope(programId, sessionCid);
  if (scope.scope === "all") return { facScopeFilter: null, facScopeArgs: [] };
  if (scope.teamIds.length === 0) return { empty: true };
  return {
    facScopeFilter:
      "s.participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
      scope.teamIds.map(() => "?").join(",") +
      "))",
    facScopeArgs: scope.teamIds,
  };
}
