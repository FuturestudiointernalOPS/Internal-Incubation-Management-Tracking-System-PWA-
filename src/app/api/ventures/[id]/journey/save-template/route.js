import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { ensureJourneyTable, resolveVentureInternalId } from "@/lib/ventureJourneys";
import { saveJourneyAsTemplate } from "@/lib/ventureJourneyTemplates";
import { ensureVentureSchema } from "@/lib/ventures";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/journey/save-template
 * { name?, description? } — save this Venture's ENTIRE journey (all stages +
 * bound milestones + top-level tasks) as a reusable template in the ImpactOS
 * template library. Structure only: submissions/reviews/history/dates are
 * never copied. Applying the template to another Venture creates fresh rows.
 *
 * Auth: `operating_plan` manage capability (same as journey management).
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(db, id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "manage"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow saving this Venture's journey as a template." }, { status: 403 });
    }

    const body = await req.json();
    const name = body.name ? String(body.name).trim() : "";
    const description = body.description ? String(body.description).trim() : null;

    // Self-heal: the journey/template tables and the milestone columns this
    // feature reads (journey_stage_id etc.) ship inside ensureVentureSchema(),
    // which only runs on Venture intake elsewhere. Environments whose schema
    // predates those migrations must not fail here — ensure once per call is
    // idempotent and cheap for an occasional admin action.
    try {
      await ensureVentureSchema();
    } catch (_) {
      // Best effort — the save below reports the real error if the schema
      // still cannot support it.
    }
    await ensureJourneyTable(db);
    const dbId = await resolveVentureInternalId(db, id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const result = await saveJourneyAsTemplate(db, { dbId, name, description, actorCid: session.cid || null });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({
        venture_id: id,
        event_type: "JOURNEY_TEMPLATE_SAVED",
        description: `Journey saved as template "${result.name}" (${result.stages} stages, ${result.milestones} milestones, ${result.tasks} tasks — structure only)`,
      });
    } catch (_) {}

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = String((e && e.message) || e || "Unknown error");
    // Environments whose Venture schema was never migrated return raw Postgres
    // "relation/column does not exist" text — surface a short, actionable
    // message instead of the raw engine error.
    const missingSchema = /does not exist|undefined column|relation .* does not exist/i.test(msg);
    return NextResponse.json(
      {
        success: false,
        error: missingSchema
          ? "Journey data is not fully set up in this database yet — retry once (the app self-heals the schema) and contact an admin if it persists."
          : msg.length > 240
            ? `${msg.slice(0, 240)}…`
            : msg,
      },
      { status: 500 },
    );
  }
}
