import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  PERMISSION_MODULES,
  logPermissionAudit,
} from "@/lib/auth";

/**
 * GET /api/access-profiles
 *
 * Query params:
 *   ?id=X — get a single profile with capabilities
 *   (none) — list all profiles
 *
 * Returns:
 *   { success, profiles: [...], modules: {...} }
 *   or { success, profile: {...}, capabilities: [...] }
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("id");

    // Single profile with capabilities
    if (profileId) {
      const profile = await db.execute({
        sql: "SELECT id, name, description, is_active FROM access_profiles WHERE id = ?",
        args: [profileId],
      });
      if (profile.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Profile not found" },
          { status: 404 },
        );
      }

      const capabilities = await db.execute({
        sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ? ORDER BY module, capability",
        args: [profileId],
      });

      return NextResponse.json({
        success: true,
        profile: profile.rows[0],
        capabilities: capabilities.rows,
        modules: PERMISSION_MODULES,
      });
    }

    // List all profiles with role mappings
    const profiles = await db.execute({
      sql: `SELECT ap.*,
            (SELECT COUNT(*) FROM access_profile_capabilities apc WHERE apc.profile_id = ap.id) as capability_count
            FROM access_profiles ap ORDER BY ap.name`,
    });

    // Get role mappings for each profile
    const roleDefaults = await db.execute({
      sql: `SELECT rpd.role_name, rpd.access_profile_id, ap.name as profile_name
            FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            ORDER BY rpd.role_name`,
    });

    // Build role→profile map
    const roleProfileMap = {};
    for (const row of roleDefaults.rows) {
      roleProfileMap[row.role_name] = {
        profileId: row.access_profile_id,
        profileName: row.profile_name,
      };
    }

    return NextResponse.json({
      success: true,
      profiles: profiles.rows,
      roleDefaults: roleProfileMap,
      modules: PERMISSION_MODULES,
    });
  } catch (err) {
    console.error("[Access Profiles] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/access-profiles
 *
 * Create a new access profile.
 * Body: { name, description, capabilities: { module: { capability: level } } }
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { name, description, capabilities } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Profile name is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Create profile
    const result = await db.execute({
      sql: `INSERT INTO access_profiles (name, description, is_active)
            VALUES (?, ?, 1)`,
      args: [name.trim(), description || ""],
    });

    const profileId = Number(result.lastInsertRowid);

    // Add capabilities if provided
    if (capabilities && typeof capabilities === "object") {
      for (const [module, caps] of Object.entries(capabilities)) {
        if (typeof caps === "object") {
          for (const [capability, level] of Object.entries(caps)) {
            await db.execute({
              sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                    VALUES (?, ?, ?, ?)`,
              args: [profileId, module, capability, level],
            });
          }
        }
      }
    }

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: name,
      action: "profile_created",
      details: `Created access profile: ${name}`,
    });

    return NextResponse.json({
      success: true,
      profileId,
      message: `Profile "${name}" created`,
    });
  } catch (err) {
    console.error("[Access Profiles] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/access-profiles
 *
 * Update an access profile.
 * Body: { id, name?, description?, is_active?, capabilities?: { module: { capability: level } } }
 */
export async function PUT(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { id, name, description, is_active, capabilities } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Profile id is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Check profile exists
    const existing = await db.execute({
      sql: "SELECT id, name FROM access_profiles WHERE id = ?",
      args: [id],
    });
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    // Update profile fields
    if (name !== undefined) {
      await db.execute({
        sql: "UPDATE access_profiles SET name = ?, updated_at = NOW() WHERE id = ?",
        args: [name.trim(), id],
      });
    }
    if (description !== undefined) {
      await db.execute({
        sql: "UPDATE access_profiles SET description = ?, updated_at = NOW() WHERE id = ?",
        args: [description, id],
      });
    }
    if (is_active !== undefined) {
      await db.execute({
        sql: "UPDATE access_profiles SET is_active = ?, updated_at = NOW() WHERE id = ?",
        args: [is_active ? 1 : 0, id],
      });
    }

    // Replace capabilities if provided
    if (capabilities && typeof capabilities === "object") {
      // Clear existing
      await db.execute({
        sql: "DELETE FROM access_profile_capabilities WHERE profile_id = ?",
        args: [id],
      });

      // Insert new
      for (const [module, caps] of Object.entries(capabilities)) {
        if (typeof caps === "object") {
          for (const [capability, level] of Object.entries(caps)) {
            await db.execute({
              sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                    VALUES (?, ?, ?, ?)`,
              args: [id, module, capability, level],
            });
          }
        }
      }
    }

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: existing.rows[0].name,
      action: "profile_updated",
      details: `Updated access profile: ${existing.rows[0].name}`,
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated",
    });
  } catch (err) {
    console.error("[Access Profiles] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/access-profiles?id=X
 *
 * Delete an access profile.
 */
export async function DELETE(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Profile id is required" },
        { status: 400 },
      );
    }

    await initDb();

    // Check if any role defaults reference this profile
    const roleRefs = await db.execute({
      sql: "SELECT role_name FROM role_access_profile_defaults WHERE access_profile_id = ?",
      args: [id],
    });

    if (roleRefs.rows.length > 0) {
      const roles = roleRefs.rows.map((r) => r.role_name).join(", ");
      return NextResponse.json({
        success: false,
        error: `Cannot delete: profile is the default for role(s): ${roles}. Change the role default first.`,
      });
    }

    // Check if any users reference this profile
    const userRefs = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM contacts WHERE access_profile_id = ?",
      args: [id],
    });

    // Get profile name for audit
    const profile = await db.execute({
      sql: "SELECT name FROM access_profiles WHERE id = ?",
      args: [id],
    });

    // Delete (cascade will remove capabilities)
    await db.execute({
      sql: "DELETE FROM access_profiles WHERE id = ?",
      args: [id],
    });

    await logPermissionAudit({
      actorCid: session?.cid,
      actorName: session?.name,
      targetCid: "system",
      targetName: profile.rows[0]?.name || "Unknown",
      action: "profile_deleted",
      details: `Deleted access profile with ${userRefs.rows[0]?.cnt || 0} users still assigned`,
    });

    return NextResponse.json({
      success: true,
      message: "Profile deleted",
    });
  } catch (err) {
    console.error("[Access Profiles] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
