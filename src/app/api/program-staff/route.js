import {
  deleteProgramStaffAssignmentById,
  endMirroredProgramContactRole,
  getContactCidForProgramRoleCleanup,
  getContactCidForProgramRoleMirror,
  getProgramStaffAssignmentForDelete,
  getProgramStaffAssignmentWithPermissions,
  insertFacilitatorTimelineEvent,
  insertGeneralizedProgramAssignment,
  insertMirroredProgramContactRole,
  listProgramStaffAssignments,
  updateMirroredProgramContactRole,
  updateProgramStaffAssignment,
  upsertProgramStaffAssignment,
} from "@/models/programMembership";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import { buildFullFacilitatorPermissions } from "@/lib/facilitator-permissions";

const ROLE = { roles: ['super_admin'] };

async function logFacilitatorTimeline(staffId, programId, eventType, description, extra = {}) {
  try {
    const session = await getSession();
    await insertFacilitatorTimelineEvent(
      staffId,
      eventType,
      description,
      String(programId || ""),
      session?.cid || "system",
      JSON.stringify(extra),
    );
  } catch (_) {}
}

export const GET = createHandler(ROLE, async (req) => {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staff_id");
  const programId = searchParams.get("program_id");

  const assignmentsResult = await listProgramStaffAssignments(staffId, programId);
  return NextResponse.json({ success: true, assignments: assignmentsResult.rows });
});

export const POST = createHandler(ROLE, async (req) => {
  const { program_id, staff_id, role, permissions } = await req.json();
  const roleLower = String(role || "").toLowerCase();
  const finalPermissions =
    permissions && Object.keys(permissions).length > 0
      ? permissions
      : roleLower === "facilitator"
        ? buildFullFacilitatorPermissions()
        : {};
  const assignmentResult = await upsertProgramStaffAssignment(
    program_id,
    staff_id,
    // Default to "staff", not a manager-type or facilitator role: this endpoint
    // grants permissions only to facilitators, so any other role receives an
    // empty set and must stay at that least privilege.
    role || "staff",
    JSON.stringify(finalPermissions),
  );

  // Mirror into the generalized assignment record (additive, idempotent).
  const actor = await getSession();
  await insertGeneralizedProgramAssignment(
    roleLower || "staff",
    String(program_id),
    JSON.stringify(finalPermissions),
    actor?.cid || "system",
    staff_id,
  );

  if (String(role || "").toLowerCase() === "facilitator") {
    await logFacilitatorTimeline(staff_id, program_id, "facilitator_assigned", "Assigned as facilitator to program", { role });
  }
  return NextResponse.json({ success: true, id: assignmentResult.rows[0]?.id ?? assignmentResult.lastInsertRowid });
});

export const PUT = createHandler(ROLE, async (req) => {
  const { id, role, permissions } = await req.json();
  if (!id) {
    return NextResponse.json(
      { success: false, error: "id is required" },
      { status: 400 },
    );
  }
  const fields = [];
  const args = [];
  if (role !== undefined) {
    fields.push("role = ?");
    args.push(role);
  }
  if (permissions !== undefined) {
    fields.push("permissions = ?");
    args.push(
      typeof permissions === "string" ? permissions : JSON.stringify(permissions || {}),
    );
  }
  if (fields.length === 0) {
    return NextResponse.json({ success: true, message: "No fields to update." });
  }
  fields.push("updated_at = NOW()");
  args.push(id);
  await updateProgramStaffAssignment(fields, args);
  const row = await getProgramStaffAssignmentWithPermissions(id);
  if (row.rows[0]) {
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_role_changed", "Facilitator program assignment updated", { role: row.rows[0].role, permissions: permissions || null });

    // Mirror the final assignment state into the generalized record.
    const assignment = row.rows[0];
    const cidRes = await getContactCidForProgramRoleMirror(assignment.staff_id);
    const contactCid = cidRes.rows[0]?.cid;
    if (contactCid) {
      const finalRole = assignment.role || "staff"; // same least-privilege default as POST
      const finalPerms = JSON.stringify(assignment.permissions || {});
      const mirrorUpdate = await updateMirroredProgramContactRole(
        finalRole,
        finalPerms,
        contactCid,
        String(assignment.program_id),
      );
      if (mirrorUpdate.rowsAffected === 0) {
        await insertMirroredProgramContactRole(
          contactCid,
          finalRole,
          String(assignment.program_id),
          finalPerms,
        );
      }
    }
  }
  return NextResponse.json({ success: true });
});

export const DELETE = createHandler(ROLE, async (req) => {
  const { id } = await req.json();
  const row = await getProgramStaffAssignmentForDelete(id);
  await deleteProgramStaffAssignmentById(id);
  if (row.rows[0]) {
    // Preserve assignment history in the generalized record instead of
    // losing it: mark the current assignment row ended/removed.
    try {
      const cidRes = await getContactCidForProgramRoleCleanup(row.rows[0].staff_id);
      const contactCid = cidRes.rows[0]?.cid;
      if (contactCid) {
        await endMirroredProgramContactRole(contactCid, String(row.rows[0].program_id));
      }
    } catch (_) {}
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_removed", "Removed from program (assignment only — CRM record untouched)");
  }
  return NextResponse.json({ success: true });
});
