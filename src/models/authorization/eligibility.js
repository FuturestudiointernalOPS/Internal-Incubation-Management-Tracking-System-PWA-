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
 * - An explicit `eligible = 0` row wins over any `eligible = 1` row.
 * - Super Admin bypasses eligibility entirely (preserved V2 behavior).
 */

import db from "@/lib/db";
import { FEATURE_ELIGIBILITY_DEFAULTS } from "./eligibility-defaults";

export { FEATURE_ELIGIBILITY_DEFAULTS };

// Capability module → feature key. The resolver authorizes against capability
// modules (PERMISSION_MODULES); eligibility is expressed per feature
// (responsibility-level concept the Product Owner configures).
export const MODULE_TO_FEATURE = {
  contacts: "crm",
  // P1: duplicates + bulk_upload are CRM modules — any future grant of their
  // capabilities is gated by crm feature eligibility (participant/founder/
  // facilitator remain ineligible for crm by default).
  duplicates: "crm",
  bulk_upload: "crm",
  finance: "finance",
  programs: "program_management",
  projects: "project_ownership",
  users: "user_management",
  reports: "reporting",
  messaging: "communication",
  internal_comms: "communication",
  knowledge: "knowledge_base",
  tasks: "tasks",
  ventures: "ventures",
  investor: "investor",
  permissions: "user_management",
  engineering: "engineering",
  settings: "system_settings",
  facilitator: "program_management",
  lms: "lms",
};

// FEATURE_ELIGIBILITY_DEFAULTS lives in ./eligibility-defaults (pure module,
// single source of truth shared with the responsibility defaults).

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
    })().catch((e) => {
      console.warn("[Authz] ensureEligibilitySchema failed:", e.message);
      eligibilitySchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return eligibilitySchemaPromise;
}

/**
 * Insert seed rows for one feature. Idempotent: existing rows (including
 * admin edits and explicit empty lists) are never touched.
 */
async function seedFeatureRows(featureKey, roles) {
  try {
    await ensureEligibilitySchema();
    for (const role of roles || []) {
      await db.execute({
        sql: `INSERT INTO feature_eligibility
                (feature_key, identity_type, identity_value, eligible)
              VALUES (?, 'role', ?, 1)
              ON CONFLICT (feature_key, identity_type, identity_value)
              DO NOTHING`,
        args: [featureKey, role],
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
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
 * Pure eligibility evaluation over pre-loaded rows.
 *
 * @param {Array<{feature_key, eligible}>} rows
 *   Rows already filtered to the user's identities (role + groups).
 * @param {string} featureKey
 * @returns {boolean} true when at least one identity is eligible AND no
 *   identity explicitly denies the feature.
 */

export function evaluateEligibility(rows, featureKey) {
  let anyEligible = false;
  for (const row of rows || []) {
    if (row.feature_key !== featureKey) continue;
    if (Number(row.eligible) === 1) anyEligible = true;
    else return false; // explicit deny wins over any allow
  }
  return anyEligible; // missing rows = not eligible (fail closed)
}
