import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, logPermissionAudit } from "@/lib/auth";

/**
 * PUT /api/access-profiles/assign
 *
 * Assign/remove an access profile override for a specific user.
 * Body: { user_cid, profile_id } — set profile_id to null to remove override
 */
export async function PUT(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    await initDb();
    const { user_cid, profile_id } = await req.json();

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required" },
        { status: 400 },
      );
    }

    // Verify user exists
    const user = await db.execute({
      sql: "SELECT cid, name, role, access_profile_id FROM contacts WHERE cid = ?",
      args: [user_cid],
    });
    if (user.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const previousProfileId = user.rows[0].access_profile_id;

    // If profile_id is provided, verify it exists
    if (profile_id) {
      const profile = await db.execute({
        sql: "SELECT id, name FROM access_profiles WHERE id = ? AND is_active = 1",
        args: [profile_id],
      });
      if (profile.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Access profile not found or inactive" },
          { status: 404 },
        );
      }

      await db.execute({
        sql: "UPDATE contacts SET access_profile_id = ? WHERE cid = ?",
        args: [profile_id, user_cid],
      });

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: user_cid,
        targetName: user.rows[0].name,
        action: "profile_assigned",
        details: `Assigned access profile: ${profile.rows[0].name}`,
      });

      return NextResponse.json({
        success: true,
        message: `User assigned to profile "${profile.rows[0].name}"`,
        profileName: profile.rows[0].name,
      });
    }

    // Remove override
    await db.execute({
      sql: "UPDATE contacts SET access_profile_id = NULL WHERE cid = ?",
      args: [user_cid],
    });

    // Get the role default that will now apply
    const roleDefault = await db.execute({
      sql: `SELECT ap.name FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            WHERE rpd.role_name = ?`,
      args: [user.rows[0].role],
    });

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: user_cid,
      targetName: user.rows[0].name,
      action: "profile_removed",
      details: `Removed profile override, reverting to ${roleDefault.rows[0]?.name || "legacy"} default`,
    });

    return NextResponse.json({
      success: true,
      message: "Profile override removed, falling back to role default",
      roleDefaultName: roleDefault.rows[0]?.name || null,
    });
  } catch (err) {
    console.error("[Assign Profile] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/access-profiles/assign?user_cid=X
 *
 * Get the current profile assignment for a user.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");

    if (!userCid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required" },
        { status: 400 },
      );
    }

    const user = await db.execute({
      sql: "SELECT cid, name, role, access_profile_id FROM contacts WHERE cid = ?",
      args: [userCid],
    });
    if (user.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const u = user.rows[0];

    // Get explicitly assigned profile
    let assignedProfile = null;
    if (u.access_profile_id) {
      const profile = await db.execute({
        sql: "SELECT id, name FROM access_profiles WHERE id = ?",
        args: [u.access_profile_id],
      });
      if (profile.rows.length > 0) {
        assignedProfile = { id: profile.rows[0].id, name: profile.rows[0].name };
      }
    }

    // Get role default profile
    let roleDefault = null;
    const roleDef = await db.execute({
      sql: `SELECT ap.id, ap.name FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            WHERE rpd.role_name = ?`,
      args: [u.role],
    });
    if (roleDef.rows.length > 0) {
      roleDefault = { id: roleDef.rows[0].id, name: roleDef.rows[0].name };
    }

    return NextResponse.json({
      success: true,
      user: { cid: u.cid, name: u.name, role: u.role },
      assignedProfile,
      roleDefault,
      effectiveSource: assignedProfile ? "user" : roleDefault ? "role" : "legacy",
    });
  } catch (err) {
    console.error("[Assign Profile GET] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
