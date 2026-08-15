import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import { buildFullFacilitatorPermissions } from "@/lib/facilitator-permissions";

const ROLE = { roles: ['super_admin'] };

async function logFacilitatorTimeline(staffId, programId, eventType, description, extra = {}) {
  try {
    const session = await getSession();
    await db.execute({
      sql: "INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata) VALUES (?, ?, ?, 'programs', ?, ?, ?::jsonb)",
      args: [staffId, eventType, description, String(programId || ""), session?.cid || "system", JSON.stringify(extra)],
    });
  } catch (_) {}
}

export const GET = createHandler(ROLE, async (req) => {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staff_id");
  const programId = searchParams.get("program_id");

  let query = `
    SELECT ps.*, p.name as program_name, p.status as program_status
    FROM v2_program_staff ps
    JOIN v2_programs p ON ps.program_id = p.id
  `;
  let args = [];

  if (staffId) {
    query += " WHERE ps.staff_id = ?";
    args = [staffId];
  } else if (programId) {
    query += " WHERE ps.program_id = ?";
    args = [programId];
  }

  const res = await db.execute({ sql: query, args });
  return NextResponse.json({ success: true, assignments: res.rows });
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
  const res = await db.execute({
    sql: "INSERT INTO v2_program_staff (program_id, staff_id, role, permissions) VALUES (?, ?, ?, ?::jsonb) ON CONFLICT (program_id, staff_id) DO UPDATE SET role = EXCLUDED.role, permissions = COALESCE(EXCLUDED.permissions, v2_program_staff.permissions), updated_at = NOW() RETURNING id",
    args: [program_id, staff_id, role || "teacher", JSON.stringify(finalPermissions)],
  });
  if (String(role || "").toLowerCase() === "facilitator") {
    await logFacilitatorTimeline(staff_id, program_id, "facilitator_assigned", "Assigned as facilitator to program", { role });
  }
  return NextResponse.json({ success: true, id: res.rows[0]?.id ?? res.lastInsertRowid });
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
  await db.execute({
    sql: `UPDATE v2_program_staff SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });
  const row = await db.execute({ sql: "SELECT staff_id, program_id, role FROM v2_program_staff WHERE id = ?", args: [id] });
  if (row.rows[0]) {
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_role_changed", "Facilitator program assignment updated", { role: row.rows[0].role, permissions: permissions || null });
  }
  return NextResponse.json({ success: true });
});

export const DELETE = createHandler(ROLE, async (req) => {
  const { id } = await req.json();
  const row = await db.execute({ sql: "SELECT staff_id, program_id FROM v2_program_staff WHERE id = ?", args: [id] });
  await db.execute({
    sql: "DELETE FROM v2_program_staff WHERE id = ?",
    args: [id],
  });
  if (row.rows[0]) {
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_removed", "Removed from program (assignment only — CRM record untouched)");
  }
  return NextResponse.json({ success: true });
});
