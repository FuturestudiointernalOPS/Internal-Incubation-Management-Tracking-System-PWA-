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

  // Mirror into the generalized assignment record (additive, idempotent).
  const actor = await getSession();
  await db.execute({
    sql: `INSERT INTO contact_roles
            (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
          SELECT c.cid, ?, 'program', ?, true, ?, '{"type":"program"}'::jsonb, 'active', ?::jsonb, ?
          FROM contacts c
          WHERE (c.cid = ? OR LOWER(c.email) = LOWER(?))
            AND c.deleted = 0
            AND NOT EXISTS (
              SELECT 1 FROM contact_roles cr
              WHERE cr.contact_cid = c.cid
                AND cr.role = ?
                AND cr.context_type = 'program'
                AND cr.context_id = ?
                AND cr.is_current = true
            )`,
    args: [
      roleLower || "teacher",
      String(program_id),
      roleLower || "teacher",
      JSON.stringify(finalPermissions),
      actor?.cid || "system",
      staff_id,
      staff_id,
      roleLower || "teacher",
      String(program_id),
    ],
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
  const row = await db.execute({ sql: "SELECT staff_id, program_id, role, permissions FROM v2_program_staff WHERE id = ?", args: [id] });
  if (row.rows[0]) {
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_role_changed", "Facilitator program assignment updated", { role: row.rows[0].role, permissions: permissions || null });

    // Mirror the final assignment state into the generalized record.
    const assignment = row.rows[0];
    const cidRes = await db.execute({
      sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
      args: [assignment.staff_id, assignment.staff_id],
    });
    const contactCid = cidRes.rows[0]?.cid;
    if (contactCid) {
      const finalRole = assignment.role || "teacher";
      const finalPerms = JSON.stringify(assignment.permissions || {});
      const mirrorUpdate = await db.execute({
        sql: `UPDATE contact_roles
              SET title = ?, capability_overrides = ?::jsonb
              WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
        args: [finalRole, finalPerms, contactCid, String(assignment.program_id)],
      });
      if (mirrorUpdate.rowsAffected === 0) {
        await db.execute({
          sql: `INSERT INTO contact_roles
                  (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
                VALUES (?, ?, 'program', ?, true, ?, '{"type":"program"}'::jsonb, 'active', ?::jsonb, 'system')`,
          args: [contactCid, finalRole, String(assignment.program_id), finalRole, finalPerms],
        });
      }
    }
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
    // Preserve assignment history in the generalized record instead of
    // losing it: mark the current assignment row ended/removed.
    try {
      const cidRes = await db.execute({
        sql: "SELECT cid FROM contacts WHERE (cid = ? OR LOWER(email) = LOWER(?)) AND deleted = 0 LIMIT 1",
        args: [row.rows[0].staff_id, row.rows[0].staff_id],
      });
      const contactCid = cidRes.rows[0]?.cid;
      if (contactCid) {
        await db.execute({
          sql: `UPDATE contact_roles
                SET is_current = false, ended_at = NOW(), status = 'removed'
                WHERE contact_cid = ? AND context_type = 'program' AND context_id = ? AND is_current = true`,
          args: [contactCid, String(row.rows[0].program_id)],
        });
      }
    } catch (_) {}
    await logFacilitatorTimeline(row.rows[0].staff_id, row.rows[0].program_id, "facilitator_removed", "Removed from program (assignment only — CRM record untouched)");
  }
  return NextResponse.json({ success: true });
});
