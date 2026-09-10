import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  getVentureDbIdForActionPlans,
  insertVentureActionPlan,
  listVentureActionPlans,
  updateVentureActionPlanFields,
} from "@/models/ventureWorkspace";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];
const ALLOWED = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher"];

async function resolveVentureDbId(ventureId) {
  const r = await getVentureDbIdForActionPlans(ventureId);
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const access = await requireVentureScopedAccess({ db, ventureId: id, module: "ventures", capability: "view", legacyRoles: ROLES });
    if (access.error) return access.error;
    const { session } = access;
    const { id } = await params;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const milestoneId = searchParams.get("milestone_id");

    const r = await listVentureActionPlans(dbId, milestoneId);
    return NextResponse.json({ success: true, action_plans: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const access = await requireVentureScopedAccess({ db, ventureId: id, module: "ventures", capability: "edit", legacyRoles: ALLOWED });
    if (access.error) return access.error;
    const { session } = access;
    const { id } = await params;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { milestone_id, title, priority, deadline, owner_contact_id } = await req.json();
    if (!title) return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });

    await insertVentureActionPlan({ venture_id: dbId, milestone_id, title, priority, deadline, owner_contact_id, created_by: session.cid });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const access = await requireVentureScopedAccess({ db, ventureId: id, module: "ventures", capability: "edit", legacyRoles: ALLOWED });
    if (access.error) return access.error;
    const { session } = access;
    const { id } = await params;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

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
    await updateVentureActionPlanFields(updates, args);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
