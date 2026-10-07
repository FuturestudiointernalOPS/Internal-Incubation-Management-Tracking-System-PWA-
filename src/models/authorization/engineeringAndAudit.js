import db from "@/lib/db";

// ── /api/engineering/permissions — permission matrix + individual grants ───

/**
 * Resilient read executor: a missing table (migration not yet applied) must
 * never 500 the permissions matrix page — it degrades to an empty list.
 */
export async function runSafeQuery(sql, args = []) {
  try {
    return await db.execute({ sql, args });
  } catch (_) {
    return { rows: [] };
  }
}

/** GET users=true — group names per user (degrades if the table is missing). */
export function listUserGroupNames() {
  return runSafeQuery("SELECT user_cid, group_name FROM user_groups");
}

/** GET users=true — active responsibilities per user. */
export function listUserResponsibilitiesForTable() {
  return runSafeQuery(`SELECT ur.user_cid, r.id, r.name, r.key, r.icon
              FROM user_responsibilities ur
              JOIN responsibilities r ON r.id = ur.responsibility_id
              WHERE r.is_active = 1`);
}

/** GET users=true — active profiles (key + label). */
export function listActiveAccessProfiles() {
  return runSafeQuery("SELECT key AS id, label AS name FROM profiles WHERE is_active = 1");
}

/** GET users=true — role-to-profile defaults (profile KEY form). */
export function listRoleAccessProfileDefaultsForTable() {
  return runSafeQuery(`SELECT rpd.role_name, rpd.profile_key as profile_id, p.label as profile_name
              FROM role_profile_defaults rpd
              JOIN profiles p ON p.key = rpd.profile_key`);
}

/** GET users=true — a user's individual capability grants. */
export function listUserCapabilitiesForUser(userCid) {
  return runSafeQuery(
    "SELECT * FROM user_capabilities WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())",
    [userCid],
  );
}

/** GET users=true — a user's individual capability restrictions. */
export function listUserCapabilityRestrictionsForUser(userCid) {
  return runSafeQuery(
    "SELECT * FROM user_capability_restrictions WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())",
    [userCid],
  );
}

/** GET (no filter) — every role capability default. */
export function listRoleCapabilities() {
  return runSafeQuery("SELECT * FROM role_capabilities ORDER BY role, module, capability");
}

/** GET (no filter) — every group capability default. */
export function listGroupCapabilities() {
  return runSafeQuery("SELECT * FROM group_capabilities ORDER BY group_name, module, capability");
}

/** GET ?role= — one role's capability defaults. */
export function listRoleCapabilitiesForRole(role) {
  return runSafeQuery("SELECT * FROM role_capabilities WHERE role = ? ORDER BY module, capability", [role]);
}

/** GET ?group= — one group's capability defaults. */
export function listGroupCapabilitiesForGroup(group) {
  return runSafeQuery("SELECT * FROM group_capabilities WHERE group_name = ? ORDER BY module, capability", [group]);
}

/** GET users=true — all contacts for the permission table, by name. */
export async function listPermissionTableContacts() {
  return db.execute({
    sql: "SELECT cid, name, email, role, status, profile_key, group_name, created_at FROM contacts ORDER BY name ASC",
  });
}

/** GET modules payload — all profile definitions, by label. */
export async function listAccessProfileDefinitions() {
  return db.execute({
    sql: "SELECT key AS id, label AS name, context, is_active FROM profiles ORDER BY label",
  });
}

/** GET modules payload — role → profile default mappings. */
export async function getRoleDefaultProfileMappings() {
  return db.execute({
    sql: `SELECT rpd.role_name, rpd.profile_key as profile_id, p.label as profile_name
                FROM role_profile_defaults rpd
                JOIN profiles p ON p.key = rpd.profile_key`,
  });
}

/** GET ?user_cid — contact basics (404 check before the effective matrix). */
export async function getContactForEffectivePermissions(userCid) {
  return db.execute({
    sql: "SELECT cid, name, email, role, status FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/** GET ?user_cid — current supervisor cid persisted via contact_roles. */
export async function getCurrentSupervisor(userCid) {
  return db.execute({
    sql: `SELECT context_id AS supervisor_cid FROM contact_roles
                WHERE contact_cid = ? AND context_type = 'supervision' AND is_current = true
                ORDER BY started_at DESC LIMIT 1`,
    args: [userCid],
  });
}

/** PUT — target user's name/role for the audit trail + eligibility check. */
export async function getContactNameAndRole(userCid) {
  return db.execute({
    sql: "SELECT name, role FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT promote_super_admin — set the contact role directly. */
export async function promoteContactToSuperAdmin(userCid) {
  return db.execute({
    sql: "UPDATE contacts SET role = 'super_admin' WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT remove_super_admin — demote the contact back to staff. */
export async function demoteContactFromSuperAdmin(userCid) {
  return db.execute({
    sql: "UPDATE contacts SET role = 'staff' WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT grant/revoke — current individual grant level, or no rows when absent.
 *  Read BEFORE the write so the audit trail can record the previous value. */
export async function getUserCapabilityGrant(userCid, module, capability) {
  return db.execute({
    sql: "SELECT access_level FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ?",
    args: [userCid, module, capability],
  });
}

/** PUT grant — upsert an individual capability grant (with expiry). */
export async function grantUserCapability(
  userCid,
  module,
  capability,
  accessLevel,
  grantedBy,
  expiresAt,
) {
  return db.execute({
    sql: `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_cid, module, capability) DO UPDATE SET access_level = ?, granted_by = ?, expires_at = ?`,
    args: [
      userCid,
      module,
      capability,
      accessLevel,
      grantedBy,
      expiresAt,
      accessLevel,
      grantedBy,
      expiresAt,
    ],
  });
}

/** PUT revoke — remove an individual capability grant. */
export async function revokeUserCapability(userCid, module, capability) {
  return db.execute({
    sql: "DELETE FROM user_capabilities WHERE user_cid = ? AND module = ? AND capability = ?",
    args: [userCid, module, capability],
  });
}

/** PUT restrict/unrestrict — whether an explicit block row exists today. */
export async function getUserCapabilityBlock(userCid, module, capability) {
  return db.execute({
    sql: "SELECT 1 FROM user_capability_restrictions WHERE user_cid = ? AND module = ? AND capability = ?",
    args: [userCid, module, capability],
  });
}

/** PUT set_role_default — current role default level, or no rows when absent. */
export async function getRoleDefaultCapability(role, module, capability) {
  return db.execute({
    sql: "SELECT access_level FROM role_capabilities WHERE role = ? AND module = ? AND capability = ?",
    args: [role, module, capability],
  });
}

/** PUT restrict — upsert an individual capability restriction (with expiry). */
export async function restrictUserCapability(
  userCid,
  module,
  capability,
  restrictedBy,
  expiresAt,
) {
  return db.execute({
    sql: `INSERT INTO user_capability_restrictions (user_cid, module, capability, restricted_by, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (user_cid, module, capability) DO UPDATE SET restricted_by = ?, expires_at = ?`,
    args: [
      userCid,
      module,
      capability,
      restrictedBy,
      expiresAt,
      restrictedBy,
      expiresAt,
    ],
  });
}

/** PUT unrestrict — remove an individual capability restriction. */
export async function unrestrictUserCapability(userCid, module, capability) {
  return db.execute({
    sql: "DELETE FROM user_capability_restrictions WHERE user_cid = ? AND module = ? AND capability = ?",
    args: [userCid, module, capability],
  });
}

/** PUT set_role_default — upsert a role_capabilities row. */
export async function setRoleDefaultCapability(role, module, capability, accessLevel) {
  return db.execute({
    sql: `INSERT INTO role_capabilities (role, module, capability, access_level)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (role, module, capability) DO UPDATE SET access_level = ?`,
    args: [role, module, capability, accessLevel, accessLevel],
  });
}

/** PUT set_group_default — upsert a group_capabilities row. */
export async function setGroupDefaultCapability(groupName, module, capability, accessLevel) {
  return db.execute({
    sql: `INSERT INTO group_capabilities (group_name, module, capability, access_level)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (group_name, module, capability) DO UPDATE SET access_level = ?`,
    args: [groupName, module, capability, accessLevel, accessLevel],
  });
}

/** PUT set_group_default — current group default level, or no rows when absent. */
export async function getGroupDefaultCapability(groupName, module, capability) {
  return db.execute({
    sql: "SELECT access_level FROM group_capabilities WHERE group_name = ? AND module = ? AND capability = ?",
    args: [groupName, module, capability],
  });
}

/** PUT set_access_profile — point the contact at a profile override. */
export async function setUserAccessProfile(profileId, userCid) {
  return db.execute({
    sql: "UPDATE contacts SET access_profile_id = ? WHERE cid = ?",
    args: [profileId, userCid],
  });
}

/** PUT set_role — change the contact's role. */
export async function setUserRole(role, userCid) {
  return db.execute({
    sql: "UPDATE contacts SET role = ? WHERE cid = ?",
    args: [role, userCid],
  });
}

/** PUT set_supervisor — supervisor existence check. */
export async function contactExistsById(contactCid) {
  return db.execute({
    sql: "SELECT 1 FROM contacts WHERE cid = ? LIMIT 1",
    args: [contactCid],
  });
}

/** PUT set_supervisor — close any current supervision row before writing. */
export async function endCurrentSupervision(userCid) {
  return db.execute({
    sql: `UPDATE contact_roles
                SET is_current = false, ended_at = NOW(), status = 'removed'
                WHERE contact_cid = ? AND context_type = 'supervision' AND is_current = true`,
    args: [userCid],
  });
}

/** PUT set_supervisor — persist the supervision relationship (contact_roles). */
export async function insertSupervisionAssignment(userCid, supervisorCid, assignedBy) {
  return db.execute({
    sql: `INSERT INTO contact_roles
                  (contact_cid, role, context_type, context_id, is_current, title, scope, status, assigned_by)
                VALUES (?, 'intern', 'supervision', ?, true, 'supervised_by', '{}'::jsonb, 'active', ?)`,
    args: [userCid, supervisorCid, assignedBy],
  });
}

/** PUT remove_supervisor — end any current supervision row (idempotent). */
export async function endSupervisionRelationship(userCid) {
  return db.execute({
    sql: `UPDATE contact_roles
                SET is_current = false, ended_at = NOW(), status = 'removed'
                WHERE contact_cid = ? AND context_type = 'supervision' AND is_current = true`,
    args: [userCid],
  });
}

/** PUT set_status — change the contact's account status. */
export async function setUserStatus(status, userCid) {
  return db.execute({
    sql: "UPDATE contacts SET status = ? WHERE cid = ?",
    args: [status, userCid],
  });
}

// ── /api/engineering/permissions/eligibility — feature eligibility config ──

/** All feature_eligibility rows (GET catalog + PUT refresh payload). */
export async function listFeatureEligibilityRows() {
  return db.execute({
    sql: `SELECT feature_key, identity_type, identity_value, eligible
          FROM feature_eligibility
          ORDER BY feature_key, identity_type, identity_value`,
    args: [],
  });
}

/** GET — distinct group names present in user_groups. */
export async function listDistinctUserGroupNames() {
  return db.execute({
    sql: "SELECT DISTINCT group_name FROM user_groups WHERE group_name IS NOT NULL AND group_name != ''",
    args: [],
  });
}

/** GET — distinct group names present in contacts.group_name (fallback). */
export async function listDistinctContactGroupNames() {
  return db.execute({
    sql: "SELECT DISTINCT group_name FROM contacts WHERE group_name IS NOT NULL AND group_name != ''",
    args: [],
  });
}

/** PUT — current eligible value of one identity row (audit trail input). */
export async function getEligibilityRow(featureKey, identityType, identityValue) {
  return db.execute({
    sql: `SELECT eligible FROM feature_eligibility
                WHERE feature_key = ? AND identity_type = ? AND identity_value = ?`,
    args: [featureKey, identityType, identityValue],
  });
}

/** PUT — fail-closed unset: remove the identity's eligibility row. */
export async function deleteEligibilityRow(featureKey, identityType, identityValue) {
  return db.execute({
    sql: `DELETE FROM feature_eligibility
                WHERE feature_key = ? AND identity_type = ? AND identity_value = ?`,
    args: [featureKey, identityType, identityValue],
  });
}

/** PUT — set/override one identity's feature eligibility. */
export async function upsertEligibilityRow(featureKey, identityType, identityValue, eligible) {
  return db.execute({
    sql: `INSERT INTO feature_eligibility
                  (feature_key, identity_type, identity_value, eligible)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (feature_key, identity_type, identity_value)
                DO UPDATE SET eligible = EXCLUDED.eligible`,
    args: [featureKey, identityType, identityValue, eligible],
  });
}

// ── /api/engineering/permissions/audit — read-only audit viewer ────────────

/** Total rows matching the caller-built WHERE fragment (pagination count). */
export async function countPermissionAudits(whereSql, args) {
  return db.execute({
    sql: `SELECT COUNT(*) AS n FROM permission_audit_log ${whereSql}`,
    args,
  });
}

/** One page of audit entries (newest first, LIMIT/OFFSET), caller-built WHERE. */
export async function listPermissionAudits(whereSql, args) {
  return db.execute({
    sql: `SELECT id, actor_cid, actor_name, target_cid, target_name,
                     action, module, capability, previous_value, new_value,
                     details, created_at
              FROM permission_audit_log
              ${whereSql}
              ORDER BY created_at DESC, id DESC
              LIMIT ? OFFSET ?`,
    args,
  });
}

/**
 * Phase 3 — impact preview: how many contacts resolve to one access profile.
 * Mirrors the resolver's profile resolution (user override → role default):
 * direct = contacts.access_profile_id = P; roleDefault = profile-less
 * contacts whose stored role maps to P via role_access_profile_defaults.
 *
 * contextBindings counts context_role_profiles rows pointing at P — a MAPPING
 * count, not people, so it is deliberately kept out of `total` (which stays
 * direct + roleDefault). contextRoles carries "<context>:<role_key>" strings
 * for those rows so callers can say exactly which mappings are in the way.
 */
export async function getProfileImpactCounts(profileId) {
  const [directRes, roleRes, contextRes] = await Promise.all([
    db.execute({
      sql: "SELECT COUNT(*) AS n FROM contacts WHERE access_profile_id = ? AND deleted_at IS NULL AND archived_at IS NULL",
      args: [profileId],
    }),
    db.execute({
      sql: `SELECT COUNT(*) AS n FROM contacts c
            WHERE c.access_profile_id IS NULL AND c.deleted_at IS NULL AND c.archived_at IS NULL
              AND EXISTS (SELECT 1 FROM role_access_profile_defaults rpd
                          WHERE rpd.access_profile_id = ? AND LOWER(rpd.role_name) = LOWER(c.role))`,
      args: [profileId],
    }),
    db.execute({
      sql: `SELECT context, role_key FROM context_role_profiles
            WHERE profile_id = ? ORDER BY context, role_key`,
      args: [profileId],
    }),
  ]);
  const direct = Number(directRes.rows[0]?.n || 0);
  const roleDefault = Number(roleRes.rows[0]?.n || 0);
  const contextRoles = (contextRes.rows || []).map(
    (row) => `${row.context}:${row.role_key}`,
  );
  return {
    profile_id: profileId,
    direct,
    roleDefault,
    total: direct + roleDefault,
    contextBindings: contextRoles.length,
    contextRoles,
  };
}

