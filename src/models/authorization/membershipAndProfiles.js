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

// ── Eligibility configuration — the reads the eligibility API needs ─────────

/** feature_eligibility rows for a role identity (fail-closed map built by the caller). */
export async function getRoleEligibilityRows(role) {
  return db.execute({
    sql: `SELECT feature_key, eligible FROM feature_eligibility
          WHERE identity_type = 'role' AND identity_value = ?`,
    args: [role],
  });
}

/** feature_eligibility rows for a PROFILE identity (the profile's own ceiling). */
export async function getProfileEligibilityRows(profileKey) {
  return db.execute({
    sql: `SELECT feature_key, eligible FROM feature_eligibility
          WHERE identity_type = 'profile' AND identity_value = ?`,
    args: [profileKey],
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

// ── /api/engineering/permissions — the identity reads the write path needs ──

/** PUT — target contact row (name/role) + 404 check. */
export async function getContactForAssignment(userCid) {
  return db.execute({
    sql: "SELECT cid, name, role FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT — the user's group names, fed to the eligibility check. */
export async function getUserGroupNames(userCid) {
  return db.execute({
    sql: "SELECT group_name FROM user_groups WHERE user_cid = ?",
    args: [userCid],
  });
}

// ── /api/engineering/permissions/profile-override — per-person overrides ───
// (profiles takeover, decision A1: the override targets a PROFILE KEY, not a
// legacy access-profile id. The old /api/access-profiles/assign is retired.)

/** PUT — target contact row (name/role/profile_key) + 404 check. */
export async function getContactProfileOverrideTarget(userCid) {
  return db.execute({
    sql: "SELECT cid, name, role, profile_key FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT — active profile existence check by KEY before assignment. */
export async function getActiveProfileByKey(profileKey) {
  return db.execute({
    sql: "SELECT key, label FROM profiles WHERE key = ? AND is_active = 1",
    args: [profileKey],
  });
}

/** PUT — persist the profile override (by key) on the contact. */
export async function assignUserProfileKey(profileKey, userCid) {
  return db.execute({
    sql: "UPDATE contacts SET profile_key = ? WHERE cid = ?",
    args: [profileKey, userCid],
  });
}

/** PUT — remove the profile override (fall back to the role default). */
export async function clearUserProfileKeyOverride(userCid) {
  return db.execute({
    sql: "UPDATE contacts SET profile_key = NULL WHERE cid = ?",
    args: [userCid],
  });
}

/** PUT — role-default profile label that applies after the override is removed. */
export async function getRoleDefaultProfileLabel(role) {
  return db.execute({
    sql: `SELECT p.label FROM role_profile_defaults rpd
            JOIN profiles p ON p.key = rpd.profile_key
            WHERE rpd.role_name = ? AND p.is_active = 1`,
    args: [role],
  });
}

/** GET — contact row (with profile_key) for the assignment readback. */
export async function getContactProfileOverrideState(userCid) {
  return db.execute({
    sql: "SELECT cid, name, role, profile_key FROM contacts WHERE cid = ?",
    args: [userCid],
  });
}

/** GET — explicitly assigned profile (key/label) for the readback. */
export async function getProfileSummaryByKey(profileKey) {
  return db.execute({
    sql: "SELECT key, label FROM profiles WHERE key = ?",
    args: [profileKey],
  });
}

/** GET — role-default profile (key/label) for the readback. */
export async function getRoleDefaultProfileSummary(role) {
  return db.execute({
    sql: `SELECT p.key, p.label FROM role_profile_defaults rpd
            JOIN profiles p ON p.key = rpd.profile_key
            WHERE rpd.role_name = ? AND p.is_active = 1`,
    args: [role],
  });
}
