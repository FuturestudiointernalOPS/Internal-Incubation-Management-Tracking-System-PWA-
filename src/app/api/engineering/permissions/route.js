import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  PERMISSION_MODULES,
  ACCESS_LEVELS,
  getUserFullPermissionMatrix,
  getUserGroups,
  getUserEffectiveProfile,
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
    const users = searchParams.get("users");

    // Return enriched user list for the table view
    if (users === "true") {
      // Fetch all contacts with their enriched data
      const contactsRes = await db.execute({
        sql: "SELECT cid, name, email, role, status, access_profile_id, group_name, created_at, invited_at FROM contacts ORDER BY name ASC",
      });

      // Fetch all user_groups
      const groupsRes = await db.execute({
        sql: "SELECT user_cid, group_name FROM user_groups",
      });
      const groupMap = {};
      for (const row of groupsRes.rows) {
        if (!groupMap[row.user_cid]) groupMap[row.user_cid] = [];
        groupMap[row.user_cid].push(row.group_name);
      }

      // Fetch all user responsibilities
      const respRes = await db.execute({
        sql: `SELECT ur.user_cid, r.id, r.name, r.key, r.icon
              FROM user_responsibilities ur
              JOIN responsibilities r ON r.id = ur.responsibility_id
              WHERE r.is_active = 1`,
      });
      const respMap = {};
      for (const row of respRes.rows) {
        if (!respMap[row.user_cid]) respMap[row.user_cid] = [];
        respMap[row.user_cid].push({ id: row.id, name: row.name, key: row.key, icon: row.icon });
      }

      // Fetch all access profiles
      const profileRes = await db.execute({
        sql: "SELECT id, name, description FROM access_profiles WHERE is_active = 1",
      });
      const profileMap = {};
      for (const row of profileRes.rows) {
        profileMap[row.id] = row;
      }

      // Fetch role-to-profile defaults
      const roleProfileRes = await db.execute({
        sql: `SELECT rpd.role_name, ap.id as profile_id, ap.name as profile_name
              FROM role_access_profile_defaults rpd
              JOIN access_profiles ap ON ap.id = rpd.access_profile_id`,
      });
      const roleProfileMap = {};
      for (const row of roleProfileRes.rows) {
        roleProfileMap[row.role_name] = { id: row.profile_id, name: row.profile_name };
      }

      // Build enriched users
      const enrichedUsers = contactsRes.rows.map((u) => {
        let profile = null;
        // Check explicit profile assignment
        if (u.access_profile_id && profileMap[u.access_profile_id]) {
          profile = { id: u.access_profile_id, name: profileMap[u.access_profile_id].name, source: "user" };
        }
        // Fall back to role default
        if (!profile && roleProfileMap[u.role]) {
          profile = { id: roleProfileMap[u.role].id, name: roleProfileMap[u.role].name, source: "role" };
        }
        // Merge groups from user_groups + legacy group_name
        const groups = groupMap[u.cid] || [];
        if (u.group_name && !groups.includes(u.group_name)) {
          groups.unshift(u.group_name);
        }

        return {
          cid: u.cid,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          access_profile: profile,
          groups,
          responsibilities: respMap[u.cid] || [],
          created_at: u.created_at,
          invited_at: u.invited_at,
        };
      });

      return NextResponse.json({ success: true, users: enrichedUsers });
    }

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

      // Get access profile defaults
      let accessProfiles = [];
      let accessProfileDefaults = {};
      try {
        const profiles = await db.execute({
          sql: "SELECT id, name, description, is_active FROM access_profiles ORDER BY name",
        });
        accessProfiles = profiles.rows;

        const roleDefaults = await db.execute({
          sql: `SELECT rpd.role_name, ap.id as profile_id, ap.name as profile_name
                FROM role_access_profile_defaults rpd
                JOIN access_profiles ap ON ap.id = rpd.access_profile_id`,
        });
        for (const row of roleDefaults.rows) {
          accessProfileDefaults[row.role_name] = {
            profileId: row.profile_id,
            profileName: row.profile_name,
          };
        }
      } catch (_) {}

      return NextResponse.json({
        success: true,
        modules: PERMISSION_MODULES,
        accessLevels: ACCESS_LEVELS,
        roleDefaults: roleCaps.rows,
        groupDefaults: groupCaps.rows,
        accessProfiles,
        accessProfileDefaults,
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

      // Get access profile info
      const effectiveProfile = await getUserEffectiveProfile(
        userCid,
        user.role,
      );

      return NextResponse.json({
        success: true,
        user: {
          cid: user.cid,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          access_profile_id: user.access_profile_id,
        },
        groups,
        effectiveProfile,
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
