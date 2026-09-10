import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  addSupportingUrlColumnToBlockers,
  dropBlockersTaskForeignKeyIfExists,
  getContactNameByCid,
  getVentureBlockerCreator,
  getVentureDbIdForBlockers,
  getVentureTaskByVentureId,
  insertVentureBlocker,
  listVentureBlockersWithCreators,
  resolveVentureBlocker,
} from "@/models/ventureWorkspace";

async function resolveVentureDbId(ventureId) {
  const r = await getVentureDbIdForBlockers(ventureId);
  return r.rows?.[0]?.id || null;
}

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","founder","staff","program_manager","super_admin","teacher"];

export async function GET(req, { params }) {
  try { await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ db, ventureId: id, module: "ventures", capability: "view", legacyRoles: ROLES });
    if (access.error) return access.error;
    const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const r = await listVentureBlockersWithCreators(dbId);
    return NextResponse.json({ success: true, blockers: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ db, ventureId: id, module: "ventures", capability: "edit", legacyRoles: ALLOWED });
    if (access.error) return access.error;
    const { session } = access;
    const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { title, description, venture_retro_id, task_id, supporting_url } = await req.json();
    if (!venture_retro_id) return NextResponse.json({ success: false, error: "venture_retro_id required - blockers must come from a retro" }, { status: 400 });
    if (!title) return NextResponse.json({ success: false, error: "title required" }, { status: 400 });
    if (!task_id) return NextResponse.json({ success: false, error: "task_id required - blockers must be attached to a venture task" }, { status: 400 });
    const task = await getVentureTaskByVentureId(task_id, dbId);
    if (!task.rows?.length) return NextResponse.json({ success: false, error: "task_id must reference a task belonging to this venture" }, { status: 400 });
    const contact = await getContactNameByCid(session.cid);
    // status defaults to 'active' at the DB level — this is the same status value
    // the existing Operations OS task-completion blocker-lock check filters on
    // (src/app/api/tasks/route.js), so this blocker correctly blocks completion
    // of the task it's attached to.
    try { await dropBlockersTaskForeignKeyIfExists(); } catch(e) {}
    try { await addSupportingUrlColumnToBlockers(); } catch(e) {}
    await insertVentureBlocker({ task_id, title, description, venture_id: dbId, venture_retro_id, user_id: session.cid, user_name: contact.rows?.[0]?.name, supporting_url });
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function PATCH(req, { params }) {
  try { await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ db, ventureId: id, module: "ventures", capability: "edit", legacyRoles: ALLOWED });
    if (access.error) return access.error;
    const { session } = access;
    const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { blocker_id, action } = await req.json();
    if (action === "resolve") {
      const b = await getVentureBlockerCreator(blocker_id, dbId);
      if (!b.rows?.[0]) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      if (b.rows[0].user_id !== session.cid && !["staff","super_admin","program_manager"].includes(session.role)) {
        return NextResponse.json({ success: false, error: "Only the creator can resolve" }, { status: 403 });
      }
      await resolveVentureBlocker(blocker_id, session.cid);
    }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
