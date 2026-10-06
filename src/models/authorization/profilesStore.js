/**
 * Authorization — profiles store (REPOSITORY layer).
 *
 * Phase A of docs/ROADMAP_ROLES_PROFILES_ACCESS.md. Every statement the profile
 * catalogue runs: the self-healing schema, the insert-only seed, the read, and
 * the single-row edit. The validation and the decisions live in
 * `@/services/authorization/profileCatalog`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
 * no decisions.
 */

import db from "@/lib/db";
import { PROFILE_CATALOG } from "./profile-catalog";

let profilesSchemaPromise = null;

/**
 * Idempotent runtime self-healing for the catalogue table (same pattern as
 * ensureContextRoleProfilesSchema / ensureEligibilitySchema — no migration
 * required, fail-soft on error so the next call retries).
 */
export function ensureProfilesSchema() {
  if (!profilesSchemaPromise) {
    profilesSchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        context TEXT NOT NULL,
        allowed_roles JSONB NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_profiles_context ON profiles(context)`,
      );
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureProfilesSchema failed:", error.message);
      profilesSchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return profilesSchemaPromise;
}

/**
 * Seed the catalogue rows. Idempotent: ON CONFLICT DO NOTHING means an
 * administrator's edit (allowed_roles / is_active / notes) is never overwritten,
 * and a later reseed only adds profiles this build introduces.
 *
 * Deliberately THROWS on failure: the one-time migration records itself only
 * when the work resolves, so a failed seed must propagate to be retried on the
 * next boot. The read path wraps this call and tolerates a failure.
 */
export async function seedProfiles() {
  await ensureProfilesSchema();
  for (const profile of PROFILE_CATALOG) {
    await db.execute({
      sql: `INSERT INTO profiles (key, context, allowed_roles, is_active)
            VALUES (?, ?, ?, 1)
            ON CONFLICT (key) DO NOTHING`,
      args: [profile.key, profile.context, JSON.stringify(profile.allowedRoles)],
    });
  }
  return { success: true };
}

/** Every catalogue row, in context then key order. */
export function listProfiles() {
  return db.execute(
    `SELECT key, context, label, allowed_roles, is_active, notes, updated_at
     FROM profiles
     ORDER BY context, key`,
  );
}

/** One catalogue row by key (or an empty result set). */
export function getProfileRow(key) {
  return db.execute({
    sql: `SELECT key, context, label, allowed_roles, is_active, notes, updated_at
          FROM profiles WHERE key = ?`,
    args: [String(key)],
  });
}

/**
 * Create a profile. Insert-only: an existing key is left exactly as it is (the
 * route checks existence first and answers 409).
 */
export function insertProfile({ key, context, allowedRoles, label, notes }) {
  return db.execute({
    sql: `INSERT INTO profiles (key, context, allowed_roles, is_active, label, notes)
          VALUES (?, ?, ?, 1, ?, ?)
          ON CONFLICT (key) DO NOTHING`,
    args: [
      String(key),
      String(context),
      JSON.stringify(allowedRoles || []),
      label || "",
      notes || "",
    ],
  });
}

/** Delete one profile row (capabilities are cleared by the caller). */
export function deleteProfile(key) {
  return db.execute({
    sql: "DELETE FROM profiles WHERE key = ?",
    args: [String(key)],
  });
}

/**
 * Persist an administrator's edit of one profile. `context` and `key` are
 * identity columns and are never changed here.
 */
export function updateProfile({ key, allowedRoles, isActive, notes }) {
  return db.execute({
    sql: `UPDATE profiles
          SET allowed_roles = ?, is_active = ?, notes = ?, updated_at = NOW()
          WHERE key = ?`,
    args: [JSON.stringify(allowedRoles || []), isActive ? 1 : 0, notes || "", String(key)],
  });
}
