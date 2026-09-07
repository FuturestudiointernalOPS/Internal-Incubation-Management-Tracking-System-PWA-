import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction, applyTemplateToVenture } from "@/lib/ventureOperatingPlans";

/**
 * POST /api/venture-plan-templates/apply
 * { template_id, venture, name? } — apply a reusable template to a Venture.
 * Copies structure ONLY (sections); never Venture data, notes, reviews,
 * documents or history. Requires create access on the target Venture.
 */
export const POST = createHandler(
  async (req) => {
    await initDb();
    const session = await getSession();
    if (!session?.cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const body = await req.json();
    if (!body.template_id || !body.venture) {
      return NextResponse.json({ success: false, error: "template_id and venture are required." }, { status: 400 });
    }

    const access = await resolvePlanAccess(db, body.venture, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow creating operating plans." }, { status: 403 });
    }

    const result = await applyTemplateToVenture(db, {
      templateId: body.template_id,
      ventureCode: access.code,
      name: body.name || null,
      actorCid: session.cid,
    });
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    // Audit the application in the Venture's history.
    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: access.code, event_type: "OPERATING_PLAN_TEMPLATE_APPLIED", description: `Operating plan template applied` });
    } catch (_) {}

    return NextResponse.json({ success: true, id: result.id });
  },
);
