import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/services/ventures/operatingPlans";
import {
  getVentureOperatingPlan,
  listVenturePlanSections,
  listVenturePlanLinks,
  updateVentureOperatingPlan,
  ventureOperatingPlanExists,
  archiveVentureOperatingPlan,
} from "@/models/ventureWorkspace";

async function loadPlan(db, access, planId) {
  const planResult = await getVentureOperatingPlan(planId, access.code);
  const plan = planResult.rows?.[0];
  if (!plan) return null;
  const sectionsResult = await listVenturePlanSections(planId);
  const sections = sectionsResult.rows || [];
  const linksResult = await listVenturePlanLinks(planId);
  const linksBySection = {};
  for (const link of linksResult.rows || []) {
    (linksBySection[link.section_id] = linksBySection[link.section_id] || []).push(link);
  }
  return { ...plan, sections: sections.map((section) => ({ ...section, links: linksBySection[section.id] || [] })) };
}

/**
 * GET  /api/ventures/[id]/operating-plans/[planId] — plan + sections + links
 * PATCH — { name?, objective?, status? } (status needs manage)
 * DELETE — archive the plan (needs manage)
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
    const plan = await loadPlan(db, access, params.planId);
    if (!plan) return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
    return NextResponse.json({ success: true, plan });
  },
);

export const PATCH = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const access = await resolvePlanAccess(params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const body = await req.json();
    const statusAction = body.status !== undefined;
    const fieldAction = body.name !== undefined || body.objective !== undefined;
    if ((statusAction && !(await allowsPlanAction(access, "manage"))) ||
        (fieldAction && !(await allowsPlanAction(access, "edit")))) {
      return NextResponse.json({ success: false, error: "Not allowed to update this plan." }, { status: 403 });
    }
    const updateResult = await updateVentureOperatingPlan({
      planId: params.planId,
      ventureCode: access.code,
      name: body.name ? String(body.name).trim() : null,
      objective: body.objective !== undefined ? (body.objective || null) : null,
      status: body.status || null,
    });
    if (!updateResult.rows?.length && updateResult.changes === 0) {
      const existsResult = await ventureOperatingPlanExists(params.planId, access.code);
      if (!existsResult.rows?.length) return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
    }
    const plan = await loadPlan(db, access, params.planId);
    if (body.status) {
      try {
        const { addVentureHistory } = await import("@/services/ventures/activity");
        await addVentureHistory({ venture_id: access.code, event_type: "OPERATING_PLAN_STATUS", description: `Operating plan status → ${body.status}` });
      } catch (_) {}
    }
    return NextResponse.json({ success: true, plan });
  },
);

export const DELETE = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const access = await resolvePlanAccess(params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(access, "manage"))) {
      return NextResponse.json({ success: false, error: "Not allowed to archive this plan." }, { status: 403 });
    }
    await archiveVentureOperatingPlan(params.planId, access.code);
    try {
      const { addVentureHistory } = await import("@/services/ventures/activity");
      await addVentureHistory({ venture_id: access.code, event_type: "OPERATING_PLAN_ARCHIVED", description: `Operating plan archived` });
    } catch (_) {}
    return NextResponse.json({ success: true });
  },
);
