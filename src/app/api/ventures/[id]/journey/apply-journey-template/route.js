import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { ensureJourneyTable, resolveVentureInternalId, listJourneyStages } from "@/lib/ventureJourneys";
import { applyJourneyTemplate } from "@/lib/ventureJourneyTemplates";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/journey/apply-journey-template
 * { template_id } — generate this Venture's journey from a saved Journey
 * template (structure only). The first stage starts active; the rest are
 * locked until the manager activates them. Fails (409) if the Venture
 * already has journey stages.
 *
 * Auth: same as journey authoring — `operating_plan` create capability.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(db, id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow defining this Venture's journey." }, { status: 403 });
    }

    const body = await req.json();
    if (!body.template_id) {
      return NextResponse.json({ success: false, error: "template_id is required." }, { status: 400 });
    }

    await ensureJourneyTable(db);
    const dbId = await resolveVentureInternalId(db, id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const result = await applyJourneyTemplate(db, { dbId, templateId: String(body.template_id), actorCid: session.cid || null });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.error.startsWith("This Venture already") ? 409 : 400 });
    }

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({
        venture_id: id,
        event_type: "JOURNEY_TEMPLATE_APPLIED",
        description: `Journey generated from saved template (${result.stages} stages, ${result.milestones} milestones, ${result.tasks} tasks)`,
      });
    } catch (_) {}

    const stages = await listJourneyStages(db, dbId);
    return NextResponse.json({ success: true, stages, ...result });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
