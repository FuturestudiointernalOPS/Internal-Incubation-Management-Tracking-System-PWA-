import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

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
    const invRes = await db.execute({
      sql: "SELECT * FROM project_invitations WHERE id = ?",
      args: [parseInt(invitation_id)],
    });
    if (invRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 },
      );
    }
    const inv = invRes.rows[0];

    if (inv.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Invitation is no longer pending" },
        { status: 400 },
      );
    }

    if (action === "cancel") {
      // Only inviter can cancel
      if (session.name !== inv.inviter_id && session.role !== "super_admin") {
        return NextResponse.json(
          { success: false, error: "Only the inviter can cancel" },
          { status: 403 },
        );
      }
      await db.execute({
        sql: "UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE id = ?",
        args: [parseInt(invitation_id)],
      });
      return NextResponse.json({ success: true, action: "cancelled" });
    }

    // Accept or decline: only the invitee
    const userCid = session.cid;
    if (inv.invitee_id !== userCid) {
      return NextResponse.json(
        { success: false, error: "Only the invited user can respond" },
        { status: 403 },
      );
    }

    if (action === "decline") {
      await db.execute({
        sql: "UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE id = ?",
        args: [parseInt(invitation_id)],
      });
      return NextResponse.json({ success: true, action: "declined" });
    }

    if (action === "accept") {
      // Add to project_members
      await db.execute({
        sql: `INSERT INTO project_members (project_id, user_cid, role, assigned_at)
              VALUES (?, ?, ?, NOW())
              ON CONFLICT (project_id, user_cid)
              DO UPDATE SET role = ?, assigned_at = NOW()`,
        args: [inv.project_id, inv.invitee_id, inv.role || "member", inv.role || "member"],
      });

      // Mark invitation accepted
      await db.execute({
        sql: "UPDATE project_invitations SET status = 'accepted', responded_at = NOW() WHERE id = ?",
        args: [parseInt(invitation_id)],
      });

      // Notify inviter
      const projRes = await db.execute({
        sql: "SELECT name FROM v2_projects WHERE id::text = ?",
        args: [inv.project_id],
      });
      const projectName = projRes.rows[0]?.name || "Unknown Project";

      // Find inviter's cid to send notification
      const inviterRes = await db.execute({
        sql: "SELECT cid FROM contacts WHERE name = ? LIMIT 1",
        args: [inv.inviter_id],
      });
      if (inviterRes.rows.length > 0) {
        await db.execute({
          sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
          args: [
            inviterRes.rows[0].cid,
            "Invitation Accepted",
            `${session.name || inv.invitee_id} accepted your invitation to "${projectName}"`,
            "project_invite",
          ],
        });
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
