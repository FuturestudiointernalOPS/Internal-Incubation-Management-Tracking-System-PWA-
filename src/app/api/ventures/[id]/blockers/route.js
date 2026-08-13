import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","founder","staff","program_manager","super_admin","teacher"];

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const r = await db.execute({ sql: `SELECT b.*, c.name as creator_name FROM blockers b LEFT JOIN contacts c ON b.user_id = c.cid WHERE b.venture_id = ? ORDER BY b.created_at DESC`, args: [dbId] });
    return NextResponse.json({ success: true, blockers: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const { title, description, venture_retro_id, task_id, supporting_url } = await req.json();
    if (!venture_retro_id) return NextResponse.json({ success: false, error: "venture_retro_id required - blockers must come from a retro" }, { status: 400 });
    if (!title) return NextResponse.json({ success: false, error: "title required" }, { status: 400 });
    if (!task_id) return NextResponse.json({ success: false, error: "task_id required - blockers must be attached to a venture task" }, { status: 400 });
    const task = await db.execute({ sql: "SELECT id FROM venture_tasks WHERE id = ? AND venture_id = ?", args: [task_id, dbId] });
    if (!task.rows?.length) return NextResponse.json({ success: false, error: "task_id must reference a task belonging to this venture" }, { status: 400 });
    const contact = await db.execute({ sql: "SELECT name FROM contacts WHERE cid = ?", args: [session.cid] });
    // status defaults to 'active' at the DB level — this is the same status value
    // the existing Operations OS task-completion blocker-lock check filters on
    // (src/app/api/tasks/route.js), so this blocker correctly blocks completion
    // of the task it's attached to.
    try { await db.execute({ sql: "ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_task_id_fkey", args: [] }); } catch(e) {}
    try { await db.execute({ sql: "ALTER TABLE blockers ADD COLUMN IF NOT EXISTS supporting_url TEXT", args: [] }); } catch(e) {}
    await db.execute({
      sql: "INSERT INTO blockers (task_id, title, description, venture_id, venture_retro_id, status, user_id, user_name, supporting_url) VALUES (?,?,?,?,?,'active',?,?,?)",
      args: [task_id, title, description||null, dbId, venture_retro_id, session.cid, contact.rows?.[0]?.name || "", supporting_url||null],
    });
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function PATCH(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const { blocker_id, action } = await req.json();
    if (action === "resolve") {
      const b = await db.execute({ sql: "SELECT user_id FROM blockers WHERE id = ? AND venture_id = ?", args: [blocker_id, dbId] });
      if (!b.rows?.[0]) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      if (b.rows[0].user_id !== session.cid && !["staff","super_admin","program_manager"].includes(session.role)) {
        return NextResponse.json({ success: false, error: "Only the creator can resolve" }, { status: 403 });
      }
      await db.execute({ sql: "UPDATE blockers SET status='resolved', resolved_at=NOW(), resolved_by=? WHERE id=?", args: [session.cid, blocker_id] });
    }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
