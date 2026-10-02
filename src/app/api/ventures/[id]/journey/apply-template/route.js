import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/services/ventures/operatingPlans";
import {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  nextJourneyStageOrder,
} from "@/services/ventures/journey";
import {
  getActiveVenturePlanTemplate,
  listVenturePlanTemplateSections,
  countVentureJourneyStages,
  insertJourneyStageFromTemplate,
} from "@/models/ventureWorkspace";

/**
 * POST /api/ventures/[id]/journey/apply-template
 * { template_id } — generate the Venture's Journey from a reusable
 * operating-plan template.
 *
 * Copies STRUCTURE only (section title -> stage name, section objective ->
 * stage description). Never copies plans' internal data, notes, documents,
 * reviews or history. Authorized staff may modify the generated journey
 * afterwards from the journey manager.
 *
 * Auth: same as journey authoring — `operating_plan` create capability on a
 * venture-wide assignment (or a global role). Founders/members get 404.
 */
export const POST = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const { id } = await params;
    const access = await resolvePlanAccess(id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow defining this Venture's journey." }, { status: 403 });
    }

    const body = await req.json();
    if (!body.template_id) {
      return NextResponse.json({ success: false, error: "template_id is required." }, { status: 400 });
    }

    const templateResult = await getActiveVenturePlanTemplate(body.template_id);
    const template = templateResult.rows?.[0];
    if (!template) return NextResponse.json({ success: false, error: "Template not found or inactive." }, { status: 400 });

    const sectionsResult = await listVenturePlanTemplateSections(template.id);
    const sections = sectionsResult.rows || [];
    if (sections.length === 0) return NextResponse.json({ success: false, error: "Template has no sections to generate a journey from." }, { status: 400 });

    const dbId = await resolveVentureInternalId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    await ensureJourneyTable();

    const existing = await countVentureJourneyStages(dbId);
    if (Number(existing.rows?.[0]?.n || 0) > 0) {
      return NextResponse.json({ success: false, error: "This Venture already has journey stages. Remove them first if you want to generate the journey from a template." }, { status: 409 });
    }

    let order = await nextJourneyStageOrder(dbId);
    for (let i = 0; i < sections.length; i++) {
      await insertJourneyStageFromTemplate({
        dbId,
        name: sections[i].title,
        description: sections[i].objective || null,
        stageOrder: order,
        status: i === 0 ? "active" : "upcoming",
        templateType: "plan",
        templateId: String(template.id),
      });
      order += 1;
    }

    try {
      const { addVentureHistory } = await import("@/services/ventures/activity");
      await addVentureHistory({ venture_id: id, event_type: "JOURNEY_TEMPLATE_APPLIED", description: `Journey generated from template "${template.name}"` });
    } catch (_) {}

    // Managers keep their Archived view in sync (same rule as GET).
    const canManage = await allowsPlanAction(access, "manage");
    const stages = await listJourneyStages(dbId, { includeArchived: canManage });
    return NextResponse.json({ success: true, stages });
  },
);
