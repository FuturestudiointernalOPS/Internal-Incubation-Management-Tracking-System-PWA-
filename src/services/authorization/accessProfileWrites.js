/**
 * ACCESS PROFILE WRITE DECISIONS (SERVICE layer).
 *
 * Everything that decides WHETHER an access-profile write may happen lived
 * inside `src/app/api/access-profiles/route.js`: capability normalisation, the
 * role-default gates, the eligibility boundary and the three DELETE reference
 * guards. The route now only orchestrates HTTP; the rules live here.
 *
 * Rules, unchanged:
 *   - `view` is the base capability: in a module that carries `view`, any other
 *     active capability implies it at level 1. Zero rows are dropped (absence
 *     already means level 0).
 *   - A profile that is a role default must never be DISABLED through the API,
 *     and must never grant a capability whose feature one of those roles is not
 *     eligible for (`ELIGIBLE ≠ GRANTED`, fail closed on missing rows).
 *   - A profile still referenced — by a role default, by people, or by a context
 *     role mapping — must not be deleted. The checks run in that order so the
 *     most fundamental reason wins the refusal.
 *
 * Every statement is in `@/models/authorization` (the repository); nothing here
 * runs SQL and nothing here builds a Response.
 */

import { PERMISSION_MODULES } from "@/server/authz/capabilities";
import {
  getRoleDefaultRoles,
  getRoleEligibilityRows,
  getRoleDefaultRefs,
  getRoleDefaultsForProfile,
  countProfileUsers,
  listProfileAssignedNames,
  getProfileImpactCounts,
  clearProfileCapabilities,
  replaceProfileCapability,
  getActiveProfileForRoleDefault,
} from "@/models/authorization";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { evaluateEligibility } from "./eligibility";
import {
  assertTemplateCapsEligible,
  validateCapabilitiesWithinEligibility,
} from "./eligibilityAdmin";

/**
 * Dependency normalization for profile capabilities.
 *
 * View is the base capability: in any module that carries a `view`
 * capability, granting another action (edit / create / delete / …) without
 * view is impossible — view is auto-granted (level 1). Zero rows are dropped
 * (absence already means level 0).
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

/** Roles that use this profile as their default access template. */
async function profileDefaultRoles(profileId) {
  const result = await getRoleDefaultRoles(profileId);
  return result.rows.map((row) => row.role_name);
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
 * A profile that is the default for role(s) must never grant a capability
 * whose feature one of those roles is not eligible for. Mirrors
 * assertTemplateCapsEligible (role-defaults route) but validates the incoming
 * payload instead of the persisted rows.
 */
async function assertCapsEligibleForRoles(capabilities, roles) {
  for (const role of roles) {
    const eligibility = await eligibilityForRole(role);
    const { valid, violations } = validateCapabilitiesWithinEligibility(
      capabilities,
      eligibility,
    );
    if (!valid) return { valid: false, violations, role };
  }
  return { valid: true, violations: [], role: null };
}

/**
 * Phase 7 governance: a profile that is a role default must never be disabled
 * through the API — that would silently drop the role's default access
 * (resolver falls back to legacy role_capabilities). Change the role default
 * first.
 *
 * @returns {Promise<{allowed: boolean, roles: string[]}>}
 */
export async function assertProfileCanBeDeactivated(profileId) {
  const refs = await getRoleDefaultRefs(profileId);
  const roles = refs.rows.map((row) => row.role_name);
  return { allowed: roles.length === 0, roles };
}

/**
 * Eligibility boundary for a capabilities write: when the profile is the
 * default for role(s), none of those roles may receive a capability whose
 * feature they are not eligible for. A profile with no role default is
 * unconstrained.
 *
 * @returns {Promise<{valid: boolean, violations: Array, role: string|null}>}
 */
export async function assertCapsEligibleForProfile(capabilities, profileId) {
  const defaultRoles = await profileDefaultRoles(profileId);
  if (defaultRoles.length === 0) return { valid: true, violations: [], role: null };
  // Validate what would actually be PERSISTED (normalization already applied):
  // an implied `view` must be checked against eligibility like any other row.
  return assertCapsEligibleForRoles(normalizeCapabilities(capabilities), defaultRoles);
}

/**
 * The role-default ASSIGNMENT boundary (PUT /api/access-profiles/role-defaults).
 *
 * Two rules, in order:
 *   1. the profile must exist and be ACTIVE (404 otherwise);
 *   2. the role must be eligible for every feature the profile grants
 *      (`ELIGIBLE ≠ GRANTED`, fail closed) — a default template must never
 *      grant what its role cannot be eligible for (400 otherwise).
 *
 * Returns a decision, not a Response: `ok: true` carries the profile name for
 * the audit entry; `ok: false` carries the HTTP status the boundary should use.
 *
 * @returns {Promise<{ok: true, profileName: string} | {ok: false, status: number, error: string, violations?: Array}>}
 */
export async function assertRoleDefaultAssignable(roleName, profileId) {
  const profile = await getActiveProfileForRoleDefault(profileId);
  if (profile.rows.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "Access profile not found or inactive",
    };
  }

  const { valid, violations } = await assertTemplateCapsEligible({
    role: roleName,
    groups: [],
    profileId,
  });
  if (!valid) {
    return {
      ok: false,
      status: 400,
      error: "errors.ineligibleTemplateCaps",
      violations,
    };
  }

  return { ok: true, profileName: profile.rows[0].name };
}

/**
 * Replaces the whole capability set of a profile: clear, then insert.
 * The order is part of the contract — the payload must never coexist with the
 * rows it replaces.
 *
 * @param {number|string} profileId
 * @param {Object} capabilities raw payload {module: {capability: level}}
 */
export async function replaceProfileCapabilities(profileId, capabilities) {
  const normalizedCapabilities = normalizeCapabilities(capabilities);

  // Clear existing
  await clearProfileCapabilities(profileId);

  // Insert new
  for (const [module, moduleCapabilities] of Object.entries(normalizedCapabilities)) {
    for (const [capability, level] of Object.entries(moduleCapabilities)) {
      await replaceProfileCapability(profileId, module, capability, level);
    }
  }
  return normalizedCapabilities;
}

/**
 * DELETE reference guards, in order: role default → people → context mappings.
 * The first hit wins the refusal, so the message always names the most
 * fundamental reason.
 *
 * @returns {Promise<{blocked: boolean, error?: string, message?: string, ...}>}
 *   `blocked: false` means the delete may proceed.
 */
export async function assertProfileDeletable(profileId) {
  // Check if any role defaults reference this profile
  const roleRefs = await getRoleDefaultsForProfile(profileId);

  if (roleRefs.rows.length > 0) {
    const roles = roleRefs.rows.map((row) => row.role_name);
    return {
      blocked: true,
      error: "profile_in_use_role_default",
      message: `Cannot delete: profile is the default for role(s): ${roles.join(", ")}. Change the role default first.`,
      roles,
    };
  }

  // Check B — people: a profile still carried by users must not vanish under
  // them. Deleting it would silently drop those users to the legacy fallback.
  const userRefs = await countProfileUsers(profileId);
  const assignedCount = Number(userRefs.rows[0]?.cnt || 0);
  if (assignedCount > 0) {
    const nameRows = await listProfileAssignedNames(profileId);
    return {
      blocked: true,
      error: "profile_in_use_assignments",
      message: `Cannot delete: ${assignedCount} user(s) still use this profile. Remove it from them first.`,
      assignedCount,
      assignedNames: nameRows.rows.map((row) => row.name).filter(Boolean),
    };
  }

  // Check C — context bindings: context_role_profiles.profile_id carries NO
  // foreign key to access_profiles, so deleting this profile would leave
  // those rows pointing at a dead id (dangling reference). Block until the
  // mappings are re-pointed.
  const impact = await getProfileImpactCounts(profileId);
  if (impact.contextBindings > 0) {
    return {
      blocked: true,
      error: "profile_in_use_context",
      message: `Cannot delete: ${impact.contextBindings} context role(s) still map to this profile. Change them first.`,
      contextCount: impact.contextBindings,
      contextRoles: impact.contextRoles,
    };
  }

  return { blocked: false };
}