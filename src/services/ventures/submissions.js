/**
 * DELIVERABLE SUBMISSIONS — the submit / review / list / score use-cases.
 *
 * A submission is versioned: each POST creates a new version (never an update).
 * Self-service callers (participant / member / team sessions) are bound to their
 * OWN identity and program, and may only submit into an active program they still
 * belong to; staff / PM / Super Admin submit on behalf. The capability /
 * assignment guards stay on the route (they answer HTTP).
 *
 * Reads and writes go through `@/models/forms` (and `@/models/teams` for the
 * team-ownership check); nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  createSubmission,
  ensureSubmissionsTeamIdColumn,
  findMaxSubmissionVersion,
  getParticipantProgramSubmissionStatus,
  getSubmissionProgramStatus,
} from "@/models/forms";
import { getTeamForOwnershipCheck } from "@/models/teams";

const MANAGEMENT_ROLES = ["staff", "super_admin", "program_manager"];

/**
 * Create a new submission version. Returns `{ denied: { error, status } }`, or
 * `{ submission }` on success.
 */
export async function createSubmissionRecord({ session, body }) {
  const role = String(session?.role || "").toLowerCase();

  // Phase 1.1 identity binding (self-service):
  //  - participant/member sessions may only submit AS THEMSELVES and only into a
  //    program where they hold an active participant membership;
  //  - team-entity sessions may only submit AS THEIR OWN TEAM and only into the
  //    program that owns the team.
  // The caller-chosen participant_id/team_id can no longer target someone
  // else's record.
  if (session && (role === "participant" || role === "member")) {
    if (body.participant_id && String(body.participant_id) !== String(session.cid)) {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    if (!body.program_id) {
      return {
        denied: {
          error: "Missing required fields (program_id and deliverable_id or document_id)",
          status: 400,
        },
      };
    }
    const participationCheck = await getParticipantProgramSubmissionStatus(
      session.cid,
      body.program_id,
    );
    const participationRow = participationCheck.rows?.[0];
    if (!participationRow || String(participationRow.status || "").toLowerCase() === "completed") {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    body.participant_id = session.cid;
    delete body.team_id;
  } else if (session && role === "team") {
    if (!body.program_id) {
      return {
        denied: {
          error: "Missing required fields (program_id and deliverable_id or document_id)",
          status: 400,
        },
      };
    }
    const ownTeam = await getTeamForOwnershipCheck(session.cid);
    const teamRow = ownTeam.rows?.[0];
    if (!teamRow || String(teamRow.program_id) !== String(body.program_id)) {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    if (body.team_id && String(body.team_id) !== String(session.cid)) {
      return { denied: { error: "errors.insufficientPermissions", status: 403 } };
    }
    body.team_id = session.cid;
    delete body.participant_id;
  } else if (session && !MANAGEMENT_ROLES.includes(role)) {
    // Parity guard: every other role (founder, investor, …) was denied by the
    // old pre-filter and stays denied — only staff/PM/SA may submit on behalf.
    return { denied: { error: "errors.insufficientPermissions", status: 403 } };
  }

  const {
    program_id,
    deliverable_id,
    group_id,
    participant_id,
    team_id,
    submission_link,
    file_path,
    file_url,
    supporting_url,
    status,
    feedback,
    document_id,
  } = body;

  if (!program_id || (!deliverable_id && !document_id)) {
    return {
      denied: {
        error: "Missing required fields (program_id and deliverable_id or document_id)",
        status: 400,
      },
    };
  }

  // View-only gate: participants/teams cannot submit into a program that is no
  // longer active (completed/archived), nor when their own membership is closed
  // even if the program itself is still active.
  if (session && ["participant", "team"].includes(session.role)) {
    try {
      const programCheckResult = await getSubmissionProgramStatus(program_id);
      const programStatus = programCheckResult.rows[0]?.status;
      if (programStatus && String(programStatus).toLowerCase() !== "active") {
        return { denied: { error: "errors.programCompletedViewOnly", status: 403 } };
      }
      if (session.role === "participant") {
        const participationCheck = await getParticipantProgramSubmissionStatus(
          session.cid,
          program_id,
        );
        const participationStatus = String(participationCheck.rows[0]?.status || "").toLowerCase();
        if (participationStatus === "completed") {
          return { denied: { error: "errors.programCompletedViewOnly", status: 403 } };
        }
      }
    } catch (_) {}
  }

  // Resolve file URL (database requires this field to be non-null)
  const resolvedFileUrl = file_url || submission_link || file_path || supporting_url || "";

  // Ensure team_id column exists (teams submit as a unit; the PM table matches
  // submissions to members by team_id).
  try {
    await ensureSubmissionsTeamIdColumn();
  } catch (_) {}

  // Auto-detect document_id from deliverable_id if needed
  const finalDeliverableId = deliverable_id || null;
  const finalDocumentId =
    document_id ||
    (deliverable_id && !isNaN(Number(deliverable_id)) ? Number(deliverable_id) : null);

  // Determine version number: the highest existing version for this
  // participant+deliverable, plus one.
  let nextVersion = 1;
  try {
    const existingVersionResult = await findMaxSubmissionVersion({
      participant_id,
      program_id,
      deliverable_id: finalDeliverableId,
      document_id: finalDocumentId,
    });
    const existingVersion = existingVersionResult.rows[0]?.max_ver;
    if (existingVersion) {
      nextVersion = Number(existingVersion) + 1;
    }
  } catch (_) {
    // version_number column might not exist yet (pre-migration)
  }

  const result = await createSubmission({
    program_id,
    deliverable_id: finalDeliverableId,
    document_id: finalDocumentId,
    group_id,
    team_id,
    participant_id,
    file_url: resolvedFileUrl,
    supporting_url,
    status,
    feedback,
    version_number: nextVersion,
  });

  return {
    submission: {
      id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
      program_id,
      deliverable_id,
      version_number: nextVersion,
      status: status || "pending",
    },
  };
}
