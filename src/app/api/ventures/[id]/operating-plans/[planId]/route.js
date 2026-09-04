import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";

async function loadPlan(db, access, planId) {
  const p = await db.execute({ sql: "SELECT * FROM venture_operating_plans WHERE id = ? AND venture_id = ?", args: [planId, access.code] });
  const plan = p.rows?.[0];
  if (!plan) return null;
  const s = await db.execute({
    sql: "SELECT * FROM venture_plan_sections WHERE plan_id = ? ORDER BY sort_order, id",
    args: [planId],
  });
  const sections = s.rows || [];
  const linksRes = await db.execute({
    sql: `SELECT l.* FROM venture_plan_links l
          JOIN venture_plan_sections s ON s.id = l.section_id
          WHERE s.plan_id = ? ORDER BY l.id`,
    args: [planId],
  });
  const linksBySection = {};
  for (const l of linksRes.rows || []) {
    (linksBySection[l.section_id] = linksBySection[l.section_id] || []).push(l);
  }
  return { ...plan, sections: sections.map((sec) => ({ ...sec, links: linksBySection[sec.id] || [] })) };
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
    const access = await resolvePlanAccess(db, params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "view"))) {
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
    const access = await resolvePlanAccess(db, params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const body = await req.json();
    const statusAction = body.status !== undefined;
    const fieldAction = body.name !== undefined || body.objective !== undefined;
    if ((statusAction && !(await allowsPlanAction(db, access, "manage"))) ||
        (fieldAction && !(await allowsPlanAction(db, access, "edit")))) {
      return NextResponse.json({ success: false, error: "Not allowed to update this plan." }, { status: 403 });
    }
    const res = await db.execute({
      sql: "UPDATE venture_operating_plans SET name = COALESCE(?, name), objective = COALESCE(?, objective), status = COALESCE(?, status), updated_at = NOW() WHERE id = ? AND venture_id = ?",
      args: [body.name ? String(body.name).trim() : null, body.objective !== undefined ? (body.objective || null) : null, body.status || null, params.planId, access.code],
    });
    if (!res.rows?.length && res.changes === 0) {
      const exists = await db.execute({ sql: "SELECT id FROM venture_operating_plans WHERE id = ? AND venture_id = ?", args: [params.planId, access.code] });
      if (!exists.rows?.length) return NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 });
    }
    const plan = await loadPlan(db, access, params.planId);
    return NextResponse.json({ success: true, plan });
  },
);

export const DELETE = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const access = await resolvePlanAccess(db, params.id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "manage"))) {
      return NextResponse.json({ success: false, error: "Not allowed to archive this plan." }, { status: 403 });
    }
    await db.execute({ sql: "UPDATE venture_operating_plans SET status = 'archived', updated_at = NOW() WHERE id = ? AND venture_id = ?", args: [params.planId, access.code] });
    return NextResponse.json({ success: true });
  },
);
