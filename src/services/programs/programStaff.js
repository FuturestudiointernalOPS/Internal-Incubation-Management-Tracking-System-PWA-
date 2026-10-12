import {
  deleteV2ProgramStaffAssignmentById,
  endV2MirroredProgramContactRole,
  findParticipantFacilitatorConflict,
  getContactEmailForRoleConflict,
  getProgramStaffTargetForScopeCheck,
  getV2ContactCidForProgramRoleCleanup,
  getV2ContactCidForProgramRoleMirror,
  getV2ProgramStaffAssignmentForDelete,
  getV2ProgramStaffAssignmentWithPermissions,
  insertGeneralizedProgramAssignmentV2,
  insertV2FacilitatorTimelineEvent,
  insertV2MirroredProgramContactRole,
  listV2ProgramStaffAssignments,
  updateV2MirroredProgramContactRole,
  updateV2ProgramStaffAssignment,
  upsertV2ProgramStaffAssignment,
} from "@/models/programMembership";
import { isAssignedPmForProgram } from "@/models/authorization/accessQueries";
import { buildFullFacilitatorPermissions } from "@/lib/facilitator-permissions";
import { reconcileFacilitatorAccessForUser } from "@/services/authorization/contextGrantProgramAccess";

export class ProgramStaffError extends Error {
  constructor(message, status = 400, errorCode = "") {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function assertPmScope(programId, session) {
  if (!session) {
    throw new ProgramStaffError("errors.authRequired", 401);
  }
  if (session.role === "super_admin") return;
  if (session.role === "program_manager") return;
  if (session.role === "staff") {
    const isPm = await isAssignedPmForProgram(programId, session.cid);
    if (isPm) return;
  }
  throw new ProgramStaffError("errors.insufficientPermissions", 403);
}

async function logFacilitatorTimeline(staffId, programId, eventType, description, extra = {}, session) {
  try {
    await insertV2FacilitatorTimelineEvent(
      staffId,
      eventType,
      description,
      String(programId || ""),
      session?.cid || "system",
      JSON.stringify(extra),
    );
  } catch (_) {}
}

/**
 * Phase E, step 6 — apply the facilitator relationship change immediately.
 * Resolves the staff reference (a cid or, in legacy rows, an address) to the
 * contact, then lets the reconcile re-derive their program access. Best-effort:
 * the stored assignment is the source of truth and the scheduled sweep re-derives
 * from it, so a failure here must never fail the write.
 */
async function applyFacilitatorAccess(staffRef) {
  if (!staffRef) return;
  try {
    const cidRes = await getV2ContactCidForProgramRoleMirror(staffRef);
    const contactCid = cidRes.rows[0]?.cid;
    if (contactCid) {
      await reconcileFacilitatorAccessForUser(contactCid, { email: staffRef });
    }
  } catch (_) {}
}

export async function getProgramStaffAssignments(staffId, programId, session) {
  if (session?.role === "staff") {
    if (staffId && String(staffId) !== String(session.cid)) {
      throw new ProgramStaffError("errors.insufficientPermissions", 403);
    }
    if (programId) {
      await assertPmScope(programId, session);
    } else if (!staffId) {
      throw new ProgramStaffError("errors.insufficientPermissions", 403);
    }
  }

  const res = await listV2ProgramStaffAssignments(staffId, programId);
  return res.rows;
}

export async function upsertProgramStaffAssignment(payload, session) {
  const { program_id, staff_id, role, permissions } = payload;
  const roleLower = String(role || "").toLowerCase();

  if (session?.role === "staff") {
    await assertPmScope(program_id, session);
  }

  const finalPermissions =
    permissions && Object.keys(permissions).length > 0
      ? permissions
      : roleLower === "facilitator"
        ? buildFullFacilitatorPermissions()
        : {};

  if (roleLower === "facilitator") {
    const contactRes = await getContactEmailForRoleConflict(staff_id);
    const contactEmail = contactRes.rows[0]?.email || "";
    const conflict = await findParticipantFacilitatorConflict(
      staff_id,
      program_id,
      contactEmail,
    );
    if (conflict.rows.length > 0) {
      throw new ProgramStaffError("errors.roleConflictParticipantFacilitator", 409);
    }
  }

  const res = await upsertV2ProgramStaffAssignment(
    program_id,
    staff_id,
    role || "staff",
    JSON.stringify(finalPermissions),
  );

  if (roleLower === "facilitator") {
    await logFacilitatorTimeline(staff_id, program_id, "facilitator_assigned", "Assigned as facilitator to program", { role }, session);
  }

  try {
    const mirrorRole = String(role || "staff").toLowerCase();
    await insertGeneralizedProgramAssignmentV2(
      mirrorRole,
      String(program_id),
      JSON.stringify(finalPermissions),
      session?.cid || "system",
      staff_id,
    );
  } catch (_) {}

  // Phase E — the facilitator relationship change applies immediately.
  await applyFacilitatorAccess(staff_id);

  return res.rows[0]?.id ?? res.lastInsertRowid;
}

export async function updateProgramStaffAssignment(payload, session) {
  const { id, role, permissions } = payload;
  if (!id) {
    throw new ProgramStaffError("id is required", 400);
  }

  const target = await getProgramStaffTargetForScopeCheck(id);
  if (session?.role === "staff" && target.rows[0]?.program_id) {
    await assertPmScope(target.rows[0].program_id, session);
  }

  const fields = [];
  const args = [];
  if (role !== undefined) {
    fields.push("role = ?");
    args.push(role);
  }
  if (permissions !== undefined) {
    const targetIsFacilitator =
      String(target.rows[0]?.role || "").toLowerCase() === "facilitator";
    const hasPerms =
      permissions &&
      typeof permissions === "object" &&
      Object.keys(permissions).length > 0;
    const resolved = hasPerms
      ? permissions
      : targetIsFacilitator
        ? buildFullFacilitatorPermissions()
        : {};
    fields.push("permissions = ?");
    args.push(JSON.stringify(resolved));
  }
  
  if (fields.length === 0) {
    return { success: true, message: "No fields to update." };
  }
  
  fields.push("updated_at = NOW()");
  args.push(id);
  
  await updateV2ProgramStaffAssignment(fields, args);
  const row = await getV2ProgramStaffAssignmentWithPermissions(id);
  
  if (row.rows[0]) {
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_role_changed", "Facilitator program assignment updated", { role: row.rows[0].role, permissions: permissions || null }, session);

    try {
      const assignment = row.rows[0];
      const cidRes = await getV2ContactCidForProgramRoleMirror(assignment.staff_id);
      const contactCid = cidRes.rows[0]?.cid;
      if (contactCid) {
        const finalRole = assignment.role || "staff";
        const finalPerms = JSON.stringify(assignment.permissions || {});
        const mirrorUpdate = await updateV2MirroredProgramContactRole(
          finalRole,
          finalPerms,
          contactCid,
          String(assignment.program_id),
        );
        if (mirrorUpdate.rowsAffected === 0) {
          await insertV2MirroredProgramContactRole(
            contactCid,
            finalRole,
            String(assignment.program_id),
            finalPerms,
          );
        }
      }
    } catch (_) {}
  }

  // Phase E — re-derive the facilitator's access after the role/permission edit.
  if (row.rows[0]) {
    await applyFacilitatorAccess(row.rows[0].staff_id);
  }

  return { success: true };
}

export async function removeProgramStaffAssignment(id, session) {
  const row = await getV2ProgramStaffAssignmentForDelete(id);
  
  if (session?.role === "staff" && row.rows[0]?.program_id) {
    await assertPmScope(row.rows[0].program_id, session);
  }
  
  await deleteV2ProgramStaffAssignmentById(id);
  
  if (row.rows[0]) {
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_removed", "Removed from program (assignment only — CRM record untouched)", {}, session);

    try {
      const cidRes = await getV2ContactCidForProgramRoleCleanup(row.rows[0].staff_id);
      const contactCid = cidRes.rows[0]?.cid;
      if (contactCid) {
        await endV2MirroredProgramContactRole(contactCid, String(row.rows[0].program_id));
      }
    } catch (_) {}

    // Phase E — withdrawing the relationship withdraws its access immediately.
    await applyFacilitatorAccess(row.rows[0].staff_id);
  }

  return { success: true };
}
