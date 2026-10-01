/**
 * Venture platform administration (system configuration) — statements
 * (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/systemAdmin`: the settings /
 * feature-flag / role reads and writes, the admin-activity log writes and reads,
 * and the platform info counts.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 * (Distinct from `@/models/ventureAdmin`, which backs Super-Admin Venture
 * creation.)
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Settings ─────────────────────────────────────────────────────────────────

/** Every system setting, category then key. */
export function selectSystemSettings() {
  return db.execute({ sql: "SELECT * FROM system_settings ORDER BY category, setting_key" });
}

/** Write one setting's value. */
export function updateSettingRow(settingKey, value, updatedBy) {
  return db.execute({
    sql: "UPDATE system_settings SET setting_value=?, updated_by=?, updated_at=NOW() WHERE setting_key=?",
    args: [String(value), updatedBy, settingKey],
  });
}

// ── Feature flags ────────────────────────────────────────────────────────────

/** Every feature flag, category then name. */
export function selectFeatureFlags() {
  return db.execute({ sql: "SELECT * FROM feature_flags ORDER BY category, flag_name" });
}

/** Toggle one feature flag. */
export function updateFeatureFlagRow(flagKey, isEnabled, updatedBy) {
  return db.execute({
    sql: "UPDATE feature_flags SET is_enabled=?, updated_by=?, updated_at=NOW() WHERE flag_key=?",
    args: [isEnabled, updatedBy, flagKey],
  });
}

// ── Roles ────────────────────────────────────────────────────────────────────

/** Every system role, by name. */
export function selectSystemRoles() {
  return db.execute({ sql: "SELECT * FROM system_roles ORDER BY name" });
}

/** Apply a computed SET list to a role. */
export function updateRoleColumns(sets, args) {
  return db.execute({ sql: `UPDATE system_roles SET ${sets.join(",")} WHERE id=?`, args });
}

/** Insert one custom role, returning its id. */
export function insertRole(name, description, permissionsJson, createdBy) {
  return db.execute({
    sql: `INSERT INTO system_roles (name, description, permissions, is_system_role, created_by) VALUES (?, ?, ?::jsonb, FALSE, ?) RETURNING id`,
    args: [name, description, permissionsJson, createdBy],
  });
}

// ── Admin activity log ───────────────────────────────────────────────────────

/** Append a SETTING_UPDATED admin-activity row. */
export function insertSettingUpdatedActivity(adminCid, settingKey, detailsJson) {
  return db.execute({
    sql: `INSERT INTO admin_activity_logs (admin_cid, action, entity_type, entity_id, details) VALUES (?, 'SETTING_UPDATED', 'setting', ?, ?::jsonb)`,
    args: [adminCid, settingKey, detailsJson],
  });
}

/** Append a feature-flag admin-activity row (action supplied by the service). */
export function insertFeatureFlagActivity(adminCid, action, flagKey, detailsJson) {
  return db.execute({
    sql: `INSERT INTO admin_activity_logs (admin_cid, action, entity_type, entity_id, details) VALUES (?, ?, 'feature_flag', ?, ?::jsonb)`,
    args: [adminCid, action, flagKey, detailsJson],
  });
}

/** Append a ROLE_UPDATED admin-activity row. */
export function insertRoleUpdatedActivity(adminCid, roleId, detailsJson) {
  return db.execute({
    sql: `INSERT INTO admin_activity_logs (admin_cid, action, entity_type, entity_id, details) VALUES (?, 'ROLE_UPDATED', 'role', ?, ?::jsonb)`,
    args: [adminCid, roleId, detailsJson],
  });
}

/** Append a ROLE_CREATED admin-activity row. */
export function insertRoleCreatedActivity(adminCid, roleId, detailsJson) {
  return db.execute({
    sql: `INSERT INTO admin_activity_logs (admin_cid, action, entity_type, entity_id, details) VALUES (?, 'ROLE_CREATED', 'role', ?, ?::jsonb)`,
    args: [adminCid, roleId, detailsJson],
  });
}

/** The admin-activity log, newest first. */
export function selectAdminActivityLogs(limit) {
  return db.execute({ sql: "SELECT * FROM admin_activity_logs ORDER BY created_at DESC LIMIT ?", args: [limit] });
}

// ── Platform info counts ─────────────────────────────────────────────────────

/** The database version string. */
export function selectDatabaseVersion() {
  return db.execute({ sql: "SELECT version() as v" });
}

/** Count the platform contacts. */
export function countContacts() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM contacts" });
}

/** Count the platform Ventures. */
export function countVentures() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM ventures" });
}

/** Count the unexpired user sessions. */
export function countActiveSessions() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM user_sessions WHERE expires_at > NOW()" });
}

/** Count the admin actions in the last 24 hours. */
export function countAdminActions24h() {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM admin_activity_logs WHERE created_at > NOW() - INTERVAL '24 hours'" });
}
