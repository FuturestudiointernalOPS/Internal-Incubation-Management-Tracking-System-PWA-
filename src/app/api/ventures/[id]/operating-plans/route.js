import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";

/**
 * GET /api/ventures/[id]/operating-plans — list plans (section counts)
 * POST — create a plan { name, objective }
 */
export const GET = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const access = await resolvePlanAccess(db, params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "view"))) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const r = await db.execute({
      sql: `SELECT p.*,
        (SELECT COUNT(*) FROM venture_plan_sections s WHERE s.plan_id = p.id) AS section_count,
        (SELECT COUNT(*) FROM venture_plan_sections s WHERE s.plan_id = p.id AND s.status = 'completed') AS completed_sections
        FROM venture_operating_plans p WHERE p.venture_id = ? ORDER BY p.created_at DESC`,
      args: [access.code],
    });
    const [canCreate, canEdit, canManage] = await Promise.all([
      allowsPlanAction(db, access, "create"),
      allowsPlanAction(db, access, "edit"),
      allowsPlanAction(db, access, "manage"),
    ]);
    return NextResponse.json({
      success: true,
      plans: r.rows || [],
      access: { create: canCreate, edit: canEdit, manage: canManage },
    });
  },
);

export const POST = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const access = await resolvePlanAccess(db, params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow creating operating plans." }, { status: 403 });
    }
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "name is required." }, { status: 400 });
    const res = await db.execute({
      sql: "INSERT INTO venture_operating_plans (venture_id, name, objective, created_by) VALUES (?,?,?,?) RETURNING id",
      args: [access.code, name, body.objective || null, session.cid || null],
    });
    const planId = res.rows?.[0]?.id ?? null;
    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: access.code, event_type: "OPERATING_PLAN_CREATED", description: `Operating plan "${name}" created` });
    } catch (_) {}
    return NextResponse.json({ success: true, id: planId });
  },
);
