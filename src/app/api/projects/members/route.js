import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireProjectAccess } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  getProjectMembersWithNames,
  getProjectName,
  declinePendingProjectInvitation,
  createProjectInvitation,
  createProjectInvitationNotification,
  deleteProjectMember,
} from "@/models/projectCollaboration";

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
    const result = await getProjectMembersWithNames(projectId);

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
    const capError = await requireAuthorization("projects", "edit");
    if (capError) return capError;
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
    const projRes = await getProjectName(project_id);
    const projectName = projRes.rows[0]?.name || "Unknown Project";

    // Cancel any existing pending invitation for this project+user
    await declinePendingProjectInvitation(project_id, user_cid);

    // Create invitation
    const invResult = await createProjectInvitation(
      project_id,
      inviterName,
      user_cid,
      role,
    );
    const invitationId = invResult.rows[0]?.id || invResult.lastInsertRowid;

    // Notify invitee
    await createProjectInvitationNotification(
      user_cid,
      "Project Invitation",
      `${inviterName} invited you to join "${projectName}"`,
      "project_invite",
    );

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
    const capError = await requireAuthorization("projects", "edit");
    if (capError) return capError;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");
    const userCid = searchParams.get("user_cid");

    if (!projectId || !userCid) {
      return NextResponse.json(
        { success: false, error: "project_id and user_cid are required" },
        { status: 400 },
      );
    }

    await deleteProjectMember(projectId, userCid);

    return NextResponse.json({ success: true, action: "removed" });
  } catch (error) {
    console.error("DELETE project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
