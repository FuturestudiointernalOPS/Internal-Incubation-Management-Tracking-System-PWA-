import {
  requireAuth,
  getSession,
  hasProgramManagementAccess,
  requireAssignmentAccess,
} from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  requireProgramScope,
  requireProgramScopeForAll,
} from "@/lib/programScopedAccess";
import { ensureProgramEnrollments } from "@/lib/lms/programRequirements";
import {
  getParticipantProgramAssignments,
  getProgramById,
  getContactEmailByCid,
  checkFacilitatorConflict,
  insertParticipantProgram,
  insertAssignmentAudit,
  insertEnrollmentTimeline,
  deleteParticipantProgram,
  insertRemovalAudit,
  insertWithdrawalTimeline,
} from "@/models/participantPortal";

export async function getParticipantProgramsService({ participantId, programId }) {
  const authError = await requireAuth();
  if (authError) return { isAuthError: true, response: authError };

  const session = await getSession();
  const capError = await requireAuthorization("programs", "view");
  const canRead = !capError || hasProgramManagementAccess(session?.role);
  if (session && !canRead) {
    if (!programId) {
      throw { status: 403, error: "errors.insufficientPermissions" };
    }
    const guardError = await requireAssignmentAccess({
      resource: "program",
      contextId: programId,
    });
    if (guardError) return { isAuthError: true, response: guardError };
  }

  const result = await getParticipantProgramAssignments(participantId, programId);
  return { success: true, assignments: result.rows };
}

export async function assignParticipantToProgramsService({ participant_id, program_ids, assigned_by }) {
  const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
  if (authError) return { isAuthError: true, response: authError };

  if (!participant_id || !program_ids || !Array.isArray(program_ids) || program_ids.length === 0) {
    throw { status: 400, error: "participant_id and program_ids (non-empty array) are required." };
  }

  for (const programId of program_ids) {
    const check = await getProgramById(programId);
    if (check.rows.length === 0) {
      throw { status: 404, error: `Program "${programId}" not found. Create it first before assigning.` };
    }
  }

  const scopeError = await requireProgramScopeForAll({
    programIds: program_ids,
    wave: "enrollment",
  });
  if (scopeError) return { isAuthError: true, response: scopeError };

  const results = [];
  const errors = [];
  let participantEmail = "";
  try {
    const pc = await getContactEmailByCid(participant_id);
    participantEmail = pc.rows[0]?.email || "";
  } catch (_) {}

  for (const program_id of program_ids) {
    try {
      const facConflict = await checkFacilitatorConflict(program_id, participant_id, participantEmail);
      if (facConflict.rows.length > 0) {
        errors.push({ program_id, error: "errors.roleConflictFacilitatorParticipant" });
        continue;
      }

      await insertParticipantProgram(participant_id, program_id);
      await insertAssignmentAudit(participant_id, program_id, assigned_by || null);

      try {
        await insertEnrollmentTimeline(participant_id, program_id);
      } catch (_) {}

      results.push(program_id);

      try {
        await ensureProgramEnrollments(program_id, [participant_id]);
      } catch (lmsErr) {
        console.error(`[participant-programs] auto LMS enrollment failed for ${participant_id} in ${program_id}:`, lmsErr.message);
      }
    } catch (err) {
      console.error(`Error assigning participant ${participant_id} to program ${program_id}:`, err.message);
      errors.push({ program_id, error: err.message });
    }
  }

  return { success: true, assigned: results, errors };
}

export async function removeParticipantFromProgramService({ participant_id, program_id, assigned_by }) {
  const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
  if (authError) return { isAuthError: true, response: authError };

  if (!participant_id || !program_id) {
    throw { status: 400, error: "participant_id and program_id are required." };
  }

  const scopeError = await requireProgramScope({
    programId: program_id,
    wave: "enrollment",
  });
  if (scopeError) return { isAuthError: true, response: scopeError };

  const result = await deleteParticipantProgram(participant_id, program_id);
  await insertRemovalAudit(participant_id, program_id, assigned_by || null);

  try {
    await insertWithdrawalTimeline(participant_id, program_id);
  } catch (_) {}

  return { success: true, rowsAffected: result.rowsAffected };
}
