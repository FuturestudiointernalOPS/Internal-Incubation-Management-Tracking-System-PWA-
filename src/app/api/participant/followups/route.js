import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { buildParticipantFollowups } from "@/services/participant";

/**
 * PARTICIPANT FOLLOW-UPS API
 * Returns follow-up meetings for the authenticated participant. The merge and
 * shaping decisions live in the participant service.
 */
export const GET = createHandler(async (_req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const followups = await buildParticipantFollowups(session.cid);

  return NextResponse.json({ success: true, followups });
});
