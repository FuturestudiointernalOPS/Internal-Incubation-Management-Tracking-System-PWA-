import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { listProjectInvitations } from "@/services/projects/collaboration";

/**
 * PROJECT INVITATIONS API — controller layer.
 *
 * GET /api/projects/invitations?invitee_id=X&status=pending&project_id=Y
 *
 * The scope rule (portfolio roles see everyone, others only their own) and the
 * "pending by default" policy live in `@/services/projects/collaboration`.
 */
export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const { getSession } = await import("@/server/auth/session");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  const result = await listProjectInvitations({
    role: session.role,
    sessionCid: session.cid,
    inviteeId: searchParams.get("invitee_id"),
    status: searchParams.get("status"),
    projectId: searchParams.get("project_id"),
  });

  if (result.error) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, invitations: result.invitations });
});
