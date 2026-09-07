import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listPlanTemplates, createTemplateFromPlan } from "@/lib/ventureOperatingPlans";

const READ_ROLES = ["staff", "program_manager", "super_admin", "developer", "admin"];
const WRITE_ROLES = ["super_admin", "developer", "admin"];

/**
 * GET /api/venture-plan-templates — list reusable plan templates.
 * POST { plan_id, name?, description? } — save a live plan (structure only).
 * PATCH { id, is_active } — activate/deactivate (Super Admin).
 */
export const GET = createHandler(
  { roles: READ_ROLES },
  async () => {
    await initDb();
    const templates = await listPlanTemplates(db, { activeOnly: true });
    return NextResponse.json({ success: true, templates });
  },
);

export const POST = createHandler(
  async (req) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const body = await req.json();
    const planId = body.plan_id;
    if (!planId) return NextResponse.json({ success: false, error: "plan_id is required." }, { status: 400 });

    // Guard: only someone who manages the plan's Venture may save it as a
    // platform template. Resolve the Venture from the plan row.
    const planRes = await db.execute({ sql: "SELECT venture_id, name FROM venture_operating_plans WHERE id = ?", args: [planId] });
    const plan = planRes.rows?.[0];
    if (!plan) return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });

    const { resolvePlanAccess, allowsPlanAction } = await import("@/lib/ventureOperatingPlans");
    const access = await resolvePlanAccess(db, plan.venture_id, session);
    if (!access.ok || !(await allowsPlanAction(db, access, "manage"))) {
      return NextResponse.json({ success: false, error: "Only staff managing this Venture can save it as a template." }, { status: 403 });
    }

    const result = await createTemplateFromPlan(db, {
      planId,
      name: body.name || plan.name,
      description: body.description || null,
      actorCid: session.cid,
    });
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, id: result.id });
  },
);

export const PATCH = createHandler(
  { roles: WRITE_ROLES },
  async (req) => {
    await initDb();
    const body = await req.json();
    if (!body.id || typeof body.is_active !== "boolean") {
      return NextResponse.json({ success: false, error: "id and is_active are required." }, { status: 400 });
    }
    await db.execute({ sql: "UPDATE venture_plan_templates SET is_active = ?, updated_at = NOW() WHERE id = ?", args: [body.is_active ? 1 : 0, body.id] });
    return NextResponse.json({ success: true });
  },
);
