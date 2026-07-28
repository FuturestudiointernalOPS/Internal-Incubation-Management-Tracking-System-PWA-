import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const tasksRes = await db.execute({ sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM venture_tasks WHERE venture_id = ?", args: [dbId] });
    const total = parseInt(tasksRes.rows?.[0]?.total||0);
    const done = parseInt(tasksRes.rows?.[0]?.done||0);

    const milestonesRes = await db.execute({ sql: "SELECT AVG(progress) as avg_progress FROM venture_milestones WHERE venture_id = ?", args: [dbId] });

    const standupsRes = await db.execute({ sql: "SELECT COUNT(*) as count FROM venture_standups WHERE venture_id = ?", args: [dbId] });
    const retrosRes = await db.execute({ sql: "SELECT COUNT(*) as count FROM venture_retros WHERE venture_id = ?", args: [dbId] });

    return NextResponse.json({
      success: true,
      progress: {
        task_completion: total > 0 ? Math.round((done/total)*100) : 0,
        total_tasks: total,
        completed_tasks: done,
        avg_milestone_progress: Math.round(parseFloat(milestonesRes.rows?.[0]?.avg_progress||0)),
        standups_count: parseInt(standupsRes.rows?.[0]?.count||0),
        retros_count: parseInt(retrosRes.rows?.[0]?.count||0),
      }
    });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
