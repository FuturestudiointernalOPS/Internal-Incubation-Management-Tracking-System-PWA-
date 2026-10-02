import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/services/ventures/operatingPlans";
import {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
} from "@/services/ventures/journey";
import { duplicateJourneyStage } from "@/services/ventures/duplication";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/journey/duplicate
 * { stage_id } — duplicate a Journey stage as an independent structure copy.
 *
 * The copy is inserted directly after the source stage, starts 'upcoming'
 * (its own start date activates it, or the manager does) and carries fresh
 * milestone/task copies. Execution history (submissions, reviews, comments,
 * activity) is NEVER copied — the source keeps its history, the copy starts
 * clean.
 *
 * Auth: same as journey management — `operating_plan` manage capability on
 * a venture-wide assignment (or a global role). Members get 404.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(access, "manage"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow managing this Venture's journey." }, { status: 403 });
    }

    const body = await req.json();
    const stageId = body.stage_id ? String(body.stage_id) : null;
    if (!stageId) return NextResponse.json({ success: false, error: "stage_id is required." }, { status: 400 });

    await ensureJourneyTable();
    const dbId = await resolveVentureInternalId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const result = await duplicateJourneyStage({ dbId, stageId, actorCid: session.cid || null });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.error === "Stage not found." ? 404 : 400 });
    }

    try {
      const { addVentureHistory } = await import("@/services/ventures/activity");
      await addVentureHistory({
        venture_id: id,
        event_type: "JOURNEY_STAGE_DUPLICATED",
        description: `Journey stage "${result.stage.name}" duplicated with its milestones and tasks (structure only)`,
      });
    } catch (_) {}

    // Caller holds manage (see gate above) — include archived rows so the
    // manager's Archived view stays in sync after duplicating.
    const stages = await listJourneyStages(dbId, { includeArchived: true });
    return NextResponse.json({ success: true, stage: result.stage, stages, milestones_copied: result.milestones_copied, tasks_copied: result.tasks_copied });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
