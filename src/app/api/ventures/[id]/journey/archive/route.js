import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { ensureJourneyTable, resolveVentureInternalId, listJourneyStages } from "@/lib/ventureJourneys";
import { archiveJourneyStages, restoreJourneyStages } from "@/lib/ventureJourneyArchive";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/journey/archive
 * Body: { ids: [stageId...], action: "archive" | "restore" }
 *
 * Soft delete for whole journeys (stages). Archived journeys keep their
 * milestones/tasks/notes and can be restored. Filed work never blocks an
 * archive — hiding is exactly what archive is for. The UI asks for a DOUBLE
 * confirmation before calling this.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const access = await resolvePlanAccess(db, id, session);
    if (!access.ok) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "manage"))) {
      return NextResponse.json(
        { success: false, error: "Your assignment does not allow managing this Venture's journey." },
        { status: 403 },
      );
    }

    await ensureJourneyTable(db);
    const dbId = await resolveVentureInternalId(db, id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
    const action = body?.action === "restore" ? "restore" : "archive";
    if (ids.length === 0) return NextResponse.json({ success: false, error: "No journeys selected." }, { status: 400 });

    const summary =
      action === "restore"
        ? await restoreJourneyStages(db, { dbId, stageIds: ids })
        : await archiveJourneyStages(db, { dbId, stageIds: ids, actorCid: session.cid || null });

    const stages = await listJourneyStages(db, dbId, { includeArchived: true });
    return NextResponse.json({ success: true, ...summary, stages });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
