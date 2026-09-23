import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getProjectInvitationById,
  cancelProjectInvitation,
  declineProjectInvitation,
  addProjectMemberFromInvitation,
  acceptProjectInvitation,
  getProjectNameForInvitation,
  getContactCidByName,
  createInvitationAcceptedNotification,
} from "@/models/projectCollaboration";

/**
 * POST /api/projects/invitations/respond
 * Body: { invitation_id, action: "accept" | "decline" | "cancel" }
 *
 * Accept: adds user to project_members + marks invitation accepted
 * Decline: marks invitation declined
 * Cancel: inviter cancels pending invitation
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

    // Fetch invitation
    const invitationResult = await getProjectInvitationById(invitation_id);
    if (invitationResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 },
      );
    }
    const invitation = invitationResult.rows[0];

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Invitation is no longer pending" },
        { status: 400 },
      );
    }

    if (action === "cancel") {
      // Only inviter can cancel
      if (session.name !== invitation.inviter_id && session.role !== "super_admin") {
        return NextResponse.json(
          { success: false, error: "Only the inviter can cancel" },
          { status: 403 },
        );
      }
      await cancelProjectInvitation(invitation_id);
      return NextResponse.json({ success: true, action: "cancelled" });
    }

    // Accept or decline: only the invitee
    const userCid = session.cid;
    if (invitation.invitee_id !== userCid) {
      return NextResponse.json(
        { success: false, error: "Only the invited user can respond" },
        { status: 403 },
      );
    }

    if (action === "decline") {
      await declineProjectInvitation(invitation_id);
      return NextResponse.json({ success: true, action: "declined" });
    }

    if (action === "accept") {
      // Add to project_members
      await addProjectMemberFromInvitation(
        invitation.project_id,
        invitation.invitee_id,
        invitation.role,
      );

      // Mark invitation accepted
      await acceptProjectInvitation(invitation_id);

      // Notify inviter
      const projectResult = await getProjectNameForInvitation(invitation.project_id);
      const projectName = projectResult.rows[0]?.name || "Unknown Project";

      // Find inviter's cid to send notification
      const inviterResult = await getContactCidByName(invitation.inviter_id);
      if (inviterResult.rows.length > 0) {
        await createInvitationAcceptedNotification(
          inviterResult.rows[0].cid,
          "Invitation Accepted",
          `${session.name || invitation.invitee_id} accepted your invitation to "${projectName}"`,
          "project_invite",
        );
      }

      return NextResponse.json({ success: true, action: "accepted" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("POST invitations/respond error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
