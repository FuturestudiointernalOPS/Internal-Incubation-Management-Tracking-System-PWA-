/**
 * ImpactOS — Authorization Foundation: ELIGIBILITY
 *
 * Eligibility answers ONE question: "Is this person allowed to RECEIVE this
 * feature?" It is deliberately separate from capability assignment:
 *
 *     ELIGIBLE ≠ GRANTED
 *
 * - Stored in the `feature_eligibility` table (self-healing, idempotent).
 * - The seed (FEATURE_ELIGIBILITY_DEFAULTS) runs ONCE per database as the
 *   "eligibility-bootstrap-seed" migration (see migrations.js) — it fills
 *   rows that have never been configured, then the Permissions UI owns the
 *   configuration. Nothing at boot ever overwrites an administrator's edit.
 * - Missing rows = NOT eligible (fail closed).
 * - D4 — UNION of the identities: as soon as ONE identity allows the feature the
 *   section is open; an `eligible = 0` on one identity never vetoes another
 *   identity's allow (see `evaluateEligibility`).
 * - Super Admin bypasses eligibility entirely (preserved V2 behavior).
 *
 * Layer (see docs/LAYER_SPLIT.md): this module is the REPOSITORY — the schema,
 * the one-time seeds and the shared vocabulary. The eligibility DECISION
 * (`evaluateEligibility`) lives in `@/services/authorization/eligibility`.
 */

import db from "@/lib/db";
import { BASELINE_IDENTITIES } from "@/lib/identity";
import {
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  PROGRAM_ASSIGNMENT_ROWS,
} from "./constants";

// The pure feature/eligibility vocabulary lives in ./constants (one file per
// theme). Re-exported here so the historic import path
// (`@/models/authorization/eligibility`) keeps exposing it unchanged.
export {
  FEATURE_ORDER,
  MODULE_TO_FEATURE,
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  PROGRAM_ASSIGNMENT_ROWS,
} from "./constants";

let eligibilitySchemaPromise = null;

/**
 * Idempotent runtime self-healing for the eligibility table (mirrors the
 * ensurePermissionsSchema pattern used elsewhere). Creates the table on
 * first use so no migration is required.
 */
export function ensureEligibilitySchema() {
  if (!eligibilitySchemaPromise) {
    eligibilitySchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS feature_eligibility (
        id SERIAL PRIMARY KEY,
        feature_key TEXT NOT NULL,
        identity_type TEXT NOT NULL,
        identity_value TEXT NOT NULL,
        eligible INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(feature_key, identity_type, identity_value)
      )`);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_feature_eligibility_lookup
         ON feature_eligibility(feature_key, identity_type, identity_value)`,
      );
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureEligibilitySchema failed:", error.message);
      eligibilitySchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return eligibilitySchemaPromise;
}

/**
 * Insert seed rows of ONE identity kind. Idempotent: existing rows (including
 * admin edits and explicit empty lists) are never touched.
 */
async function seedIdentityRows(featureKey, identityType, values) {
  try {
    await ensureEligibilitySchema();
    for (const value of values || []) {
      await db.execute({
        sql: `INSERT INTO feature_eligibility
                (feature_key, identity_type, identity_value, eligible)
              VALUES (?, ?, ?, 1)
              ON CONFLICT (feature_key, identity_type, identity_value)
              DO NOTHING`,
        args: [featureKey, identityType, value],
      });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Insert seed rows for one feature's ROLE identities. Idempotent: existing rows
 * (including admin edits and explicit empty lists) are never touched.
 */
async function seedFeatureRows(featureKey, roles) {
  return seedIdentityRows(featureKey, "role", roles);
}

/**
 * Seed eligibility from FEATURE_ELIGIBILITY_DEFAULTS. Idempotent: existing
 * rows (including admin edits and explicit empty lists) are never touched.
 */
export async function seedDefaultEligibility() {
  for (const [featureKey, roles] of Object.entries(
    FEATURE_ELIGIBILITY_DEFAULTS,
  )) {
    const result = await seedFeatureRows(featureKey, roles);
    if (!result.success) return result;
  }
  return { success: true };
}

/**
 * Phase H — seed the PROFILE ceilings. The contextual values that used to sit
 * in `FEATURE_ELIGIBILITY_DEFAULTS` are written as `identity_type = 'profile'`
 * rows, so the coverage follows the profile the person HOLDS instead of a role
 * the account no longer carries. Insert-only, own marker: an administrator's
 * decision is never overwritten, and existing databases keep their legacy role
 * rows untouched (nothing is deleted, so nobody loses access).
 */
export async function seedProfileEligibilityDefaults() {
  for (const [featureKey, profiles] of Object.entries(
    FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  )) {
    const result = await seedIdentityRows(featureKey, "profile", profiles);
    if (!result.success) return result;
  }
  return { success: true };
}

/**
 * One-time seed for databases whose eligibility bootstrap already ran before
 * the LMS feature existed (see resolver's "eligibility-lms-bootstrap").
 * Fails closed on error; ON CONFLICT DO NOTHING keeps admin edits intact.
 */
export async function seedLmsFeatureEligibility() {
  return seedFeatureRows("lms", FEATURE_ELIGIBILITY_DEFAULTS.lms || []);
}

/**
 * Phase 6 prerequisite: a venture founder is a BASELINE MEMBER with a venture
 * context, so the ventures feature must be eligible for that baseline —
 * otherwise the capability the Context Roles mapping grants is dead on
 * arrival. Insert-only for the one new role (never overwrites an admin edit),
 * applied once per database through the migration marker.
 */
export async function seedVenturesMemberEligibility() {
  return seedFeatureRows("ventures", ["member"]);
}

/**
 * One-time cleanup: the eligibility matrix is BASELINE roles + PROFILES only.
 *
 * Every `identity_type = 'role'` row whose value is not a baseline identity
 * (`super_admin` / `staff` / `member`) is a leftover of the older role
 * vocabulary: the contextual functions (`participant`, `founder`,
 * `program_manager`, …) and retired labels (`mentor`, `team`, `teacher`, …).
 * Those functions live on PROFILES now, so those role rows are dead weight the
 * engine only ever consulted for accounts that no longer carry the label.
 *
 * DELETES ROLE ROWS ONLY: profile rows are the new ceiling and are untouched,
 * group rows are untouched. Runs ONCE per database through the migration marker
 * `eligibility-baseline-roles-only-v1`; a fresh database has nothing to delete.
 */
export function removeNonBaselineRoleEligibility() {
  const placeholders = BASELINE_IDENTITIES.map(() => "?").join(",");
  return db.execute({
    sql: `DELETE FROM feature_eligibility
          WHERE identity_type = 'role'
            AND identity_value NOT IN (${placeholders})`,
    args: [...BASELINE_IDENTITIES],
  });
}

export async function seedProgramAssignmentEligibility() {
  for (const [featureKey, roles] of Object.entries(PROGRAM_ASSIGNMENT_ROWS)) {
    const result = await seedFeatureRows(featureKey, roles);
    if (!result.success) return result;
  }
  return { success: true };
}
