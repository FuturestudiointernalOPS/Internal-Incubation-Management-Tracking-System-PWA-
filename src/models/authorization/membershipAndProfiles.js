import db from "@/lib/db";

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

/**
 * Every role identity that actually has eligibility rows in this database.
 * Used by the Permissions UI so a role the engine enforces is never invisible
 * to the administrator who has to configure it (the agreed identity list is a
 * curated subset; the data is the truth).
 */
export async function listEligibilityRoleIdentities() {
  return db.execute({
    sql: `SELECT DISTINCT identity_value FROM feature_eligibility
          WHERE identity_type = 'role' ORDER BY identity_value`,
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

/**
 * Number of LIVE contacts still assigned the profile. Scoped to the same rows
 * the impact count shows (not soft-deleted/archived), so the blocking message
 * and the number on screen can never disagree.
 */
export async function countProfileUsers(profileId) {
  return db.execute({
    sql: `SELECT COUNT(*) as cnt FROM contacts
          WHERE access_profile_id = ? AND deleted_at IS NULL AND archived_at IS NULL`,
    args: [profileId],
  });
}

/**
 * DELETE guard — names of the contacts still assigned the profile, ordered by
 * name and capped at 10, so the blocking message can say WHO is in the way.
 */
export async function listProfileAssignedNames(profileId) {
  return db.execute({
    sql: `SELECT name FROM contacts
          WHERE access_profile_id = ? AND deleted_at IS NULL AND archived_at IS NULL
          ORDER BY name LIMIT 10`,
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

// NOTE: the base-capability PRECEDENCE that used to live here
// (`getCurrentBaseCapabilities`) is a business rule, not data access (audit A1,
// finding #1). It now lives in `@/services/authorization/baseCapabilities`, over
// the reads in `@/models/authorization/baseCapabilityReads`. No importer pointed
// at the old symbol once the assign route was repointed (grep-audited).

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

/**
 * DELETE — remove a role's default profile mapping, but only while it still
 * points at the given profile (guards against deleting a different profile's
 * default from a stale UI).
 */
export async function removeRoleDefaultProfile(roleName, profileId) {
  return db.execute({
    sql: `DELETE FROM role_access_profile_defaults
          WHERE role_name = ? AND access_profile_id = ?`,
    args: [roleName, profileId],
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

