import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireAuthorization } from "@/models/authorization/index";
import {
  isGroupProtected,
} from "@/models/authorization/membership";
import {
  listUserGroups,
  joinUserGroup,
  leaveUserGroup,
} from "@/services/contacts/userGroups";

/**
 * GET /api/user-groups?user_cid=X
 *
 * Returns all groups a user belongs to.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    let userCid = searchParams.get("user_cid");
    if (session.role !== "super_admin") {
      if (userCid && String(userCid) !== String(session.cid)) {
        return NextResponse.json({ success: false, error: "You can only view your own groups." }, { status: 403 });
      }
      userCid = userCid || session.cid;
    }
    if (!userCid) return NextResponse.json({ success: false, error: "user_cid required" }, { status: 400 });

    await initDb();

    const groups = await listUserGroups(userCid);

    return NextResponse.json({ success: true, groups, user_cid: userCid });
  } catch (err) {
    console.error("[user-groups] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/user-groups
 *
 * Assign a user to a group.
 * Body: { user_cid, group_name }
 */
export async function POST(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const { user_cid, group_name } = await req.json();

    if (!user_cid || !group_name) {
      return NextResponse.json(
        { success: false, error: "user_cid and group_name required" },
        { status: 400 },
      );
    }

    // Protected groups (FUTURE STUDIO) require the dedicated organizational
    // membership authority — assign_capabilities alone must never grant the
    // ability to manage the internal organization.
    if (await isGroupProtected(group_name)) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const session = await getSession();
    await joinUserGroup({ userCid: user_cid, groupName: group_name, actorCid: session?.cid });

    return NextResponse.json({
      success: true,
      message: `User added to ${group_name}`,
    });
  } catch (err) {
    console.error("[user-groups] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user-groups
 *
 * Remove a user from a group.
 * Body: { user_cid, group_name }
 */
export async function DELETE(req) {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    await initDb();
    const body = await req.json();
    const { user_cid, group_name } = body;

    if (!user_cid || !group_name) {
      return NextResponse.json(
        { success: false, error: "user_cid and group_name required" },
        { status: 400 },
      );
    }

    // Protected groups (FUTURE STUDIO) require the dedicated organizational
    // membership authority — same rule as POST.
    if (await isGroupProtected(group_name)) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const session = await getSession();
    await leaveUserGroup({ userCid: user_cid, groupName: group_name, actorCid: session?.cid });

    return NextResponse.json({
      success: true,
      message: `User removed from ${group_name}`,
    });
  } catch (err) {
    console.error("[user-groups] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
