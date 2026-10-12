/**
 * Authorization — profile capabilities + role→profile defaults (REPOSITORY).
 *
 * Tranche 1 of docs/PROFILES_TAKEOVER_MIGRATION.md. This is the ADDITIVE
 * foundation that lets a contextual PROFILE carry its own capabilities, so the
 * `access_profiles` template layer can be retired in a later tranche.
 *
 * Nothing reads these tables yet — the resolver still resolves through
 * `access_profiles` (tranche 3). Creating them changes no access.
 *
 * Additive schema (self-healing, same pattern as `ensureProfilesSchema`):
 *   • profile_capabilities      — the capability set of one profile (by key)
 *   • role_profile_defaults     — the default profile of a baseline role
 *   • profiles.label            — display name for administrator-created profiles
 *   • context_role_profiles.profile_key — the registry points at a profile KEY
 *   • contacts.profile_key      — the per-person override, as a profile KEY
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { ensureProfilesSchema } from "./profilesStore";
import { ensureContextRoleProfilesSchema } from "./contextRoleProfiles";

let profileCapabilitiesSchemaPromise = null;

/**
 * Idempotent runtime self-healing for the profile-capability foundation.
 *
 * The base tables are ensured first (`profiles`, `context_role_profiles`) so the
 * `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements never run against a table
 * that does not exist yet. Fail-soft: the memo clears on error so the next call
 * retries.
 */
export function ensureProfileCapabilitiesSchema() {
  if (!profileCapabilitiesSchemaPromise) {
    profileCapabilitiesSchemaPromise = (async () => {
      await ensureProfilesSchema();
      await ensureContextRoleProfilesSchema();
      await db.execute(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS label TEXT`);
      await db.execute(`CREATE TABLE IF NOT EXISTS profile_capabilities (
        id SERIAL PRIMARY KEY,
        profile_key TEXT NOT NULL,
        module TEXT NOT NULL,
        capability TEXT NOT NULL,
        access_level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(profile_key, module, capability)
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_profile_capabilities_key
        ON profile_capabilities(profile_key)`);
      await db.execute(`CREATE TABLE IF NOT EXISTS role_profile_defaults (
        role_name TEXT PRIMARY KEY,
        profile_key TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(`ALTER TABLE context_role_profiles ADD COLUMN IF NOT EXISTS profile_key TEXT`);
      await db.execute(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS profile_key TEXT`);
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureProfileCapabilitiesSchema failed:", error.message);
      profileCapabilitiesSchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return profileCapabilitiesSchemaPromise;
}

// ── profile_capabilities ─────────────────────────────────────────────────────

/** The capability rows a profile carries. */
export function listProfileCapabilities(profileKey) {
  return db.execute({
    sql: "SELECT module, capability, access_level FROM profile_capabilities WHERE profile_key = ?",
    args: [String(profileKey)],
  });
}

/** Capability row counts per profile key, for a list screen. */
export function listProfileCapabilityCounts() {
  return db.execute(
    `SELECT profile_key, COUNT(*)::int AS capability_count
     FROM profile_capabilities
     GROUP BY profile_key`,
  );
}

/** Remove every capability of one profile. */
export function clearProfileCapabilities(profileKey) {
  return db.execute({
    sql: "DELETE FROM profile_capabilities WHERE profile_key = ?",
    args: [String(profileKey)],
  });
}

/** Insert (or update the level of) one capability of one profile. */
export function upsertProfileCapability(profileKey, module, capability, accessLevel) {
  return db.execute({
    sql: `INSERT INTO profile_capabilities (profile_key, module, capability, access_level)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (profile_key, module, capability) DO UPDATE SET access_level = EXCLUDED.access_level`,
    args: [String(profileKey), String(module), String(capability), Number(accessLevel) || 0],
  });
}

// ── role_profile_defaults ────────────────────────────────────────────────────

/** Every role → profile default mapping. */
export function listRoleProfileDefaults() {
  return db.execute(
    `SELECT role_name, profile_key FROM role_profile_defaults ORDER BY role_name`,
  );
}

/** The default profile key of one role (or an empty result set). */
export function getRoleProfileDefault(roleName) {
  return db.execute({
    sql: "SELECT role_name, profile_key FROM role_profile_defaults WHERE role_name = ?",
    args: [String(roleName)],
  });
}

/** Set the default profile of a role. */
export function upsertRoleProfileDefault({ roleName, profileKey }) {
  return db.execute({
    sql: `INSERT INTO role_profile_defaults (role_name, profile_key)
          VALUES (?, ?)
          ON CONFLICT (role_name) DO UPDATE SET profile_key = EXCLUDED.profile_key`,
    args: [String(roleName), String(profileKey)],
  });
}

/** Remove a role's default profile mapping. */
export function deleteRoleProfileDefault(roleName) {
  return db.execute({
    sql: "DELETE FROM role_profile_defaults WHERE role_name = ?",
    args: [String(roleName)],
  });
}

/** Roles that use a given profile as their default. */
export function listRolesUsingProfileDefault(profileKey) {
  return db.execute({
    sql: "SELECT role_name FROM role_profile_defaults WHERE profile_key = ? ORDER BY role_name",
    args: [String(profileKey)],
  });
}
