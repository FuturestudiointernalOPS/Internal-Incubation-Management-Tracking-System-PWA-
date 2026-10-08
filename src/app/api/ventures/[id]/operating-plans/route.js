import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { resolvePlanAccess, allowsPlanAction } from "@/services/ventures/operatingPlans";
import {
  listVentureOperatingPlans,
  insertVentureOperatingPlan,
} from "@/models/ventureWorkspace";

/**
 * GET /api/ventures/[id]/operating-plans — list plans (section counts)
 * POST — create a plan { name, objective }
 */
export const GET = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const access = await resolvePlanAccess(params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(access, "view"))) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    const plansResult = await listVentureOperatingPlans(access.code);
    const [canCreate, canEdit, canManage] = await Promise.all([
      allowsPlanAction(access, "create"),
      allowsPlanAction(access, "edit"),
      allowsPlanAction(access, "manage"),
    ]);
    return NextResponse.json({
      success: true,
      plans: plansResult.rows || [],
      access: { create: canCreate, edit: canEdit, manage: canManage },
    });
  },
);

export const POST = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const access = await resolvePlanAccess(params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow creating operating plans." }, { status: 403 });
    }
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "name is required." }, { status: 400 });
    const insertResult = await insertVentureOperatingPlan({
      ventureCode: access.code,
      name,
      objective: body.objective || null,
      createdBy: session.cid || null,
    });
    const planId = insertResult.rows?.[0]?.id ?? null;
    try {
      const { addVentureHistory } = await import("@/services/ventures/activity");
      await addVentureHistory({ venture_id: access.code, event_type: "OPERATING_PLAN_CREATED", description: `Operating plan "${name}" created` });
    } catch (_) {}
    return NextResponse.json({ success: true, id: planId });
  },
);
