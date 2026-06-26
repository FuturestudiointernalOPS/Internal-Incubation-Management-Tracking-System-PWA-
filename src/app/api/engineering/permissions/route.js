import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  PERMISSION_MODULES,
  ACCESS_LEVELS,
  getUserFullPermissionMatrix,
  getUserGroups,
  logPermissionAudit,
  seedDefaultRoleCapabilities,
} from "@/lib/auth";

/**
 * GET /api/engineering/permissions
 *
 * Returns the full permission matrix definition and user capability data.
 * Query params:
 *   ?user_cid=X  — get effective permissions for a specific user
 *   ?role=staff  — get role defaults for a specific role
 *   ?group=Development — get group defaults for a specific group
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");
    const role = searchParams.get("role");
    const group = searchParams.get("group");

    // Return full modules definition
    if (!userCid && !role && !group) {
      // Get all role defaults
      const roleCaps = await db.execute({
        sql: "SELECT * FROM role_capabilities ORDER BY role, module, capability",
      });
      // Get all group defaults
      const groupCaps = await db.execute({
        sql: "SELECT * FROM group_capabilities ORDER BY group_name, module, capability",
      });

      return NextResponse.json({
        success: true,
        modules: PERMISSION_MODULES,
        accessLevels: ACCESS_LEVELS,
        roleDefaults: roleCaps.rows,
        groupDefaults: groupCaps.rows,
      });
    }

    // Get effective permissions for a specific user
    if (userCid) {
      const userRes = await db.execute({
        sql: "SELECT cid, name, email, role, status FROM contacts WHERE cid = ?",
        args: [userCid],
      });
      if (userRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 },
        );
      }
      const user = userRes.rows[0];
      const groups = await getUserGroups(userCid);
      const matrix = await getUserFullPermissionMatrix(userCid, user.role);

      // Get individual grants
      const grants = await db.execute({
        sql: "SELECT * FROM user_capabilities WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())",
        args: [userCid],
      });

      // Get individual restrictions
      const restrictions = await db.execute({
        sql: "SELECT * FROM user_capability_restrictions WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())",
        args: [userCid],
      });

      return NextResponse.json({
        success: true,
        user: {
          cid: user.cid,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        groups,
        effectivePermissions: matrix,
        individualGrants: grants.rows,
        individualRestrictions: restrictions.rows,
      });
    }

    // Get role defaults
    if (role) {
      const caps = await db.execute({
        sql: "SELECT * FROM role_capabilities WHERE role = ? ORDER BY module, capability",
        args: [role],
      });
      return NextResponse.json({
        success: true,
        role,
        capabilities: caps.rows,
      });
    }

    // Get group defaults
    if (group) {
      const caps = await db.execute({
        sql: "SELECT * FROM group_capabilities WHERE group_name = ? ORDER BY module, capability",
        args: [group],
      });
      return NextResponse.json({
        success: true,
        group,
        capabilities: caps.rows,
      });
    }
  } catch (err) {
    console.error("[Permissions] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/engineering/permissions
 *
 * Manage individual user permissions.
 * Body: { action, user_cid, module, capability, access_level, expires_at }
 *   action: 'grant' | 'revoke' | 'restrict' | 'unrestrict'
 */
export async function PUT(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    const actor = { cid: session.cid, name: session.name };

    const body = await req.json();
    const { action, user_cid, module, capability, access_level, expires_at } =
      body;

    if (!action || !user_cid) {
      return NextResponse.json(
        { success: false, error: "action and user_cid are required" },
        { status: 400 },
      );
    }

    await initDb();

    // Get target user info
    const targetRes = await db.execute({
      sql: "SELECT name FROM contacts WHERE cid = ?",
      args: [user_cid],
    });
    const targetName = targetRes.rows[0]?.name || "Unknown";

    // Handle promote/remove super admin specially
    if (action === "promote_super_admin") {
      await db.execute({
        sql: "UPDATE contacts SET role = 'super_admin' WHERE cid = ?",
        args: [user_cid],
      });
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: user_cid,
        targetName,
        action: "role_changed",
        details: `Promoted to super_admin`,
      });
      return NextResponse.json({
        success: true,
        message: "User promoted to Super Admin",
      });
    }

    if (action === "remove_super_admin") {
      await db.execute({
        sql: "UPDATE contacts SET role = 'staff' WHERE cid = ?",
        args: [user_cid],
      });
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: user_cid,
        targetName,
        action: "role_changed",
        details: "Super Admin status removed",
      });
      return NextResponse.json({
        success: true,
        message: "Super Admin status removed",
      });
    }

    if (!module || !capability) {
      return NextResponse.json(
        { success: false, error: "module and capability are required" },
        { status: 400 },
      );
    }

    switch (action) {
      case "grant":
        await db.execute({
          sql: `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_cid, module, capability) DO UPDATE SET access_level = ?, granted_by = ?, expires_at = ?`,
          args: [
            user_cid,
            module,
            capability,
            access_level || 1,
            actor.cid,
            expires_at || null,
            access_level || 1,
            actor.cid,
            expires_at || null,
          ],
        });
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "granted",
          module,
          capability,
          newValue: String(access_level || 1),
        });
        break;

      case "revoke":
        await db.execute({
          sql: "DELETE FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ?",
          args: [user_cid, module, capability],
        });
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "revoked",
          module,
          capability,
        });
        break;

      case "restrict":
        await db.execute({
          sql: `INSERT INTO user_capability_restrictions (user_cid, module, capability, restricted_by, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_cid, module, capability) DO UPDATE SET restricted_by = ?, expires_at = ?`,
          args: [
            user_cid,
            module,
            capability,
            actor.cid,
            expires_at || null,
            actor.cid,
            expires_at || null,
          ],
        });
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "restricted",
          module,
          capability,
        });
        break;

      case "unrestrict":
        await db.execute({
          sql: "DELETE FROM user_capability_restrictions WHERE user_cid = ? AND module = ? AND capability = ?",
          args: [user_cid, module, capability],
        });
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "unrestricted",
          module,
          capability,
        });
        break;

      case "set_role_default":
        await db.execute({
          sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (role, module, capability) DO UPDATE SET access_level = ?`,
          args: [
            body.role,
            module,
            capability,
            access_level || 0,
            access_level || 0,
          ],
        });
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "role_changed",
          module,
          capability,
          newValue: String(access_level || 0),
        });
        break;

      case "set_group_default":
        await db.execute({
          sql: `INSERT INTO group_capabilities (group_name, module, capability, access_level)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (group_name, module, capability) DO UPDATE SET access_level = ?`,
          args: [
            body.group_name,
            module,
            capability,
            access_level || 0,
            access_level || 0,
          ],
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Permissions] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
