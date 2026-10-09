/**
 * Profile capabilities (SERVICE layer).
 *
 * Tranche 1 of docs/PROFILES_TAKEOVER_MIGRATION.md. The decisions behind the
 * profile-capability foundation: normalization of a capability payload and the
 * clear-then-insert replacement. No SQL here — every statement lives in
 * `@/models/authorization/profileCapabilitiesStore`.
 */

import { PERMISSION_MODULES } from "@/server/authz/capabilities";
import {
  ensureProfileCapabilitiesSchema,
  listProfileCapabilities as listProfileCapabilitiesRows,
  clearProfileCapabilities,
  upsertProfileCapability,
  listProfileCapabilityCounts as listProfileCapabilityCountsRows,
  listRolesUsingProfileDefault,
} from "@/models/authorization/profileCapabilitiesStore";
import { getRoleEligibilityRows, getProfileEligibilityRows } from "@/models/authorization";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { evaluateEligibility } from "./eligibility";
import { validateCapabilitiesWithinEligibility } from "./eligibilityAdmin";

export { ensureProfileCapabilitiesSchema, listRolesUsingProfileDefault };

/**
 * Dependency normalization for profile capabilities.
 *
 * View is the base capability: in any module that carries a `view` capability,
 * granting another action (edit / create / delete / …) without view is
 * impossible — view is auto-granted (level 1). Zero rows are dropped (absence
 * already means level 0).
 *
 * @param {Object} capabilities {module: {capability: level}}
 * @returns {Object} normalized {module: {capability: level}} — zero rows removed
 */
export function normalizeCapabilities(capabilities) {
  const normalized = {};
  for (const [module, capMap] of Object.entries(capabilities || {})) {
    if (!capMap || typeof capMap !== "object") continue;
    const moduleLevels = {};
    for (const [capability, level] of Object.entries(capMap)) {
      const normalizedLevel = Math.max(0, Number(level) || 0);
      if (normalizedLevel > 0) moduleLevels[capability] = normalizedLevel;
    }
    // Zero rows were dropped above, so a cleared `view` is ABSENT (not 0).
    // Any other active capability in a module that CARRIES view implies it.
    const supportsView =
      PERMISSION_MODULES[module]?.capabilities?.includes("view") ?? false;
    const othersActive = Object.keys(moduleLevels).some(
      (capability) => capability !== "view" && moduleLevels[capability] > 0,
    );
    if (supportsView && othersActive && !moduleLevels.view) moduleLevels.view = 1; // edit/create/delete imply view
    if (Object.keys(moduleLevels).length > 0) normalized[module] = moduleLevels;
  }
  return normalized;
}

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

/** Per-feature eligibility map from a set of rows (fail closed on missing rows). */
function eligibilityFromRows(rows) {
  const eligibilityMap = {};
  for (const feature of Object.values(MODULE_TO_FEATURE)) {
    eligibilityMap[feature] = evaluateEligibility(rows, feature);
  }
  return eligibilityMap;
}

/** Per-feature eligibility map for a role, plus whether it has any rows. */
async function eligibilityForRole(role) {
  const result = await getRoleEligibilityRows(role);
  const rows = result.rows || [];
  return { eligibility: eligibilityFromRows(rows), hasRows: rows.length > 0 };
}

/**
 * The eligibility boundary for a PROFILE's capabilities.
 *
 * Profiles ARE the ceiling: a contextual function is eligible through the
 * profile it holds, so the profile's OWN eligibility rows are authoritative. A
 * profile may not grant a capability whose feature the profile is not eligible
 * for (`ELIGIBLE ≠ GRANTED`, fail closed).
 *
 * When the profile has NO eligibility rows of its own (a global or ad-hoc
 * profile the ceiling table does not name), the legacy rule applies: the roles
 * it is the default for must all be eligible. A role that carries NO eligibility
 * rows at all imposes no ceiling — it is skipped, so a profile bound to an
 * unconfigured (or retired) role can still be saved. A profile with neither its
 * own rows nor any configured role default is unconstrained.
 *
 * @returns {Promise<{valid: boolean, violations: Array, role: string|null}>}
 */
export async function assertCapsEligibleForProfileKey(capabilities, profileKey) {
  const normalized = normalizeCapabilities(capabilities);

  const ownRows = await getProfileEligibilityRows(profileKey);
  if ((ownRows.rows || []).length > 0) {
    const { valid, violations } = validateCapabilitiesWithinEligibility(
      normalized,
      eligibilityFromRows(ownRows.rows),
    );
    return { valid, violations, role: null };
  }

  const rolesRes = await listRolesUsingProfileDefault(profileKey);
  const roles = (rolesRes.rows || []).map((row) => row.role_name);

  for (const role of roles) {
    const { eligibility, hasRows } = await eligibilityForRole(role);
    if (!hasRows) continue; // no ceiling configured for this role
    const { valid, violations } = validateCapabilitiesWithinEligibility(
      normalized,
      eligibility,
    );
    if (!valid) return { valid: false, violations, role };
  }
  return { valid: true, violations: [], role: null };
}
