// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

async function logFacilitatorTimeline(staffId, programId, eventType, description, extra = {}) {
  try {
    const session = await getSession();
    await db.execute({
      sql: "INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata) VALUES (?, ?, ?, 'programs', ?, ?, ?::jsonb)",
      args: [staffId, eventType, description, String(programId || ""), session?.cid || "system", JSON.stringify(extra)],
    });
  } catch (_) {}
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
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
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
    const { program_id, staff_id, role } = await req.json();

    const res = await db.execute({
      sql: "INSERT INTO v2_program_staff (program_id, staff_id, role) VALUES (?, ?, ?) ON CONFLICT (program_id, staff_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW() RETURNING id",
      args: [program_id, staff_id, role || "staff"],
    });
    if (String(role || "").toLowerCase() === "facilitator") {
      await logFacilitatorTimeline(staff_id, program_id, "facilitator_assigned", "Assigned as facilitator to program", { role });
    }

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
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
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
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
