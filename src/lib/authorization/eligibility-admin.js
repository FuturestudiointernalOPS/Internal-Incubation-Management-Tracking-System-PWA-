/**
 * ImpactOS — Authorization Foundation: ELIGIBILITY ADMINISTRATION
 *
 * Pure validation/normalization for the eligibility configuration API
 * (GET/PUT /api/engineering/permissions/eligibility). Kept pure so the
 * Permissions UI writes can be unit-tested without a database.
 *
 * Semantics:
 *   - eligible = 1  → identity may receive the feature (row upserted)
 *   - eligible = 0  → identity is explicitly denied the feature (row upserted)
 *   - eligible = null → configuration removed (row deleted → fail-closed deny)
 *
 * The resolver consumes exactly these rows — the UI only edits the same
 * configuration the engine enforces.
 */

import db from "@/lib/db";

import { MODULE_TO_FEATURE, FEATURE_ELIGIBILITY_DEFAULTS, evaluateEligibility } from "./eligibility";

/** Every configurable feature (module-mapped features + seeded features). */
export const FEATURE_KEYS = [
  ...new Set([
    ...Object.values(MODULE_TO_FEATURE),
    ...Object.keys(FEATURE_ELIGIBILITY_DEFAULTS),
  ]),
].sort();

export const IDENTITY_TYPES = ["role", "group"];

/** Canonical role catalog: every role referenced by seeds/config plus the
 *  platform role list (teams included via the tasks seed). */
export const ROLE_CATALOG = [
  ...new Set([
    ...Object.values(FEATURE_ELIGIBILITY_DEFAULTS).flat(),
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
    "facilitator",
    "participant",
    "member",
    "founder",
    "investor",
    "mentor",
    "finance",
    "team",
    "admin",
    "intern",
    "security_officer",
  ]),
].sort();

/**
 * Validate that a set of template capabilities stays within an eligibility
 * boundary. Eligibility is the HARD ceiling: a default template (access
 * profile) or an individual grant must never grant a capability whose
 * feature the identity is not eligible for.
 *
 * @param {Object} caps  {module: {capability: level}} (template/grants)
 * @param {Object} eligibility  {featureKey: boolean} (from evaluateEligibility)
 * @returns {{valid: boolean, violations: Array<{module, capability, feature}>}}
 *   Unset/missing eligibility rows count as NOT eligible (fail closed).
 */
export function validateCapabilitiesWithinEligibility(caps, eligibility) {
  const violations = [];
  for (const [module, capMap] of Object.entries(caps || {})) {
    const feature = MODULE_TO_FEATURE[module];
    if (!feature) continue; // infra modules without a feature are capability-only
    if (eligibility?.[feature] !== true) {
      for (const capability of Object.keys(capMap || {})) {
        violations.push({ module, capability, feature });
      }
    }
  }
  return { valid: violations.length === 0, violations };
}

/**
 * Validate + normalize an eligibility change batch.
 *
 * @param {Array<{feature_key, identity_type, identity_value, eligible}>} changes
 * @returns {{valid: boolean, errors: string[], normalized: Array}}
 *   normalized entries are {feature_key, identity_type, identity_value, eligible}
 *   where eligible is 0|1|null (null → delete the row).
 */
export function validateEligibilityChanges(changes) {
  const errors = [];
  const normalized = [];
  if (!Array.isArray(changes) || changes.length === 0) {
    return { valid: false, errors: ["no changes"], normalized: [] };
  }
  for (const c of changes) {
    const featureKey = String(c?.feature_key || "");
    const identityType = String(c?.identity_type || "");
    const identityValue = String(c?.identity_value ?? "").trim();
    const eligible = c?.eligible;

    if (!FEATURE_KEYS.includes(featureKey)) {
      errors.push(`unknown feature_key: ${featureKey}`);
      continue;
    }
    if (!IDENTITY_TYPES.includes(identityType)) {
      errors.push(`unknown identity_type: ${identityType}`);
      continue;
    }
    if (!identityValue) {
      errors.push("empty identity_value");
      continue;
    }
    if (eligible !== 0 && eligible !== 1 && eligible !== null) {
      errors.push(`invalid eligible value for ${featureKey}/${identityType}/${identityValue}: ${eligible}`);
      continue;
    }
    normalized.push({ feature_key: featureKey, identity_type: identityType, identity_value: identityValue, eligible });
  }
  return { valid: errors.length === 0 && normalized.length > 0, errors, normalized };
}

/**
 * Server-side enforcement (Phase 2): a DEFAULT ACCESS TEMPLATE (access
 * profile) can never grant capabilities whose feature the target identity is
 * not eligible for. Eligibility is the boundary.
 *
 * @param {string} role  the identity role (or the user's role)
 * @param {string[]} groups  the identity's effective groups (or [] for roles)
 * @param {number|string} profileId
 * @returns {{valid: boolean, violations: Array<{module, capability, feature}>}}
 */
export async function assertTemplateCapsEligible({ role, groups = [], profileId }) {
  const capsRes = await db.execute({
    sql: `SELECT module, capability, access_level
          FROM access_profile_capabilities WHERE profile_id = ?`,
    args: [profileId],
  });
  const caps = {};
  for (const r of capsRes.rows) {
    caps[r.module] ??= {};
    if (Number(r.access_level) > (caps[r.module][r.capability] ?? 0)) {
      caps[r.module][r.capability] = Number(r.access_level);
    }
  }

  const ph = groups.length ? groups.map(() => "?").join(",") : "NULL";
  const eligRes = await db.execute({
    sql: `SELECT feature_key, identity_type, identity_value, eligible
          FROM feature_eligibility
          WHERE (identity_type = 'role' AND identity_value = ?)
             OR (identity_type = 'group' AND identity_value IN (${ph}))`,
    args: [role, ...groups],
  });
  const eligibility = {};
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
    eligibility[featureKey] = evaluateEligibility(eligRes.rows, featureKey);
  }

  return validateCapabilitiesWithinEligibility(caps, eligibility);
}
