import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  getSession,
  logPermissionAudit,
  ensurePermissionsSchema,
} from "@/lib/auth";
import {
  getAuthorizationContext,
  invalidateAuthorizationContext,
  requireAuthorization,
  MODULE_TO_FEATURE,
} from "@/lib/authorization";
import { preparePermissionReads, readPermissionMatrix } from "@/services/authorization/permissionMatrix";
import {
  getContactForAssignment,
  getContactNameAndRole,
  promoteContactToSuperAdmin,
  demoteContactFromSuperAdmin,
  getUserCapabilityGrant,
  getUserCapabilityBlock,
  getRoleDefaultCapability,
  getGroupDefaultCapability,
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
// Resilient reads: a missing table (migration not yet applied) must never 500
// the whole permissions page — the model's list helpers degrade to an empty
// list (see runSafeQuery in @/models/authorization).

export async function GET(req) {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    await initDb();
    await preparePermissionReads();

    const { searchParams } = new URL(req.url);
    // The read assembly (table users, catalog, one user's matrix, role/group
    // defaults) and the branch order live in the service.
    const { status, body } = await readPermissionMatrix({
      users: searchParams.get("users"),
      userCid: searchParams.get("user_cid"),
      role: searchParams.get("role"),
      group: searchParams.get("group"),
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Permissions] GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
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

    // Promoting to Super Admin (or demoting) is a ROLE change, not a capability
    // grant: a delegated "permission manager" holding assign_capabilities must
    // not be able to mint one for themselves or anyone else.
    if (
      (action === "promote_super_admin" || action === "remove_super_admin") &&
      session.role !== "super_admin"
    ) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    await initDb();
    await ensurePermissionsSchema();

    // Get target user info
    const targetResult = await getContactNameAndRole(user_cid);
    const targetName = targetResult.rows[0]?.name || "Unknown";
    const targetRole = targetResult.rows[0]?.role || null;

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
      const targetAuthorization = await getAuthorizationContext({
        cid: user_cid,
        role: targetRole,
      });
      const targetEligible =
        targetAuthorization?.isSuperAdmin ||
        targetAuthorization?.eligibility?.[featureKey] === true;
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
      case "grant": {
        // Read the current value first so the trail records what changed.
        const priorGrant = await getUserCapabilityGrant(user_cid, module, capability);
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
          previousValue: priorGrant.rows[0]
            ? String(priorGrant.rows[0].access_level)
            : "none",
          newValue: String(access_level || 1),
        });
        break;
      }

      case "revoke": {
        const priorGrant = await getUserCapabilityGrant(user_cid, module, capability);
        await revokeUserCapability(user_cid, module, capability);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "revoked",
          module,
          capability,
          previousValue: priorGrant.rows[0]
            ? String(priorGrant.rows[0].access_level)
            : "none",
          newValue: "none",
        });
        break;
      }

      case "restrict": {
        const priorBlock = await getUserCapabilityBlock(user_cid, module, capability);
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
          previousValue: priorBlock.rows.length ? "blocked" : "none",
          newValue: "blocked",
        });
        break;
      }

      case "unrestrict": {
        const priorBlock = await getUserCapabilityBlock(user_cid, module, capability);
        await unrestrictUserCapability(user_cid, module, capability);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "unrestricted",
          module,
          capability,
          previousValue: priorBlock.rows.length ? "blocked" : "none",
          newValue: "none",
        });
        break;
      }

      case "set_role_default": {
        const priorDefault = await getRoleDefaultCapability(
          body.role,
          module,
          capability,
        );
        await setRoleDefaultCapability(body.role, module, capability, access_level || 0);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "role_changed",
          module,
          capability,
          previousValue: priorDefault.rows[0]
            ? String(priorDefault.rows[0].access_level)
            : "none",
          newValue: String(access_level || 0),
        });
        break;
      }

      case "set_group_default": {
        // This path wrote a group default and left NO audit record at all,
        // which made a group-permission change the only untraceable write in
        // this handler.
        const priorDefault = await getGroupDefaultCapability(
          body.group_name,
          module,
          capability,
        );
        await setGroupDefaultCapability(body.group_name, module, capability, access_level || 0);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "group_changed",
          module,
          capability,
          previousValue: priorDefault.rows[0]
            ? String(priorDefault.rows[0].access_level)
            : "none",
          newValue: String(access_level || 0),
          details: `Group: ${body.group_name}`,
        });
        break;
      }

      case "set_access_profile": {
        const priorContact = await getContactForAssignment(user_cid);
        const priorProfile = priorContact.rows[0]?.access_profile_id;
        await setUserAccessProfile(body.access_profile_id || null, user_cid);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "access_profile_changed",
          previousValue: priorProfile ? String(priorProfile) : "none",
          newValue: body.access_profile_id ? String(body.access_profile_id) : "none",
          details: `Access profile set to ID ${body.access_profile_id || "none"}`,
        });
        break;
      }

      case "set_role": {
        if (!body.role) {
          return NextResponse.json(
            { success: false, error: "role is required" },
            { status: 400 },
          );
        }
        const priorContact = await getContactForAssignment(user_cid);
        const priorRole = priorContact.rows[0]?.role;
        await setUserRole(body.role, user_cid);
        await logPermissionAudit({
          actorCid: actor.cid,
          actorName: actor.name,
          targetCid: user_cid,
          targetName,
          action: "role_changed",
          previousValue: priorRole || "none",
          newValue: body.role,
          details: `Role changed to ${body.role}`,
        });
        break;
      }

      case "set_supervisor": {
        const supervisorCid = body.supervisor_cid;
        if (!supervisorCid) {
          return NextResponse.json(
            { success: false, error: "supervisor_cid is required" },
            { status: 400 },
          );
        }
        // Validate the supervisor is a real contact.
        const supervisorCheck = await contactExistsById(supervisorCid);
        if (supervisorCheck.rows.length === 0) {
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
  } catch (error) {
    console.error("[Permissions] PUT error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
