import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  nextJourneyStageOrder,
} from "@/lib/ventureJourneys";

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
    const access = await resolvePlanAccess(db, id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow defining this Venture's journey." }, { status: 403 });
    }

    const body = await req.json();
    if (!body.template_id) {
      return NextResponse.json({ success: false, error: "template_id is required." }, { status: 400 });
    }

    const templateRes = await db.execute({
      sql: "SELECT id, name FROM venture_plan_templates WHERE id = ? AND is_active = TRUE",
      args: [body.template_id],
    });
    const template = templateRes.rows?.[0];
    if (!template) return NextResponse.json({ success: false, error: "Template not found or inactive." }, { status: 400 });

    const sectionRes = await db.execute({
      sql: "SELECT title, objective FROM venture_plan_template_sections WHERE template_id = ? ORDER BY sort_order, id",
      args: [template.id],
    });
    const sections = sectionRes.rows || [];
    if (sections.length === 0) return NextResponse.json({ success: false, error: "Template has no sections to generate a journey from." }, { status: 400 });

    const dbId = await resolveVentureInternalId(db, id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    await ensureJourneyTable(db);

    const existing = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM venture_journey_stages WHERE venture_id = ?",
      args: [dbId],
    });
    if (Number(existing.rows?.[0]?.n || 0) > 0) {
      return NextResponse.json({ success: false, error: "This Venture already has journey stages. Remove them first if you want to generate the journey from a template." }, { status: 409 });
    }

    let order = await nextJourneyStageOrder(db, dbId);
    for (let i = 0; i < sections.length; i++) {
      await db.execute({
        sql: `INSERT INTO venture_journey_stages (venture_id, name, description, stage_order, status, source_template_type, source_template_id)
              VALUES (?,?,?,?,?,?,?)`,
        args: [dbId, sections[i].title, sections[i].objective || null, order, i === 0 ? "active" : "locked", "plan", String(template.id)],
      });
      order += 1;
    }

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: id, event_type: "JOURNEY_TEMPLATE_APPLIED", description: `Journey generated from template "${template.name}"` });
    } catch (_) {}

    const stages = await listJourneyStages(db, dbId);
    return NextResponse.json({ success: true, stages });
  },
);
