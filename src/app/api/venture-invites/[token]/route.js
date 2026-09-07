import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

// GET /api/venture-invites/[token] — RETIRED (Phase 1)
//
// Legacy /register-venture links no longer participate in Venture intake.
// The page still calls this endpoint to validate an old link; it now
// returns a clear retired message instead of validating.
export async function GET() {
  try {
    await initDb();
    return NextResponse.json(
      {
        success: false,
        code: "LEGACY_FLOW_RETIRED",
        error:
          "This Venture registration link is retired. Please use the official Venture application form link you received by email, or contact Future Studio.",
      },
      { status: 410 },
    );
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
