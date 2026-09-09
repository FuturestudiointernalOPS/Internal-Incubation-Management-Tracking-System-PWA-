import db from "@/lib/db";

/**
 * Authorization model — data access for the access-control controllers
 * (`/api/org-membership`, `/api/access-profiles/**`,
 * `/api/engineering/permissions/**`).
 *
 * Each function wraps exactly one SQL statement that used to live inline in a
 * controller. SQL is byte-identical to the original queries, so behavior is
 * unchanged — the API jest suites (which mock @/lib/db with SQL string
 * matching) act as the regression net. Statements several controllers run are
 * mirrored 1:1 here: one exported function per former call site.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it operates on.
 */

// ── /api/org-membership — organizational membership lifecycle ──────────────

/**
 * All memberships (optional caller-built WHERE fragment + args), ordered by
 * group then user. Where/args are built by the controller from its filters.
 */
export async function listMemberships(whereSql, args) {
  return db.execute({
    sql: `SELECT gm.user_cid, gm.group_name, gm.started_at, gm.expires_at,
                     gm.status, c.name, c.email, c.role, c.status AS account_status
              FROM group_memberships gm
              LEFT JOIN contacts c ON c.cid = gm.user_cid
              ${whereSql}
              ORDER BY gm.group_name, gm.user_cid`,
    args,
  });
}

/**
 * Membership history events (optional caller-built WHERE fragment + args),
 * newest first, capped at 200 rows.
 */
export async function listMembershipEvents(evWhereSql, evArgs) {
  return db.execute({
    sql: `SELECT ev.user_cid, ev.group_name, ev.action, ev.actor_cid,
                       ev.note, ev.created_at,
                       actor.name AS actor_name
                FROM group_membership_events ev
                LEFT JOIN contacts actor ON actor.cid = ev.actor_cid
                ${evWhereSql}
                ORDER BY ev.created_at DESC
                LIMIT 200`,
    args: evArgs,
  });
}

/** Renewal/end path — update an existing membership row's lifecycle state. */
export async function updateMembershipStatus(
  status,
  startedAt,
  expiresAt,
  updatedBy,
  userCid,
  groupName,
) {
  return db.execute({
    sql: `UPDATE group_memberships
              SET status = ?, started_at = ?, expires_at = ?, updated_by = ?, updated_at = NOW()
              WHERE user_cid = ? AND group_name = ?`,
    args: [status, startedAt, expiresAt, updatedBy, userCid, groupName],
  });
}

/** Join path — insert a new membership row. */
export async function insertMembership(
  userCid,
  groupName,
  startedAt,
  expiresAt,
  status,
  createdBy,
) {
  return db.execute({
    sql: `INSERT INTO group_memberships
                (user_cid, group_name, started_at, expires_at, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userCid, groupName, startedAt, expiresAt, status, createdBy],
  });
}

/** Mirror the membership edge into user_groups so legacy consumers see it. */
export async function syncMembershipUserGroup(userCid, groupName, assignedBy) {
  return db.execute({
    sql: `INSERT INTO user_groups (user_cid, group_name, assigned_by)
              VALUES (?, ?, ?)
              ON CONFLICT (user_cid, group_name) DO NOTHING`,
    args: [userCid, groupName, assignedBy],
  });
}

/** Record one row in the group_membership_events history. */
export async function insertMembershipEvent(
  userCid,
  groupName,
  action,
  actorCid,
  note,
) {
  return db.execute({
    sql: `INSERT INTO group_membership_events
              (user_cid, group_name, action, actor_cid, note)
            VALUES (?, ?, ?, ?, ?)`,
    args: [userCid, groupName, action, actorCid, note],
  });
}

// ── /api/access-profiles — profile CRUD ─────────────────────────────────────

/**
 * role_name rows for a profile that is a role default (used by the PUT
 * eligibility pre-check against the incoming capability payload).
 */
export async function getRoleDefaultRoles(profileId) {
  return db.execute({
    sql: "SELECT role_name FROM role_access_profile_defaults WHERE access_profile_id = ?",
    args: [profileId],
  });
}

/** feature_eligibility rows for a role identity (fail-closed map built by the caller). */
export async function getRoleEligibilityRows(role) {
  return db.execute({
    sql: `SELECT feature_key, eligible FROM feature_eligibility
          WHERE identity_type = 'role' AND identity_value = ?`,
    args: [role],
  });
}

/** Single profile definition row — 404 check + payload for GET ?id=X. */
export async function getAccessProfileById(profileId) {
  return db.execute({
    sql: "SELECT id, name, description, is_active FROM access_profiles WHERE id = ?",
    args: [profileId],
  });
}

/** Capability rows of one profile, ordered by module then capability. */
export async function getProfileCapabilities(profileId) {
  return db.execute({
    sql: "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ? ORDER BY module, capability",
    args: [profileId],
  });
}

/** All profiles with a per-profile capability count (GET list payload). */
export async function listAccessProfiles() {
  return db.execute({
    sql: `SELECT ap.*,
            (SELECT COUNT(*) FROM access_profile_capabilities apc WHERE apc.profile_id = ap.id) as capability_count
            FROM access_profiles ap ORDER BY ap.name`,
  });
}

/** role → access_profile defaults joined with profile names (GET list payload). */
export async function listRoleAccessProfileDefaults() {
  return db.execute({
    sql: `SELECT rpd.role_name, rpd.access_profile_id, ap.name as profile_name
            FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            ORDER BY rpd.role_name`,
  });
}

/** Create a profile (active by default) and return its id. */
export async function createAccessProfile(name, description) {
  return db.execute({
    sql: `INSERT INTO access_profiles (name, description, is_active)
            VALUES (?, ?, 1) RETURNING id`,
    args: [name, description],
  });
}

/** Capability row for the freshly created profile (POST flow). */
export async function insertProfileCapability(profileId, module, capability, level) {
  return db.execute({
    sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                  VALUES (?, ?, ?, ?)`,
    args: [profileId, module, capability, level],
  });
}

/** id/name existence check before updating a profile (PUT). */
export async function getAccessProfileMeta(id) {
  return db.execute({
    sql: "SELECT id, name FROM access_profiles WHERE id = ?",
    args: [id],
  });
}

/** Rename a profile (PUT). */
export async function updateAccessProfileName(name, id) {
  return db.execute({
    sql: "UPDATE access_profiles SET name = ?, updated_at = NOW() WHERE id = ?",
    args: [name, id],
  });
}

/** Change a profile's description (PUT). */
export async function updateAccessProfileDescription(description, id) {
  return db.execute({
    sql: "UPDATE access_profiles SET description = ?, updated_at = NOW() WHERE id = ?",
    args: [description, id],
  });
}

/** Role-default refs guard before a role-default profile is disabled (PUT is_active=0). */
export async function getRoleDefaultRefs(profileId) {
  return db.execute({
    sql: "SELECT role_name FROM role_access_profile_defaults WHERE access_profile_id = ?",
    args: [profileId],
  });
}

/** Enable/disable a profile (PUT). */
export async function updateAccessProfileActiveState(isActive, id) {
  return db.execute({
    sql: "UPDATE access_profiles SET is_active = ?, updated_at = NOW() WHERE id = ?",
    args: [isActive, id],
  });
}

/** Delete all capability rows of a profile before the set is replaced (PUT). */
export async function clearProfileCapabilities(profileId) {
  return db.execute({
    sql: "DELETE FROM access_profile_capabilities WHERE profile_id = ?",
    args: [profileId],
  });
}

/** Capability row written after the profile's old set was cleared (PUT flow). */
export async function replaceProfileCapability(profileId, module, capability, level) {
  return db.execute({
    sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                  VALUES (?, ?, ?, ?)`,
    args: [profileId, module, capability, level],
  });
}

/** Role-default refs guard before a profile is deleted (DELETE). */
export async function getRoleDefaultsForProfile(profileId) {
  return db.execute({
    sql: "SELECT role_name FROM role_access_profile_defaults WHERE access_profile_id = ?",
    args: [profileId],
  });
}

/** Number of contacts still assigned the profile (DELETE audit detail). */
export async function countProfileUsers(profileId) {
  return db.execute({
    sql: "SELECT COUNT(*) as cnt FROM contacts WHERE access_profile_id = ?",
    args: [profileId],
  });
}

/** Profile name for the delete audit entry (DELETE). */
export async function getAccessProfileName(profileId) {
  return db.execute({
    sql: "SELECT name FROM access_profiles WHERE id = ?",
    args: [profileId],
  });
}

/** Delete the profile — capabilities are removed by cascade. */
export async function deleteAccessProfile(profileId) {
  return db.execute({
    sql: "DELETE FROM access_profiles WHERE id = ?",
    args: [profileId],
  });
}

// ── /api/access-profiles/assign — per-user profile overrides ───────────────

/** PUT — target contact row (name/role/access_profile_id) + 404 check. */
export async function getContactForAssignment(userCid) {
  return db.execute({
    sql: "SELECT cid, name, role, access_profile_id FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT — active-profile existence check before assignment. */
export async function getActiveAccessProfile(profileId) {
  return db.execute({
    sql: "SELECT id, name FROM access_profiles WHERE id = ? AND is_active = 1",
    args: [profileId],
  });
}

/** PUT — the user's group names, fed to the eligibility check. */
export async function getUserGroupNames(userCid) {
  return db.execute({
    sql: "SELECT group_name FROM user_groups WHERE user_cid = ?",
    args: [userCid],
  });
}

/** PUT — persist the profile override on the contact. */
export async function assignUserAccessProfile(profileId, userCid) {
  return db.execute({
    sql: "UPDATE contacts SET access_profile_id = ? WHERE cid = ?",
    args: [profileId, userCid],
  });
}

/** PUT — remove the profile override (fall back to the role default). */
export async function clearUserAccessProfileOverride(userCid) {
  return db.execute({
    sql: "UPDATE contacts SET access_profile_id = NULL WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT — role-default profile name that applies after the override is removed. */
export async function getRoleDefaultProfileName(role) {
  return db.execute({
    sql: `SELECT ap.name FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            WHERE rpd.role_name = ?`,
    args: [role],
  });
}

/** GET — contact row (with access_profile_id) for the assignment readback. */
export async function getContactAssignmentState(userCid) {
  return db.execute({
    sql: "SELECT cid, name, role, access_profile_id FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/** GET — explicitly assigned profile id/name for the readback. */
export async function getAccessProfileSummary(profileId) {
  return db.execute({
    sql: "SELECT id, name FROM access_profiles WHERE id = ?",
    args: [profileId],
  });
}

/** GET — role-default profile id/name for the readback. */
export async function getRoleDefaultAccessProfile(role) {
  return db.execute({
    sql: `SELECT ap.id, ap.name FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            WHERE rpd.role_name = ?`,
    args: [role],
  });
}

// ── /api/access-profiles/role-defaults — role → profile defaults ───────────

/** PUT — active-profile existence check for a new role default. */
export async function getActiveProfileForRoleDefault(profileId) {
  return db.execute({
    sql: "SELECT id, name FROM access_profiles WHERE id = ? AND is_active = 1",
    args: [profileId],
  });
}

/** PUT — upsert the role → profile default mapping. */
export async function setRoleDefaultProfile(roleName, profileId) {
  return db.execute({
    sql: `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
            VALUES (?, ?)
            ON CONFLICT (role_name) DO UPDATE SET access_profile_id = ?`,
    args: [roleName, profileId, profileId],
  });
}

/** GET — all role → profile default mappings with profile names + active flag. */
export async function listRoleDefaultMappings() {
  return db.execute({
    sql: `SELECT rpd.role_name, ap.id as profile_id, ap.name as profile_name, ap.is_active
            FROM role_access_profile_defaults rpd
            JOIN access_profiles ap ON ap.id = rpd.access_profile_id
            ORDER BY rpd.role_name`,
  });
}

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

/** GET users=true — all contacts for the permission table, by name. */
export async function listPermissionTableContacts() {
  return db.execute({
    sql: "SELECT cid, name, email, role, status, access_profile_id, group_name, created_at FROM contacts ORDER BY name ASC",
  });
}

/** GET modules payload — all profile definitions, by name. */
export async function listAccessProfileDefinitions() {
  return db.execute({
    sql: "SELECT id, name, description, is_active FROM access_profiles ORDER BY name",
  });
}

/** GET modules payload — role → profile default mappings. */
export async function getRoleDefaultProfileMappings() {
  return db.execute({
    sql: `SELECT rpd.role_name, ap.id as profile_id, ap.name as profile_name
                FROM role_access_profile_defaults rpd
                JOIN access_profiles ap ON ap.id = rpd.access_profile_id`,
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
 */
export async function getProfileImpactCounts(profileId) {
  const [directRes, roleRes] = await Promise.all([
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
  ]);
  const direct = Number(directRes.rows[0]?.n || 0);
  const roleDefault = Number(roleRes.rows[0]?.n || 0);
  return { profile_id: profileId, direct, roleDefault, total: direct + roleDefault };
}
