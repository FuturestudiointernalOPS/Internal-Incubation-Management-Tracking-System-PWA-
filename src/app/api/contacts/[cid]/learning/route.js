import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { getLearnerJourney } from "@/lib/lms/journey";

export const dynamic = "force-dynamic";

/**
 * GET /api/contacts/[cid]/learning
 *
 * CRM read surface for one person's full LMS journey: enrolled courses with
 * LMS-derived progress, certificates, and purchases (empty until a commerce
 * table ships — see docs/PHASE6_7_REPORT.md). Requires contacts.view.
 *
 * All values are read from the LMS (single source of truth) — the CRM never
 * stores or recalculates learning progress.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("contacts", "view");
    if (capError) return capError;

    const { cid } = await params;
    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    const learning = await getLearnerJourney(cid);
    return NextResponse.json({ success: true, learning });
  } catch (error) {
    console.error("[Contact learning] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
