import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "staff", "program_manager", "super_admin", "teacher", "developer"];
const ALLOWED = ["participant", "staff", "program_manager", "super_admin", "teacher"];

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const r = await db.execute({
      sql: `SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY target_date ASC NULLS LAST, created_at DESC`,
      args: [id],
    });
    return NextResponse.json({ success: true, milestones: r.rows || [] });
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

    const { title, description, target_date } = await req.json();
    if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

    await db.execute({
      sql: `INSERT INTO venture_milestones (venture_id, title, description, target_date, created_by)
            VALUES (?, ?, ?, ?, ?)`,
      args: [id, title, description || null, target_date || null, session.cid],
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

    const body = await req.json();
    const { milestone_id, title, description, target_date, progress, status } = body;
    if (!milestone_id) return NextResponse.json({ success: false, error: "milestone_id is required" }, { status: 400 });

    const updates = ["updated_at = NOW()"];
    const args = [];
    if (title !== undefined) { updates.push("title = ?"); args.push(title); }
    if (description !== undefined) { updates.push("description = ?"); args.push(description); }
    if (target_date !== undefined) { updates.push("target_date = ?"); args.push(target_date); }
    if (progress !== undefined) { updates.push("progress = ?"); args.push(progress); }
    if (status !== undefined) { updates.push("status = ?"); args.push(status); }
    if (updates.length <= 1) return NextResponse.json({ success: false, error: "No fields" }, { status: 400 });

    args.push(milestone_id, id);
    await db.execute({
      sql: `UPDATE venture_milestones SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
      args: args,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
