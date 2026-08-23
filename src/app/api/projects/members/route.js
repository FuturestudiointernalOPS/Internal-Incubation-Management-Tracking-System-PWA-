import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireProjectAccess } from "@/lib/auth";

/**
 * PROJECT MEMBERS API
 *
 * GET    /api/projects/members?project_id=X
 * POST   /api/projects/members  { project_id, user_cid, role }
 * DELETE /api/projects/members?project_id=X&user_cid=Y
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "project_id is required" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const staffSide = [
      "super_admin",
      "staff",
      "program_manager",
      "teacher",
      "developer",
    ];
    if (!staffSide.includes(session.role)) {
      const authError = await requireProjectAccess(projectId);
      if (authError) return authError;
    }

    // Get members with names from contacts
    const result = await db.execute({
      sql: `SELECT pm.*, c.name
            FROM project_members pm
            LEFT JOIN contacts c ON pm.user_cid = c.cid OR pm.user_cid = c.id
            WHERE pm.project_id::text = ?
            ORDER BY pm.role ASC, c.name ASC`,
      args: [projectId],
    });

    return NextResponse.json({ success: true, members: result.rows });
  } catch (error) {
    console.error("GET project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "staff",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { project_id, user_cid, role } = await req.json();

    if (!project_id || !user_cid) {
      return NextResponse.json(
        { success: false, error: "project_id and user_cid are required" },
        { status: 400 },
      );
    }

    // Get session for inviter info
    const session = await getSession();
    const inviterName = session?.name || "Unknown";

    // Get project name
    const projRes = await db.execute({
      sql: "SELECT name FROM v2_projects WHERE id::text = ?",
      args: [project_id],
    });
    const projectName = projRes.rows[0]?.name || "Unknown Project";

    // Cancel any existing pending invitation for this project+user
    await db.execute({
      sql: "UPDATE project_invitations SET status = 'declined', responded_at = NOW() WHERE project_id = ? AND invitee_id = ? AND status = 'pending'",
      args: [project_id, user_cid],
    });

    // Create invitation
    const invResult = await db.execute({
      sql: "INSERT INTO project_invitations (project_id, inviter_id, invitee_id, role) VALUES (?, ?, ?, ?) RETURNING id",
      args: [project_id, inviterName, user_cid, role || "member"],
    });
    const invitationId = invResult.rows[0]?.id || invResult.lastInsertRowid;

    // Notify invitee
    await db.execute({
      sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
      args: [
        user_cid,
        "Project Invitation",
        `${inviterName} invited you to join "${projectName}"`,
        "project_invite",
      ],
    });

    return NextResponse.json({ success: true, action: "invited" });
  } catch (error) {
    console.error("POST project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin",
      "staff",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");
    const userCid = searchParams.get("user_cid");

    if (!projectId || !userCid) {
      return NextResponse.json(
        { success: false, error: "project_id and user_cid are required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "DELETE FROM project_members WHERE project_id::text = ? AND user_cid = ?",
      args: [projectId, userCid],
    });

    return NextResponse.json({ success: true, action: "removed" });
  } catch (error) {
    console.error("DELETE project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
