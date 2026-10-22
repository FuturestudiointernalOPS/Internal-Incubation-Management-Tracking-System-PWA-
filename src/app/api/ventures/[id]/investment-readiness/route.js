import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { computeRoadmapReadiness } from "@/services/ventures/readiness";
import { getDataRoomReadiness } from "@/services/ventures/dataRoom/readiness";
import { getInvestmentReadinessVentureId } from "@/models/ventureJourney";

/**
 * GET /api/ventures/[id]/investment-readiness
 *
 * TWO INDICATORS, DELIBERATELY SEPARATE — never one number pretending to be
 * both (docs: WS4 audit).
 *
 *   roadmap_readiness     — how much of the planned journey / milestone / task /
 *                           deliverable work is complete (30/30/25/15, renormalised
 *                           over the components the Venture actually defines).
 *   data_room_readiness   — INVESTMENT READINESS: the Venture's `required` Data
 *                           Room categories that are filed and verified. Computed
 *                           by the Data Room's own engine
 *                           (`computeDataRoomCompleteness`), so this endpoint and
 *                           the Data Room screen can never disagree.
 *
 * The former hard-coded eight-document checklist is GONE. It matched document
 * categories by substring against a vocabulary the Data Room does not use, so a
 * Venture filing its documents properly could never satisfy it. The Data Room's
 * configured requirements replace it, and they are editable per Venture and per
 * business stage.
 */
async function resolveVentureDbId(ventureId) {
  const ventureResult = await getInvestmentReadinessVentureId(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const [roadmap, dataRoom] = await Promise.all([
      computeRoadmapReadiness({ dbId, code: id }),
      // A failed Data Room read answers null (unknown), never 0% — the screen
      // shows « — » instead of accusing the Venture of filing nothing.
      getDataRoomReadiness(id).catch(() => null),
    ]);

    return NextResponse.json({
      success: true,
      roadmap_readiness: roadmap,
      data_room_readiness: dataRoom,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
