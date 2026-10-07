/**
 * Authorization — the PERMISSION WRITE vocabulary (SERVICE layer).
 *
 * The action switch behind `PUT /api/engineering/permissions`: the individual
 * grant / revoke / restrict / unrestrict, the role and group defaults, the
 * profile / role / supervisor / status changes, the super-admin promotion and
 * demotion, and the audit record each write leaves.
 *
 * HTTP-free: it answers `{ status, body }` and the controller turns that into a
 * response. The controller keeps the `permissions.assign_capabilities` gate, the
 * session, the required-field validation and the ROLE gate on
 * promote/remove (a role change is never a capability grant — it stays in the
 * HTTP boundary, not here).
 *
 * It imports the same model/service homes the controller used, so module-level
 * test mocks keep intercepting the calls.
 */

import { logPermissionAudit } from "@/models/authorization/accessQueries";
import {
  getAuthorizationContext,
  invalidateAuthorizationContext,
  MODULE_TO_FEATURE,
} from "@/models/authorization/index";
import {
  contactExistsById,
  demoteContactFromSuperAdmin,
  endCurrentSupervision,
  endSupervisionRelationship,
  getContactForAssignment,
  getContactNameAndRole,
  getGroupDefaultCapability,
  getRoleDefaultCapability,
  getUserCapabilityBlock,
  getUserCapabilityGrant,
  grantUserCapability,
  insertSupervisionAssignment,
  promoteContactToSuperAdmin,
  restrictUserCapability,
  revokeUserCapability,
  setGroupDefaultCapability,
  setRoleDefaultCapability,
  setUserRole,
  setUserStatus,
  unrestrictUserCapability,
} from "@/models/authorization";

/**
 * Apply one permission change and record it on the audit trail.
 *
 * @returns {Promise<{status:number, body:object}>} the response the controller
 *          returns as-is.
 */
export async function applyPermissionChange({ action, userCid, module, capability, accessLevel, expiresAt, payload, actor }) {
  // Get target user info
  const targetResult = await getContactNameAndRole(userCid);
  const targetName = targetResult.rows[0]?.name || "Unknown";
  const targetRole = targetResult.rows[0]?.role || null;

  // Handle promote/remove super admin specially
  if (action === "promote_super_admin") {
    await promoteContactToSuperAdmin(userCid);
    await logPermissionAudit({
      actorCid: actor.cid,
      actorName: actor.name,
      targetCid: userCid,
      targetName,
      action: "role_changed",
      details: `Promoted to super_admin`,
    });
    invalidateAuthorizationContext(userCid);
    return { status: 200, body: { success: true, message: "User promoted to Super Admin" } };
  }

  if (action === "remove_super_admin") {
    await demoteContactFromSuperAdmin(userCid);
    await logPermissionAudit({
      actorCid: actor.cid,
      actorName: actor.name,
      targetCid: userCid,
      targetName,
      action: "role_changed",
      details: "Super Admin status removed",
    });
    invalidateAuthorizationContext(userCid);
    return { status: 200, body: { success: true, message: "Super Admin status removed" } };
  }

  if (!module || !capability) {
    return { status: 400, body: { success: false, error: "module and capability are required" } };
  }

  // ── Hard eligibility boundary on capability ASSIGNMENT ──
  // A grant must respect the target's feature eligibility. Attempting to assign
  // a capability to a user who is not eligible for the feature (e.g. Finance to
  // a Mentor) is REJECTED here — the backend is the boundary, not the frontend
  // dropdown. (Super Admin targets are always eligible by bypass.)
  const featureKey = MODULE_TO_FEATURE[module];
  if (action === "grant" && featureKey) {
    const targetAuthorization = await getAuthorizationContext({ cid: userCid, role: targetRole });
    const targetEligible =
      targetAuthorization?.isSuperAdmin ||
      targetAuthorization?.eligibility?.[featureKey] === true;
    if (!targetEligible) {
      return {
        status: 403,
        body: {
          success: false,
          error: `Target user is not eligible for this feature (${featureKey}). Assignment rejected.`,
        },
      };
    }
  }

  switch (action) {
    case "grant": {
      // Read the current value first so the trail records what changed.
      const priorGrant = await getUserCapabilityGrant(userCid, module, capability);
      await grantUserCapability(userCid, module, capability, accessLevel || 1, actor.cid, expiresAt || null);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "granted",
        module,
        capability,
        previousValue: priorGrant.rows[0] ? String(priorGrant.rows[0].access_level) : "none",
        newValue: String(accessLevel || 1),
      });
      break;
    }

    case "revoke": {
      const priorGrant = await getUserCapabilityGrant(userCid, module, capability);
      await revokeUserCapability(userCid, module, capability);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "revoked",
        module,
        capability,
        previousValue: priorGrant.rows[0] ? String(priorGrant.rows[0].access_level) : "none",
        newValue: "none",
      });
      break;
    }

    case "restrict": {
      const priorBlock = await getUserCapabilityBlock(userCid, module, capability);
      await restrictUserCapability(userCid, module, capability, actor.cid, expiresAt || null);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
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
      const priorBlock = await getUserCapabilityBlock(userCid, module, capability);
      await unrestrictUserCapability(userCid, module, capability);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
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
      const priorDefault = await getRoleDefaultCapability(payload.role, module, capability);
      await setRoleDefaultCapability(payload.role, module, capability, accessLevel || 0);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "role_changed",
        module,
        capability,
        previousValue: priorDefault.rows[0] ? String(priorDefault.rows[0].access_level) : "none",
        newValue: String(accessLevel || 0),
      });
      break;
    }

    case "set_group_default": {
      // This path wrote a group default and left NO audit record at all, which
      // made a group-permission change the only untraceable write in this
      // handler.
      const priorDefault = await getGroupDefaultCapability(payload.group_name, module, capability);
      await setGroupDefaultCapability(payload.group_name, module, capability, accessLevel || 0);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "group_changed",
        module,
        capability,
        previousValue: priorDefault.rows[0] ? String(priorDefault.rows[0].access_level) : "none",
        newValue: String(accessLevel || 0),
        details: `Group: ${payload.group_name}`,
      });
      break;
    }

    case "set_role": {
      if (!payload.role) {
        return { status: 400, body: { success: false, error: "role is required" } };
      }
      const priorContact = await getContactForAssignment(userCid);
      const priorRole = priorContact.rows[0]?.role;
      await setUserRole(payload.role, userCid);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "role_changed",
        previousValue: priorRole || "none",
        newValue: payload.role,
        details: `Role changed to ${payload.role}`,
      });
      break;
    }

    case "set_supervisor": {
      const supervisorCid = payload.supervisor_cid;
      if (!supervisorCid) {
        return { status: 400, body: { success: false, error: "supervisor_cid is required" } };
      }
      // Validate the supervisor is a real contact.
      const supervisorCheck = await contactExistsById(supervisorCid);
      if (supervisorCheck.rows.length === 0) {
        return { status: 400, body: { success: false, error: "Supervisor contact not found" } };
      }
      // Persist the supervision relationship in the generalized assignment table
      // (context_type='supervision', context_id = supervisor cid). Additive,
      // idempotent: any current supervision row is ended first.
      await endCurrentSupervision(userCid);
      await insertSupervisionAssignment(userCid, supervisorCid, actor.cid || "system");
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "supervisor_assigned",
        details: `Supervisor set to ${supervisorCid} (persisted via contact_roles)`,
      });
      break;
    }

    case "remove_supervisor": {
      // End any current supervision relationship (additive, idempotent).
      await endSupervisionRelationship(userCid);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "supervisor_removed",
        details: "Supervisor relationship ended (context_type=supervision)",
      });
      break;
    }

    case "set_status":
      if (!payload.status) {
        return { status: 400, body: { success: false, error: "status is required" } };
      }
      await setUserStatus(payload.status, userCid);
      await logPermissionAudit({
        actorCid: actor.cid,
        actorName: actor.name,
        targetCid: userCid,
        targetName,
        action: "status_changed",
        details: `Status changed to ${payload.status}`,
      });
      break;

    default:
      return { status: 400, body: { success: false, error: `Unknown action: ${action}` } };
  }

  invalidateAuthorizationContext(userCid);
  return { status: 200, body: { success: true } };
}
