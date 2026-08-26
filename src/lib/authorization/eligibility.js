/**
 * ImpactOS — Authorization Foundation: ELIGIBILITY
 *
 * Eligibility answers ONE question: "Is this person allowed to RECEIVE this
 * feature?" It is deliberately separate from capability assignment:
 *
 *     ELIGIBLE ≠ GRANTED
 *
 * - Stored in the `feature_eligibility` table (self-healing, idempotent).
 * - Seeds reproduce TODAY'S route allowlists (verified in the authorization
 *   inventory) — NOT featureAccess.js, which is known to drift from routes.
 * - Missing rows = NOT eligible (fail closed).
 * - An explicit `eligible = 0` row wins over any `eligible = 1` row.
 * - Super Admin bypasses eligibility entirely (preserved V2 behavior).
 *
 * Phase 0: no feature route enforces this yet. The resolver makes it
 * available so feature-by-feature migration can safely happen later.
 */

import db from "@/lib/db";

// Capability module → feature key. The resolver authorizes against capability
// modules (PERMISSION_MODULES); eligibility is expressed per feature
// (responsibility-level concept the Product Owner configures).
export const MODULE_TO_FEATURE = {
  contacts: "crm",
  finance: "finance",
  programs: "program_management",
  projects: "project_ownership",
  users: "user_management",
  reports: "reporting",
  messaging: "messaging",
  internal_comms: "internal_comms",
  knowledge: "knowledge_base",
  tasks: "tasks",
  ventures: "ventures",
  investor: "investor",
  permissions: "user_management",
  engineering: "engineering",
  settings: "system_settings",
  facilitator: "program_management",
};

/**
 * Initial seeds = the CURRENT route allowlists (from the per-route
 * authorization inventory). These only fill rows that have never been
 * configured (ON CONFLICT DO NOTHING) — admin edits are never overwritten.
 */
export const FEATURE_ELIGIBILITY_DEFAULTS = {
  crm: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
    "participant",
    "founder",
  ],
  finance: ["super_admin", "staff"],
  program_management: ["super_admin", "staff", "program_manager", "teacher"],
  project_ownership: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ],
  operations: ["super_admin", "staff", "program_manager", "teacher", "developer"],
  reporting: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "admin",
    "developer",
  ],
  knowledge_base: ["super_admin", "staff"],
  intelligence: ["super_admin", "developer"],
  engineering: ["super_admin", "developer"],
  user_management: ["super_admin"],
  system_settings: ["super_admin"],
  messaging: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
    "participant",
    "founder",
  ],
  tasks: ["super_admin", "staff", "program_manager", "team"],
  ventures: ["super_admin", "staff", "program_manager"],
  investor: ["super_admin", "staff", "investor"],
  internal_comms: [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
    "participant",
    "admin",
  ],
};

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
 * Seed eligibility from FEATURE_ELIGIBILITY_DEFAULTS. Idempotent: existing
 * rows (including admin edits and explicit empty lists) are never touched.
 */
export async function seedDefaultEligibility() {
  try {
    await ensureEligibilitySchema();
    for (const [featureKey, roles] of Object.entries(
      FEATURE_ELIGIBILITY_DEFAULTS,
    )) {
      for (const role of roles) {
        await db.execute({
          sql: `INSERT INTO feature_eligibility
                  (feature_key, identity_type, identity_value, eligible)
                VALUES (?, 'role', ?, 1)
                ON CONFLICT (feature_key, identity_type, identity_value)
                DO NOTHING`,
          args: [featureKey, role],
        });
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
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
