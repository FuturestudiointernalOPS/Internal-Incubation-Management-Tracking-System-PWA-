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
} from "./eligibility-defaults";

export { FEATURE_ELIGIBILITY_DEFAULTS, FEATURE_ELIGIBILITY_PROFILE_DEFAULTS };
export { FEATURE_ORDER } from "./eligibility-defaults";

// Capability module → feature key. Features ARE the dashboard sections; the
// modules are their sub-sections. The resolver authorizes against capability
// modules (PERMISSION_MODULES); eligibility is expressed per feature.
export const MODULE_TO_FEATURE = {
  // CRM — people data
  contacts: "crm",
  duplicates: "crm",
  bulk_upload: "crm",
  // Communication
  messaging: "communication",
  internal_comms: "communication",
  forms: "communication",
  runs: "communication",
  // Programs
  programs: "programs",
  facilitator: "programs",
  // Ventures / Investors
  ventures: "ventures",
  investor: "investors",
  // Finance
  finance: "finance",
  // Operations — projects + tasks share the dashboard OPERATIONS section
  projects: "operations",
  tasks: "operations",
  // Reports
  reports: "reports",
  // Knowledge
  knowledge: "knowledge",
  // LMS
  lms: "lms",
  // Security — user administration + permissions
  users: "security",
  permissions: "security",
  // Settings — system configuration + engineering operations
  settings: "settings",
  engineering: "settings",
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

/**
 * Assignment-derived program access: the eligibility rows the per-program
 * assignment model needs on databases that bootstrapped before it existed.
 *
 * A facilitator / program manager receives capabilities from the program
 * assignment (Context Roles → profile → additive grants). Eligibility is
 * checked BEFORE capability and fails closed, so without these rows the grant
 * would look inert and the person would be refused — the opposite of the
 * "already in production, must not be blocked" requirement.
 *
 * Insert-only (ON CONFLICT DO NOTHING): an administrator's decision — including
 * an explicit deny — is never overwritten. MIRRORS FEATURE_ELIGIBILITY_DEFAULTS.programs.
 */
export const PROGRAM_ASSIGNMENT_ROWS = {
  programs: ["member"],
};

export async function seedProgramAssignmentEligibility() {
  for (const [featureKey, roles] of Object.entries(PROGRAM_ASSIGNMENT_ROWS)) {
    const result = await seedFeatureRows(featureKey, roles);
    if (!result.success) return result;
  }
  return { success: true };
}
