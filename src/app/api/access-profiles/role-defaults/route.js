import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, logPermissionAudit } from "@/lib/auth";

/**
 * PUT /api/access-profiles/role-defaults
 *
 * Set which access profile a role uses by default.
 * Body: { role_name, profile_id }
 */
export async function PUT(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    await initDb();
    const { role_name, profile_id } = await req.json();

    if (!role_name || !profile_id) {
      return NextResponse.json(
        { success: false, error: "role_name and profile_id are required" },
        { status: 400 },
      );
    }

    // Verify profile exists
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
      sql: `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
            VALUES (?, ?)
            ON CONFLICT (role_name) DO UPDATE SET access_profile_id = ?`,
      args: [role_name, profile_id, profile_id],
    });

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: `role:${role_name}`,
      action: "role_default_changed",
      details: `Set default access profile for role "${role_name}" to "${profile.rows[0].name}"`,
    });

    return NextResponse.json({
      success: true,
      message: `Role "${role_name}" default set to "${profile.rows[0].name}"`,
    });
  } catch (err) {
    console.error("[Role Defaults] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/access-profiles/role-defaults
 *
 * Get all role→profile default mappings.
 */
export async function GET() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();

    const mappings = await db.execute({
      sql: `SELECT rpd.role_name, ap.id as profile_id, ap.name as profile_name, ap.is_active
            FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            ORDER BY rpd.role_name`,
    });

    return NextResponse.json({
      success: true,
      mappings: mappings.rows,
    });
  } catch (err) {
    console.error("[Role Defaults GET] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
