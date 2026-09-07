import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

// POST /api/venture-invites/consume — RETIRED (Phase 1)
//
// This endpoint used to let an external person create a Venture (plus a
// portal account/password) directly from a legacy invite link — bypassing
// the Forms/Runs review pipeline and risking duplicate identities.
//
// Retired. Venture registration now flows through the official Venture
// intake form/run: Form → Run → Submission → Review → Approval → Venture.
export async function POST(req) {
  try {
    await initDb();
    return NextResponse.json(
      {
        success: false,
        code: "LEGACY_FLOW_RETIRED",
        error:
          "This Venture registration flow is retired. Please use the official Venture application form link you received by email, or contact Future Studio.",
      },
      { status: 410 },
    );
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
