import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { ensureJourneyTable, resolveVentureInternalId, listJourneyStages } from "@/lib/ventureJourneys";
import { deleteJourneyStages } from "@/lib/ventureJourneyArchive";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/journey/delete
 * Body: { ids: [stageId...] }
 *
 * Permanent delete of whole journeys (stage + its milestone/task structure).
 * A journey with filed work (submissions, reviews, deliverables) is BLOCKED
 * and reported back — archive it instead. The UI asks for a DOUBLE
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
    if (ids.length === 0) return NextResponse.json({ success: false, error: "No journeys selected." }, { status: 400 });

    const summary = await deleteJourneyStages(db, { dbId, stageIds: ids });
    const stages = await listJourneyStages(db, dbId, { includeArchived: true });
    return NextResponse.json({ success: true, ...summary, stages });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
