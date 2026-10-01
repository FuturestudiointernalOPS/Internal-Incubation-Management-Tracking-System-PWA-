import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireProjectAccess } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  listProjectMembers,
  inviteProjectMember,
  removeProjectMember,
} from "@/services/projects/collaboration";
import { needsProjectObjectCheck } from "@/services/projects/access";

/**
 * PROJECT MEMBERS API — controller layer.
 *
 * GET    /api/projects/members?project_id=X
 * POST   /api/projects/members  { project_id, user_cid, role }
 * DELETE /api/projects/members?project_id=X&user_cid=Y
 *
 * Auth, validation and response shaping only; the invite sequence, the
 * membership changes and the "may this role change THIS project" rule live in
 * `@/services/projects`.
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
    if (needsProjectObjectCheck({ role: session?.role })) {
      const accessError = await requireProjectAccess(projectId);
      if (accessError) return accessError;
    }

    const result = await listProjectMembers(projectId);
    return NextResponse.json({ success: true, members: result.members });
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

    // Object-level authorization: `projects.edit` alone is a global capability.
    // A non-staff holder may only invite into a project they own or belong to.
    const session = await getSession();
    if (needsProjectObjectCheck({ role: session?.role })) {
      const accessError = await requireProjectAccess(project_id);
      if (accessError) return accessError;
    }

    const result = await inviteProjectMember({
      projectId: project_id,
      userCid: user_cid,
      role,
      inviterName: session?.name || "Unknown",
    });

    return NextResponse.json({ success: true, action: result.action });
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

    // Object-level authorization: only a member/owner of the project (or staff)
    // may remove a member — otherwise `projects.edit` removes anyone anywhere.
    const session = await getSession();
    if (needsProjectObjectCheck({ role: session?.role })) {
      const accessError = await requireProjectAccess(projectId);
      if (accessError) return accessError;
    }

    const result = await removeProjectMember(projectId, userCid);
    return NextResponse.json({ success: true, action: result.action });
  } catch (error) {
    console.error("DELETE project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}