import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { ensureJourneyTable, resolveVentureInternalId, listJourneyStages } from "@/lib/ventureJourneys";
import { applyJourneyTemplate } from "@/lib/ventureJourneyTemplates";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/journey/apply-journey-template
 * { template_id } — generate journey stages from a saved Journey template
 * (structure only). On a Venture with no journey yet, the first stage starts
 * active and the rest wait upcoming; on a Venture already under way, the new
 * stages CONTINUE the numbering and all arrive upcoming, so nothing opens
 * itself on top of work in flight.
 *
 * Auth: same as journey authoring — `operating_plan` create capability.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow defining this Venture's journey." }, { status: 403 });
    }

    const body = await req.json();
    if (!body.template_id) {
      return NextResponse.json({ success: false, error: "template_id is required." }, { status: 400 });
    }

    await ensureJourneyTable();
    const dbId = await resolveVentureInternalId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const result = await applyJourneyTemplate({ dbId, templateId: String(body.template_id), actorCid: session.cid || null });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({
        venture_id: id,
        event_type: "JOURNEY_TEMPLATE_APPLIED",
        description: `Journey generated from saved template (${result.stages} stages, ${result.milestones} milestones, ${result.tasks} tasks)`,
      });
    } catch (_) {}

    // Managers keep their Archived view in sync (same rule as GET).
    const canManage = await allowsPlanAction(access, "manage");
    const stages = await listJourneyStages(dbId, { includeArchived: canManage });
    return NextResponse.json({ success: true, stages, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
