import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];
const ALLOWED = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const r = await db.execute({
      sql: `SELECT * FROM venture_validations WHERE venture_id = ? ORDER BY created_at DESC`,
      args: [dbId],
    });
    return NextResponse.json({ success: true, validations: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ALLOWED);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { validation_type, status, notes } = await req.json();
    if (!validation_type) {
      return NextResponse.json({ success: false, error: "validation_type is required" }, { status: 400 });
    }
    if (!["problem", "solution", "product"].includes(validation_type)) {
      return NextResponse.json({ success: false, error: "validation_type must be problem/solution/product" }, { status: 400 });
    }
    await db.execute({
      sql: `INSERT INTO venture_validations (venture_id, validation_type, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?)`,
      args: [dbId, validation_type, status || "in_progress", notes || null, session.cid],
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ALLOWED);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const { validation_id, status, notes } = body;
    if (!validation_id) {
      return NextResponse.json({ success: false, error: "validation_id is required" }, { status: 400 });
    }
    const updates = ["updated_at = NOW()"];
    const args = [];
    if (status !== undefined) { updates.push("status = ?"); args.push(status); }
    if (notes !== undefined) { updates.push("notes = ?"); args.push(notes); }
    if (updates.length <= 1) {
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    }
    args.push(validation_id, dbId);
    await db.execute({
      sql: `UPDATE venture_validations SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
      args: args,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
