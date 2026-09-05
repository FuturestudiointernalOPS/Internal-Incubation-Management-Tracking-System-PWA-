import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getSession,
  PERMISSION_MODULES,
  ACCESS_LEVELS,
  getUserGroups,
  getUserEffectiveProfile,
  logPermissionAudit,
  seedDefaultRoleCapabilities,
  ensureResponsibilitiesSchema,
  ensurePermissionsSchema,
  seedDefaultResponsibilities,
} from "@/lib/auth";
import {
  getAuthorizationContext,
  effectivePermissionsFromContext,
  invalidateAuthorizationContext,
  buildPermissionExplanation,
  requireAuthorization,
  MODULE_TO_FEATURE,
} from "@/lib/authorization";
import { CAPABILITY_CATALOG } from "@/lib/authorization/capability-catalog";
import {
  runSafeQuery,
  listPermissionTableContacts,
  listAccessProfileDefinitions,
  getRoleDefaultProfileMappings,
  getContactForEffectivePermissions,
  getCurrentSupervisor,
  getContactNameAndRole,
  promoteContactToSuperAdmin,
  demoteContactFromSuperAdmin,
  grantUserCapability,
  revokeUserCapability,
  restrictUserCapability,
  unrestrictUserCapability,
  setRoleDefaultCapability,
  setGroupDefaultCapability,
  setUserAccessProfile,
  setUserRole,
  contactExistsById,
  endCurrentSupervision,
  insertSupervisionAssignment,
  endSupervisionRelationship,
  setUserStatus,
} from "@/models/authorization";

/**
 * GET /api/engineering/permissions
 *
 * Returns the full permission matrix definition and user capability data.
 * Query params:
 *   ?user_cid=X  — get effective permissions for a specific user
 *   ?role=staff  — get role defaults for a specific role
 *   ?group=Development — get group defaults for a specific group
 */
// Resilient query helper: a missing table (migration not yet applied) must
// never 500 the whole permissions page — it degrades to an empty list.
async function safeQuery(sql, args = []) {
  return runSafeQuery(sql, args);
}

export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    await ensureResponsibilitiesSchema();
    await ensurePermissionsSchema();
    await seedDefaultResponsibilities();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");
    const role = searchParams.get("role");
    const group = searchParams.get("group");
    const users = searchParams.get("users");

    // Return enriched user list for the table view
    if (users === "true") {
      // Fetch all contacts with their enriched data
      const contactsRes = await listPermissionTableContacts();

      // Fetch all user_groups
      const groupsRes = await safeQuery("SELECT user_cid, group_name FROM user_groups");
      const groupMap = {};
      for (const row of groupsRes.rows) {
        if (!groupMap[row.user_cid]) groupMap[row.user_cid] = [];
        groupMap[row.user_cid].push(row.group_name);
      }

      // Fetch all user responsibilities
      const respRes = await safeQuery(`SELECT ur.user_cid, r.id, r.name, r.key, r.icon
              FROM user_responsibilities ur
              JOIN responsibilities r ON r.id = ur.responsibility_id
              WHERE r.is_active = 1`);
      const respMap = {};
      for (const row of respRes.rows) {
        if (!respMap[row.user_cid]) respMap[row.user_cid] = [];
        respMap[row.user_cid].push({ id: row.id, name: row.name, key: row.key, icon: row.icon });
      }

      // Fetch all access profiles
      const profileRes = await safeQuery("SELECT id, name, description FROM access_profiles WHERE is_active = 1");
      const profileMap = {};
      for (const row of profileRes.rows) {
        profileMap[row.id] = row;
      }

      // Fetch role-to-profile defaults
      const roleProfileRes = await safeQuery(`SELECT rpd.role_name, ap.id as profile_id, ap.name as profile_name
              FROM role_access_profile_defaults rpd
              JOIN access_profiles ap ON ap.id = rpd.access_profile_id`);
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
        };
      });

      return NextResponse.json({ success: true, users: enrichedUsers });
    }

    // Return full modules definition
    if (!userCid && !role && !group) {
      // Get all role defaults
      const roleCaps = await safeQuery("SELECT * FROM role_capabilities ORDER BY role, module, capability");
      // Get all group defaults
      const groupCaps = await safeQuery("SELECT * FROM group_capabilities ORDER BY group_name, module, capability");

      // Get access profile defaults
      let accessProfiles = [];
      let accessProfileDefaults = {};
      try {
        const profiles = await listAccessProfileDefinitions();
        accessProfiles = profiles.rows;

        const roleDefaults = await getRoleDefaultProfileMappings();
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
        catalog: CAPABILITY_CATALOG,
        roleDefaults: roleCaps.rows,
        groupDefaults: groupCaps.rows,
        accessProfiles,
        accessProfileDefaults,
      });
    }

    // Get effective permissions for a specific user
    if (userCid) {
      const userRes = await getContactForEffectivePermissions(userCid);
      if (userRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 },
        );
      }
      const user = userRes.rows[0];
      const groups = await getUserGroups(userCid);
      // Canonical authorization context (V2-equivalent + eligibility).
      // Phase 0: the admin UI no longer depends on V1 for the effective
      // permission matrix; V1 remains in the codebase but is unused here.
      const authzCtx = await getAuthorizationContext({
        cid: userCid,
        role: user.role,
        group_name: user.group_name,
      });
      const matrix = effectivePermissionsFromContext(authzCtx);
      // "Who has access and why": per-feature eligibility (with the identity
      // rows that produced it) + the raw capability inputs per module.
      const explanation = buildPermissionExplanation(authzCtx);

      // Get individual grants
      const grants = await safeQuery(
        "SELECT * FROM user_capabilities WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())",
        [userCid],
      );

      // Get individual restrictions
      const restrictions = await safeQuery(
        "SELECT * FROM user_capability_restrictions WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())",
        [userCid],
      );

      // Get access profile info
      const effectiveProfile = await getUserEffectiveProfile(
        userCid,
        user.role,
      );

      // Get the persisted supervisor relationship (contact_roles,
      // context_type='supervision'). Null when none exists.
      let supervisorCid = null;
      try {
        const supRes = await getCurrentSupervisor(userCid);
        supervisorCid = supRes.rows[0]?.supervisor_cid || null;
      } catch (_) {}

      return NextResponse.json({
        success: true,
        user: {
          cid: user.cid,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          access_profile_id: user.access_profile_id,
          supervisor_cid: supervisorCid,
        },
        groups,
        effectiveProfile,
        effectivePermissions: matrix,
        explanation,
        moduleToFeature: MODULE_TO_FEATURE,
        individualGrants: grants.rows,
        individualRestrictions: restrictions.rows,
      });
    }

    // Get role defaults
    if (role) {
      const caps = await safeQuery("SELECT * FROM role_capabilities WHERE role = ? ORDER BY module, capability", [role]);
      return NextResponse.json({
        success: true,
        role,
        capabilities: caps.rows,
      });
    }

    // Get group defaults
    if (group) {
      const caps = await safeQuery("SELECT * FROM group_capabilities WHERE group_name = ? ORDER BY module, capability", [group]);
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
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

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
    await ensurePermissionsSchema();

    // Get target user info
    const targetRes = await getContactNameAndRole(user_cid);
    const targetName = targetRes.rows[0]?.name || "Unknown";
    const targetRole = targetRes.rows[0]?.role || null;

    // Handle promote/remove super admin specially
    if (action === "promote_super_admin") {
      await promoteContactToSuperAdmin(user_cid);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: user_cid,
        targetName,
        action: "role_changed",
        details: `Promoted to super_admin`,
      });
      invalidateAuthorizationContext(user_cid);
      return NextResponse.json({
        success: true,
        message: "User promoted to Super Admin",
      });
    }

    if (action === "remove_super_admin") {
      await demoteContactFromSuperAdmin(user_cid);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: user_cid,
        targetName,
        action: "role_changed",
        details: "Super Admin status removed",
      });
      invalidateAuthorizationContext(user_cid);
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

    // ── Hard eligibility boundary on capability ASSIGNMENT ──
    // A grant must respect the target's feature eligibility. Attempting to
    // assign a capability to a user who is not eligible for the feature
    // (e.g. Finance to a Mentor) is REJECTED here — the backend is the
    // boundary, not the frontend dropdown. (Super Admin targets are always
    // eligible by bypass.)
    const featureKey = MODULE_TO_FEATURE[module];
    if (action === "grant" && featureKey) {
      const targetAuthz = await getAuthorizationContext({
        cid: user_cid,
        role: targetRole,
      });
      const targetEligible =
        targetAuthz?.isSuperAdmin ||
        targetAuthz?.eligibility?.[featureKey] === true;
      if (!targetEligible) {
        return NextResponse.json(
          {
            success: false,
            error: `Target user is not eligible for this feature (${featureKey}). Assignment rejected.`,
          },
          { status: 403 },
        );
      }
    }

    switch (action) {
      case "grant":
        await grantUserCapability(
          user_cid,
          module,
          capability,
          access_level || 1,
          actor.cid,
          expires_at || null,
        );
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
        await revokeUserCapability(user_cid, module, capability);
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
        await restrictUserCapability(
          user_cid,
          module,
          capability,
          actor.cid,
          expires_at || null,
        );
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
        await unrestrictUserCapability(user_cid, module, capability);
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
        await setRoleDefaultCapability(body.role, module, capability, access_level || 0);
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
        await setGroupDefaultCapability(body.group_name, module, capability, access_level || 0);
        break;

      case "set_access_profile":
        await setUserAccessProfile(body.access_profile_id || null, user_cid);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "access_profile_changed",
          details: `Access profile set to ID ${body.access_profile_id || "none"}`,
        });
        break;

      case "set_role":
        if (!body.role) {
          return NextResponse.json(
            { success: false, error: "role is required" },
            { status: 400 },
          );
        }
        await setUserRole(body.role, user_cid);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "role_changed",
          details: `Role changed to ${body.role}`,
        });
        break;

      case "set_supervisor": {
        const supervisorCid = body.supervisor_cid;
        if (!supervisorCid) {
          return NextResponse.json(
            { success: false, error: "supervisor_cid is required" },
            { status: 400 },
          );
        }
        // Validate the supervisor is a real contact.
        const supCheck = await contactExistsById(supervisorCid);
        if (supCheck.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: "Supervisor contact not found" },
            { status: 400 },
          );
        }
        // Persist the supervision relationship in the generalized assignment
        // table (context_type='supervision', context_id = supervisor cid).
        // Additive, idempotent: any current supervision row is ended first.
        await endCurrentSupervision(user_cid);
        await insertSupervisionAssignment(
          user_cid,
          supervisorCid,
          actor.cid || "system",
        );
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "supervisor_assigned",
          details: `Supervisor set to ${supervisorCid} (persisted via contact_roles)`,
        });
        break;
      }

      case "remove_supervisor": {
        // End any current supervision relationship (additive, idempotent).
        await endSupervisionRelationship(user_cid);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "supervisor_removed",
          details: "Supervisor relationship ended (context_type=supervision)",
        });
        break;
      }

      case "set_status":
        if (!body.status) {
          return NextResponse.json(
            { success: false, error: "status is required" },
            { status: 400 },
          );
        }
        await setUserStatus(body.status, user_cid);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "status_changed",
          details: `Status changed to ${body.status}`,
        });
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }

    invalidateAuthorizationContext(user_cid);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Permissions] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
