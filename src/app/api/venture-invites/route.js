import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

// POST /api/venture-invites — RETIRED (Phase 1)
//
// The legacy "shareable invite link → /register-venture" flow created
// Ventures outside the Forms/Runs pipeline. It has been retired. Use
// POST /api/platform/venture-invitations instead (sends the official
// Venture intake form/run URL; approval creates the Venture).
export async function POST(req) {
  try {
    await initDb();
    return NextResponse.json(
      {
        success: false,
        code: "LEGACY_FLOW_RETIRED",
        error:
          "This legacy Venture invite link flow is retired. Use the official Venture registration form link (Invite → sends the Venture intake URL).",
      },
      { status: 410 },
    );
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
