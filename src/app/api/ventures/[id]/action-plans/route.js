import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "staff", "program_manager", "super_admin", "teacher", "developer"];
const ALLOWED = ["participant", "staff", "program_manager", "super_admin", "teacher"];

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

    const { searchParams } = new URL(req.url);
    const milestoneId = searchParams.get("milestone_id");

    let sql, args;
    if (milestoneId) {
      sql = `SELECT ap.*, c.name as owner_name FROM venture_action_plans ap LEFT JOIN contacts c ON ap.owner_contact_id = c.cid WHERE ap.venture_id = ? AND ap.milestone_id = ? ORDER BY ap.created_at DESC`;
      args = [dbId, milestoneId];
    } else {
      sql = `SELECT ap.*, c.name as owner_name FROM venture_action_plans ap LEFT JOIN contacts c ON ap.owner_contact_id = c.cid WHERE ap.venture_id = ? ORDER BY ap.created_at DESC`;
      args = [dbId];
    }
    const r = await db.execute({ sql, args });
    return NextResponse.json({ success: true, action_plans: r.rows || [] });
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

    const { milestone_id, title, priority, deadline, owner_contact_id } = await req.json();
    if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

    await db.execute({
      sql: `INSERT INTO venture_action_plans (venture_id, milestone_id, title, priority, deadline, owner_contact_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [dbId, milestone_id || null, title, priority || "medium", deadline || null, owner_contact_id || null, session.cid],
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
    const { plan_id, title, priority, deadline, owner_contact_id, status } = body;
    if (!plan_id) return NextResponse.json({ success: false, error: "plan_id is required" }, { status: 400 });

    const updates = [];
    const args = [];
    if (title !== undefined) { updates.push("title = ?"); args.push(title); }
    if (priority !== undefined) { updates.push("priority = ?"); args.push(priority); }
    if (deadline !== undefined) { updates.push("deadline = ?"); args.push(deadline); }
    if (owner_contact_id !== undefined) { updates.push("owner_contact_id = ?"); args.push(owner_contact_id); }
    if (status !== undefined) { updates.push("status = ?"); args.push(status); }
    if (!updates.length) return NextResponse.json({ success: false, error: "No fields" }, { status: 400 });

    args.push(plan_id, dbId);
    await db.execute({
      sql: `UPDATE venture_action_plans SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
      args: args,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
