/**
 * VENTURE PLATFORM ADMINISTRATION (system configuration).
 *
 * The system settings (grouped + typed), the feature flags, the roles, the
 * platform info and the admin-activity log.
 *
 * The decisions — the typed setting values, the flag/role activity actions, the
 * custom-role flag and the platform-version fallbacks — live here; every
 * statement is in `@/models/ventureSystemAdminStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) — see
 * docs/LAYER_SPLIT.md. (Distinct from `@/models/ventureAdmin`, which backs
 * Super-Admin Venture creation.)
 */

import {
  selectSystemSettings,
  updateSettingRow,
  selectFeatureFlags,
  updateFeatureFlagRow,
  selectSystemRoles,
  updateRoleColumns,
  insertRole,
  insertSettingUpdatedActivity,
  insertFeatureFlagActivity,
  insertRoleUpdatedActivity,
  insertRoleCreatedActivity,
  selectAdminActivityLogs,
  selectDatabaseVersion,
  countContacts,
  countVentures,
  countActiveSessions,
  countAdminActions24h,
} from "@/models/ventureSystemAdminStore";

/**
 * Get all system settings grouped by category.
 */
export async function getSystemSettings() {
  const result = await selectSystemSettings();
  const settings = {};
  for (const row of result.rows || []) {
    if (!settings[row.category]) settings[row.category] = {};
    let settingValue = row.setting_value;
    if (row.setting_type === "boolean") settingValue = settingValue === "true";
    else if (row.setting_type === "integer") settingValue = parseInt(settingValue) || 0;
    settings[row.category][row.setting_key] = { value: settingValue, type: row.setting_type, description: row.description, updated_at: row.updated_at };
  }
  return settings;
}

export async function updateSetting(settingKey, value, updatedBy) {
  await updateSettingRow(settingKey, value, updatedBy||"system");
  await insertSettingUpdatedActivity(updatedBy||"system", settingKey, JSON.stringify({ setting_key: settingKey, new_value: value }));
  return { success: true };
}

// ─── Feature Flags ─────────────────────────────────────────────────────────

export async function getFeatureFlags() {
  const result = await selectFeatureFlags();
  return result.rows || [];
}

export async function updateFeatureFlag(flagKey, isEnabled, updatedBy) {
  await updateFeatureFlagRow(flagKey, isEnabled ? 1 : 0, updatedBy||"system");
  await insertFeatureFlagActivity(updatedBy||"system", isEnabled ? 'FEATURE_ENABLED' : 'FEATURE_DISABLED', flagKey, JSON.stringify({ flag_key: flagKey, is_enabled: isEnabled }));
  return { success: true };
}

// ─── Role Management ───────────────────────────────────────────────────────

export async function getSystemRoles() {
  const result = await selectSystemRoles();
  return (result.rows || []).map((role) => ({
    ...role,
    permissions: typeof role.permissions === "string" ? JSON.parse(role.permissions) : (role.permissions || {}),
  }));
}

export async function updateRole(roleId, updates) {
  const allowed = ["name", "description", "permissions", "is_active"];
  const sets = []; const args = [];
  for (const column of allowed) {
    if (updates[column] !== undefined) {
      if (column === "permissions") { sets.push("permissions=?::jsonb"); args.push(JSON.stringify(updates[column])); }
      else { sets.push(`${column}=?`); args.push(updates[column]); }
    }
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at=NOW()"); args.push(roleId);
  await updateRoleColumns(sets, args);
  await insertRoleUpdatedActivity(updates._updated_by||"system", String(roleId), JSON.stringify({ role_id: roleId, updates }));
  return { updated: true };
}

export async function createRole({ name, description, permissions, createdBy }) {
  const id = (await insertRole(name.trim(), description||null, JSON.stringify(permissions||{}), createdBy||"system")).rows[0]?.id;
  await insertRoleCreatedActivity(createdBy||"system", String(id), JSON.stringify({ name, permissions }));
  return { id };
}

// ─── System Info ───────────────────────────────────────────────────────────

export async function getSystemInfo() {
  const [versionRes, usersRes, venturesRes, sessionsRes, logsRes] = await Promise.all([
    selectDatabaseVersion().catch(() => ({ rows: [{ v: "Unknown" }] })),
    countContacts().catch(() => ({ rows: [{ c: 0 }] })),
    countVentures().catch(() => ({ rows: [{ c: 0 }] })),
    countActiveSessions().catch(() => ({ rows: [{ c: 0 }] })),
    countAdminActions24h().catch(() => ({ rows: [{ c: 0 }] })),
  ]);

  return {
    database_version: versionRes.rows[0]?.v || "Unknown",
    total_users: parseInt(usersRes.rows[0]?.c || 0),
    total_ventures: parseInt(venturesRes.rows[0]?.c || 0),
    active_sessions: parseInt(sessionsRes.rows[0]?.c || 0),
    admin_actions_24h: parseInt(logsRes.rows[0]?.c || 0),
    platform_version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
    node_env: process.env.NODE_ENV || "development",
  };
}

export async function getAdminActivityLogs(limit = 50) {
  const result = await selectAdminActivityLogs(limit);
  return result.rows || [];
}
