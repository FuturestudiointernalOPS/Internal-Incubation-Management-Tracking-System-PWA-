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

import { MODULE_TO_FEATURE } from "./eligibility";
import { FEATURE_ELIGIBILITY_DEFAULTS } from "./eligibility";

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
  ]),
].sort();

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
