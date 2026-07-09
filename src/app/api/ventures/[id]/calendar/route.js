import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const tasks = await db.execute({ sql: "SELECT id, title, created_at, status FROM tasks WHERE venture_id = ? AND created_at IS NOT NULL ORDER BY created_at", args: [id] });
    const milestones = await db.execute({ sql: "SELECT id, title, target_date, status FROM venture_milestones WHERE venture_id = ? AND target_date IS NOT NULL ORDER BY target_date", args: [id] });

    const events = [
      ...(tasks.rows||[]).map(t => ({ type: "task", id: t.id, title: t.title, date: t.created_at, status: t.status })),
      ...(milestones.rows||[]).map(m => ({ type: "milestone", id: m.id, title: m.title, date: m.target_date, status: m.status })),
    ].sort((a,b) => (a.date||"").localeCompare(b.date||""));

    return NextResponse.json({ success: true, events });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
