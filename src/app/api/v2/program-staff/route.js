// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { initDb } from "@/lib/db";
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
import { NextResponse } from "next/server";
import { requireAuth, getSession, isAssignedPmForProgram } from "@/lib/auth";
import { buildFullFacilitatorPermissions } from "@/lib/facilitator-permissions";

/**
 * PM-scope guard: staff may only manage a program's staff/facilitators when
 * they are the assigned PM of that program (Phase 10 model — PM is a function
 * layered on Staff). SA and legacy bypass roles pass through.
 */
async function assertPmScope(programId) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "errors.authRequired" },
      { status: 401 },
    );
  }
  if (session.role === "super_admin") return null;
  if (["program_manager", "teacher"].includes(session.role)) return null;
  if (session.role === "staff") {
    const isPm = await isAssignedPmForProgram(programId, session.cid);
    if (isPm) return null;
  }
  return NextResponse.json(
    { success: false, error: "errors.insufficientPermissions" },
    { status: 403 },
  );
}

async function logFacilitatorTimeline(staffId, programId, eventType, description, extra = {}) {
  try {
    const session = await getSession();
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

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staff_id");
    const programId = searchParams.get("program_id");

    // Staff may only read their own assignments or assignments of a program
    // they are the assigned PM of (never the whole table).
    const session = await getSession();
    if (session?.role === "staff") {
      if (staffId && String(staffId) !== String(session.cid)) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      if (programId) {
        const scopeError = await assertPmScope(programId);
        if (scopeError) return scopeError;
      } else if (!staffId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }

    const res = await listV2ProgramStaffAssignments(staffId, programId);
    return NextResponse.json({ success: true, assignments: res.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { program_id, staff_id, role, permissions } = await req.json();
    const roleLower = String(role || "").toLowerCase();

    const session = await getSession();
    if (session?.role === "staff") {
      const scopeError = await assertPmScope(program_id);
      if (scopeError) return scopeError;
    }

    // Same safeguard as the v1 program-staff and bulk-invite paths: an empty
    // permissions payload must never silently strip a facilitator's access.
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
        return NextResponse.json({ success: false, error: "errors.roleConflictParticipantFacilitator" }, { status: 409 });
      }
    }

    const res = await upsertV2ProgramStaffAssignment(
      program_id,
      staff_id,
      role || "staff",
      JSON.stringify(finalPermissions),
    );
    if (roleLower === "facilitator") {
      await logFacilitatorTimeline(staff_id, program_id, "facilitator_assigned", "Assigned as facilitator to program", { role });
    }

    // Mirror into the generalized assignment record (additive, idempotent) so
    // PM-managed program-staff assignments keep parity with the V1 program-staff
    // path and the bulk-invite path. Non-fatal: never breaks the PM flow.
    try {
      const actor = await getSession();
      const mirrorRole = String(role || "staff").toLowerCase();
      await insertGeneralizedProgramAssignmentV2(
        mirrorRole,
        String(program_id),
        JSON.stringify(finalPermissions),
        actor?.cid || "system",
        staff_id,
      );
    } catch (_) {}

    return NextResponse.json({ success: true, id: res.rows[0]?.id ?? res.lastInsertRowid });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { id, role, permissions } = await req.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const target = await getProgramStaffTargetForScopeCheck(id);
    if (session?.role === "staff" && target.rows[0]?.program_id) {
      const scopeError = await assertPmScope(target.rows[0].program_id);
      if (scopeError) return scopeError;
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
      return NextResponse.json({ success: true, message: "No fields to update." });
    }
    fields.push("updated_at = NOW()");
    args.push(id);
    await updateV2ProgramStaffAssignment(fields, args);
    const row = await getV2ProgramStaffAssignmentWithPermissions(id);
    if (row.rows[0]) {
      await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_role_changed", "Facilitator program assignment updated", { role: row.rows[0].role, permissions: permissions || null });

      // Mirror the final assignment state into the generalized record.
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
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const { id } = await req.json();
    const row = await getV2ProgramStaffAssignmentForDelete(id);
    const session = await getSession();
    if (session?.role === "staff" && row.rows[0]?.program_id) {
      const scopeError = await assertPmScope(row.rows[0].program_id);
      if (scopeError) return scopeError;
    }
    await deleteV2ProgramStaffAssignmentById(id);
    if (row.rows[0]) {
      await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_removed", "Removed from program (assignment only — CRM record untouched)");

      // Preserve assignment history in the generalized record: mark ended.
      try {
        const cidRes = await getV2ContactCidForProgramRoleCleanup(row.rows[0].staff_id);
        const contactCid = cidRes.rows[0]?.cid;
        if (contactCid) {
          await endV2MirroredProgramContactRole(contactCid, String(row.rows[0].program_id));
        }
      } catch (_) {}
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
