import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { respondToProjectInvitation } from "@/services/projects/collaboration";

/**
 * POST /api/projects/invitations/respond — controller layer.
 * Body: { invitation_id, action: "accept" | "decline" | "cancel" }
 *
 * Accept: adds user to project_members + marks invitation accepted
 * Decline: marks invitation declined
 * Cancel: inviter cancels pending invitation
 *
 * The permission rules (only the inviter cancels, only the invitee responds)
 * and the accept flow live in `@/services/projects/collaboration`.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { invitation_id, action } = await req.json();

    if (!invitation_id || !action) {
      return NextResponse.json(
        { success: false, error: "invitation_id and action are required" },
        { status: 400 },
      );
    }

    const result = await respondToProjectInvitation({
      invitationId: invitation_id,
      action,
      sessionCid: session.cid,
      sessionName: session.name,
      role: session.role,
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, action: result.action });
  } catch (error) {
    console.error("POST invitations/respond error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
