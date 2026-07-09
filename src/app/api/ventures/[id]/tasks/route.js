import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","staff","program_manager","super_admin","teacher"];

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const { searchParams } = new URL(req.url);
    let sql = "SELECT t.*, c.name as creator_name FROM tasks t LEFT JOIN contacts c ON t.user_id = c.cid WHERE t.venture_id = ?";
    const args = [id];
    if (searchParams.get("status")) { sql += " AND t.status = ?"; args.push(searchParams.get("status")); }
    sql += " ORDER BY t.created_at DESC";
    const r = await db.execute({ sql, args });
    return NextResponse.json({ success: true, tasks: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const { title, description, parent_task_id, assigned_to, priority, due_date } = await req.json();
    if (!title) return NextResponse.json({ success: false, error: "title required" }, { status: 400 });
    await db.execute({
      sql: "INSERT INTO tasks (title, description, parent_task_id, assigned_to, priority, due_date, venture_id, user_id) VALUES (?,?,?,?,?,?,?,?)",
      args: [title, description||null, parent_task_id||null, assigned_to||null, priority||"medium", due_date||null, id, session.cid],
    });
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
