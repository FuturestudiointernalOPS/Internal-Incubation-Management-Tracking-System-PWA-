/**
 * Authorization — the PERMISSION MATRIX read (SERVICE layer).
 *
 * The read assembly behind `GET /api/engineering/permissions`: the table view's
 * enriched users (explicit profile or role default, groups merged from the
 * user_groups table and the legacy group column, responsibilities), the module
 * catalog + its role/group/profile defaults, and one user's effective
 * permissions with the "who has access and why" explanation.
 *
 * HTTP-free: it reads through `@/models/authorization` and the authorization
 * services, and returns plain data. The controller keeps the
 * `permissions.view_matrix` gate, `initDb`, the query parsing and the response
 * envelope.
 */

import { PERMISSION_MODULES, ACCESS_LEVELS } from "@/server/authz/capabilities";
import { CAPABILITY_CATALOG } from "@/models/authorization/capability-catalog";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { getUserGroups } from "@/models/authorization/accessQueries";
import {
  ensureResponsibilitiesSchema,
  ensurePermissionsSchema,
  seedDefaultResponsibilities,
} from "@/models/authorization/bootstrap";
import {
  buildPermissionExplanation,
  effectivePermissionsFromContext,
  getAuthorizationContext,
} from "@/services/authorization/context";
import { getUserEffectiveProfile } from "@/services/authorization/accessProfiles";
import { listProfileAssignments } from "@/models/authorization/profileAssignmentsStore";
import {
  getContactForEffectivePermissions,
  getCurrentSupervisor,
  getRoleDefaultProfileMappings,
  listAccessProfileDefinitions,
  listActiveAccessProfiles,
  listGroupCapabilities,
  listGroupCapabilitiesForGroup,
  listPermissionTableContacts,
  listRoleAccessProfileDefaultsForTable,
  listRoleCapabilities,
  listRoleCapabilitiesForRole,
  listUserCapabilitiesForUser,
  listUserCapabilityRestrictionsForUser,
  listUserGroupNames,
  listUserResponsibilitiesForTable,
} from "@/models/authorization";

/**
 * Make the read resilient on an un-migrated database: a missing table must
 * never 500 the whole permissions page (the list helpers degrade to empty).
 * Once per process for the seeds.
 */
export async function preparePermissionReads() {
  await ensureResponsibilitiesSchema();
  await ensurePermissionsSchema();
  await seedDefaultResponsibilities();
}

/**
 * The table view's user list. One pass over the contacts, the groups, the
 * responsibilities, the profiles and the role→profile defaults.
 */
export async function buildPermissionTableUsers() {
  const contactsResult = await listPermissionTableContacts();

  const groupsResult = await listUserGroupNames();
  const groupMap = {};
  for (const row of groupsResult.rows) {
    if (!groupMap[row.user_cid]) groupMap[row.user_cid] = [];
    groupMap[row.user_cid].push(row.group_name);
  }

  const responsibilitiesResult = await listUserResponsibilitiesForTable();
  const respMap = {};
  for (const row of responsibilitiesResult.rows) {
    if (!respMap[row.user_cid]) respMap[row.user_cid] = [];
    respMap[row.user_cid].push({ id: row.id, name: row.name, key: row.key, icon: row.icon });
  }

  const profilesResult = await listActiveAccessProfiles();
  const profileMap = {};
  for (const row of profilesResult.rows) {
    profileMap[row.id] = row;
  }

  const roleProfileDefaultsResult = await listRoleAccessProfileDefaultsForTable();
  const roleProfileMap = {};
  for (const row of roleProfileDefaultsResult.rows) {
    roleProfileMap[row.role_name] = { id: row.profile_id, name: row.profile_name };
  }

  return contactsResult.rows.map((contact) => {
    let profile = null;
    // Check explicit profile assignment
    if (contact.access_profile_id && profileMap[contact.access_profile_id]) {
      profile = {
        id: contact.access_profile_id,
        name: profileMap[contact.access_profile_id].name,
        source: "user",
      };
    }
    // Fall back to role default
    if (!profile && roleProfileMap[contact.role]) {
      profile = {
        id: roleProfileMap[contact.role].id,
        name: roleProfileMap[contact.role].name,
        source: "role",
      };
    }
    // Merge groups from user_groups + legacy group_name
    const groups = groupMap[contact.cid] || [];
    if (contact.group_name && !groups.includes(contact.group_name)) {
      groups.unshift(contact.group_name);
    }

    return {
      cid: contact.cid,
      name: contact.name,
      email: contact.email,
      role: contact.role,
      status: contact.status,
      access_profile: profile,
      groups,
      responsibilities: respMap[contact.cid] || [],
      created_at: contact.created_at,
    };
  });
}

/** The module catalog and the role/group/profile defaults that seed the matrix. */
export async function buildPermissionMatrixDefinition() {
  const roleCapabilities = await listRoleCapabilities();
  const groupCapabilities = await listGroupCapabilities();

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

  return {
    modules: PERMISSION_MODULES,
    accessLevels: ACCESS_LEVELS,
    catalog: CAPABILITY_CATALOG,
    roleDefaults: roleCapabilities.rows,
    groupDefaults: groupCapabilities.rows,
    accessProfiles,
    accessProfileDefaults,
  };
}

/**
 * One user's effective permissions: the canonical authorization context, its
 * per-feature explanation, the individual grants/restrictions and the effective
 * access profile. Returns `{ notFound: true }` when the contact does not exist.
 */
export async function buildUserPermissionDetail(userCid) {
  const userResult = await getContactForEffectivePermissions(userCid);
  if (userResult.rows.length === 0) return { notFound: true };

  const user = userResult.rows[0];
  const groups = await getUserGroups(userCid);
  // Canonical authorization context (V2-equivalent + eligibility). The admin UI
  // no longer depends on V1 for the effective permission matrix.
  const authorizationContext = await getAuthorizationContext({
    cid: userCid,
    role: user.role,
    group_name: user.group_name,
  });
  const matrix = effectivePermissionsFromContext(authorizationContext);
  // "Who has access and why": per-feature eligibility (with the identity rows
  // that produced it) + the raw capability inputs per module.
  const explanation = buildPermissionExplanation(authorizationContext);

  // Phase G — the assignment registry, so the explanation shows the profile
  // PERIODS that produced the active profiles (context, source, dates), not just
  // the resulting keys. Best-effort: an un-migrated database has no registry.
  let profileAssignments = [];
  try {
    profileAssignments = (await listProfileAssignments(userCid)).rows || [];
  } catch (_) {}

  const grants = await listUserCapabilitiesForUser(userCid);
  const restrictions = await listUserCapabilityRestrictionsForUser(userCid);
  const effectiveProfile = await getUserEffectiveProfile(userCid, user.role);

  // The persisted supervisor relationship (contact_roles, context_type=
  // 'supervision'). Null when none exists.
  let supervisorCid = null;
  try {
    const supervisorResult = await getCurrentSupervisor(userCid);
    supervisorCid = supervisorResult.rows[0]?.supervisor_cid || null;
  } catch (_) {}

  return {
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
    explanation: { ...explanation, profileAssignments },
    moduleToFeature: MODULE_TO_FEATURE,
    individualGrants: grants.rows,
    individualRestrictions: restrictions.rows,
  };
}

/**
 * Dispatch the GET's read. Returns `{ status, body }` — the controller turns
 * that into the response, so this module never touches HTTP. The branch order is
 * the contract the UI depends on: the table view, then the catalog, then one
 * user, then the role and group defaults.
 */
export async function readPermissionMatrix({ users, userCid, role, group }) {
  if (users === "true") {
    return { status: 200, body: { success: true, users: await buildPermissionTableUsers() } };
  }

  if (!userCid && !role && !group) {
    return { status: 200, body: { success: true, ...(await buildPermissionMatrixDefinition()) } };
  }

  if (userCid) {
    const detail = await buildUserPermissionDetail(userCid);
    if (detail.notFound) {
      return { status: 404, body: { success: false, error: "User not found" } };
    }
    return { status: 200, body: { success: true, ...detail } };
  }

  if (role) {
    const capabilitiesResult = await listRoleCapabilitiesForRole(role);
    return { status: 200, body: { success: true, role, capabilities: capabilitiesResult.rows } };
  }

  if (group) {
    const capabilitiesResult = await listGroupCapabilitiesForGroup(group);
    return { status: 200, body: { success: true, group, capabilities: capabilitiesResult.rows } };
  }
}
