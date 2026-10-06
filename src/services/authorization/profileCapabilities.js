/**
 * Profile capabilities (SERVICE layer).
 *
 * Tranche 1 of docs/PROFILES_TAKEOVER_MIGRATION.md. The decisions behind the
 * profile-capability foundation: normalization of a capability payload and the
 * clear-then-insert replacement. No SQL here — every statement lives in
 * `@/models/authorization/profileCapabilitiesStore`.
 *
 * Reuses `normalizeCapabilities` from `./accessProfileWrites` on purpose: the
 * "view is implied" rule must be the SAME rule the access-profile editor already
 * enforces, so the two paths cannot drift while both exist.
 */

import { normalizeCapabilities } from "./accessProfileWrites";
import {
  ensureProfileCapabilitiesSchema,
  listProfileCapabilities as listProfileCapabilitiesRows,
  clearProfileCapabilities,
  upsertProfileCapability,
  listProfileCapabilityCounts as listProfileCapabilityCountsRows,
  listRolesUsingProfileDefault,
} from "@/models/authorization/profileCapabilitiesStore";
import { getRoleEligibilityRows } from "@/models/authorization";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { evaluateEligibility } from "./eligibility";
import { validateCapabilitiesWithinEligibility } from "./eligibilityAdmin";

export { ensureProfileCapabilitiesSchema, listRolesUsingProfileDefault };

/** A profile's capability rows as `{ module: { capability: level } }`. */
export async function listProfileCapabilities(profileKey) {
  await ensureProfileCapabilitiesSchema();
  const res = await listProfileCapabilitiesRows(profileKey);
  const caps = {};
  for (const row of res.rows || []) {
    caps[row.module] ??= {};
    caps[row.module][row.capability] = Number(row.access_level) || 0;
  }
  return caps;
}

/** Capability count per profile key (`{ key: count }`). */
export async function listProfileCapabilityCounts() {
  await ensureProfileCapabilitiesSchema();
  const res = await listProfileCapabilityCountsRows();
  const counts = {};
  for (const row of res.rows || []) counts[row.profile_key] = Number(row.capability_count) || 0;
  return counts;
}

/**
 * Replace the whole capability set of a profile: clear, then insert.
 * The order is part of the contract — the incoming payload must never coexist
 * with the rows it replaces.
 *
 * @param {string} profileKey
 * @param {Object} capabilities raw payload {module: {capability: level}}
 * @returns {Promise<Object>} the normalized payload that was persisted
 */
export async function replaceProfileCapabilities(profileKey, capabilities) {
  await ensureProfileCapabilitiesSchema();
  const normalized = normalizeCapabilities(capabilities);
  await clearProfileCapabilities(profileKey);
  for (const [module, moduleCapabilities] of Object.entries(normalized)) {
    for (const [capability, level] of Object.entries(moduleCapabilities)) {
      await upsertProfileCapability(profileKey, module, capability, level);
    }
  }
  return normalized;
}

/**
 * Remove every capability of one profile — used when the profile is deleted.
 */
export async function deleteProfileCapabilities(profileKey) {
  await ensureProfileCapabilitiesSchema();
  await clearProfileCapabilities(profileKey);
}

/** Per-feature eligibility map for a role (fail closed on missing rows). */
async function eligibilityForRole(role) {
  const result = await getRoleEligibilityRows(role);
  const eligibilityMap = {};
  for (const feature of Object.values(MODULE_TO_FEATURE)) {
    eligibilityMap[feature] = evaluateEligibility(result.rows, feature);
  }
  return eligibilityMap;
}

/**
 * The eligibility boundary for a PROFILE's capabilities: when the profile is the
 * default for role(s), none of those roles may receive a capability whose
 * feature they are not eligible for (`ELIGIBLE ≠ GRANTED`, fail closed). Mirrors
 * `assertCapsEligibleForProfile` (the access-profile path). A profile with no
 * role default is unconstrained.
 *
 * @returns {Promise<{valid: boolean, violations: Array, role: string|null}>}
 */
export async function assertCapsEligibleForProfileKey(capabilities, profileKey) {
  const rolesRes = await listRolesUsingProfileDefault(profileKey);
  const roles = (rolesRes.rows || []).map((row) => row.role_name);
  if (roles.length === 0) return { valid: true, violations: [], role: null };

  const normalized = normalizeCapabilities(capabilities);
  for (const role of roles) {
    const eligibility = await eligibilityForRole(role);
    const { valid, violations } = validateCapabilitiesWithinEligibility(
      normalized,
      eligibility,
    );
    if (!valid) return { valid: false, violations, role };
  }
  return { valid: true, violations: [], role: null };
}
