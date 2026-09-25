import { NextResponse } from "next/server";

/**
 * POST /api/investor/register
 *
 * RETIRED: investor intake now flows through the Forms/Runs pipeline
 * (Investor Application form → Run → Submission → Review → Approval →
 * investor account). The fixed questionnaire it backed is gone.
 *
 * Kept as an explicit 410 so a stale link or bookmark gets a clear answer
 * instead of a silent 404. Public (no session): the old flow was anonymous, and
 * the retirement message is the same for everyone.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: "LEGACY_FLOW_RETIRED",
      error: "Investor self-registration is retired. Use the investor application link shared by the team.",
    },
    { status: 410 },
  );
}
