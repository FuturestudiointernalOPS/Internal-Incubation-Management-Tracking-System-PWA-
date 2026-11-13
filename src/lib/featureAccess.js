/**
 * ImpactOS — Responsibility → Feature Access (seed + helpers)
 *
 * THIS FILE IS ONLY THE STARTING CONFIGURATION.
 *
 * The runtime source of truth is the `allowed_roles` column on the
 * `responsibilities` table, editable by the Super Admin from the
 * "Responsibility Access" tab in the Permission Manager
 * (/admin/security/permissions).
 *
 * - When a responsibility has NO saved config (allowed_roles IS NULL) the
 *   app falls back to the defaults below.
 * - Once the SA saves a config (even an empty list = "nobody"), that saved
 *   value wins and this seed is ignored for that responsibility.
 *
 * A responsibility grants navigation + dashboards. But if the underlying
 * feature API rejects the user's role, the nav item appears and clicking it
 * fails (redirect to login / 403). This module powers the amber warnings in:
 *   - /admin/security/permissions  (Responsibilities tab, assignment UI)
 *   - /admin/access                   (User Access Summary)
 *
 * NOTE: This is informational. It NEVER blocks an assignment. To change what
 * a role can actually do, edit the runtime config (or these defaults), not
 * the server-side route allowlists.
 */

import { RESPONSIBILITY_FEATURE_ROLES } from "@/models/authorization/seedData";
import { BASELINE_IDENTITIES } from "@/lib/identity";
import { PROFILE_KEYS } from "@/models/authorization/profile-catalog";

// MIGRATION SEED ONLY — the values the one-time responsibilities seed writes
// into `responsibilities.allowed_roles`. NEVER read at runtime: the warning
// helper below reads only the saved column, and stays silent when it is unset.
//
// SINGLE SOURCE: the value comes from the inert seed data module, aliased to
// the eligibility defaults so the two can never drift apart.
export { RESPONSIBILITY_FEATURE_ROLES };

// Canonical identity vocabulary. The list is DERIVED, never hand-written:
//   - a person's baseline role is one of the three identities;
//   - every contextual function is a PROFILE key.
// The old ten-value role list included contextual labels that are profiles now.
export const ALL_FEATURE_ROLES = [...BASELINE_IDENTITIES];
export const ALL_FEATURE_PROFILES = [...PROFILE_KEYS];
export const ALL_FEATURE_IDENTITIES = [
  ...BASELINE_IDENTITIES,
  ...PROFILE_KEYS,
];

/**
 * Roles that are NOT subject to feature-access warnings. Super Admin
 * bypasses the /admin/* layout guard, so it never hits the
 * redirect-to-login problem this warning exists to prevent.
 */
const WARNING_BYPASS_ROLES = ["super_admin"];


/**
 * The roles OFFERED for a feature in the Responsibility Access UI.
 *
 * Eligibility is the ceiling: a feature only offers the roles it is eligible
 * for, so a role the feature cannot reach is never proposed here (the saved
 * allowed_roles stays a subset of the eligibility boundary).
 *
 * Falls back to the full role list when the feature has NO eligibility rows at
 * all (unknown / custom responsibility — there is nothing to filter by, so the
 * UI must not hide every toggle).
 *
 * @param {Array<{identity_type:string, identity_value:string,
 *   feature_key:string, eligible:number}>} rows  feature_eligibility rows
 * @param {string} featureKey  the responsibility key (= feature key)
 * @param {string[]} [allRoles] canonical role list
 * @returns {string[]} eligible roles, in the canonical order
 */
export function eligibleRolesForFeature(rows, featureKey, allRoles = ALL_FEATURE_ROLES) {
  if (!featureKey) return [...allRoles];
  const scoped = (rows || []).filter(
    (row) => row.identity_type === "role" && row.feature_key === featureKey,
  );
  if (scoped.length === 0) return [...allRoles]; // no ceiling to apply
  const eligible = new Set(
    scoped.filter((row) => Number(row.eligible) === 1).map((row) => row.identity_value),
  );
  return allRoles.filter((role) => eligible.has(role));
}

/**
 * Normalize a saved allowed_roles value (may be null, a JSON string, or an
 * array) into an array of roles, or null when not configured yet.
 */
export function normalizeAllowedRoles(raw) {
  if (Array.isArray(raw)) return raw.length ? raw : [];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return null;
}

/**
 * Returns true when the given role cannot actually access the feature that
 * the responsibility grants.
 *
 * @param {string|null|undefined} role
 * @param {string|null|undefined} responsibilityKey
 * @param {string|string[]|null} [savedAllowedRoles] — live config from the DB
 *   (array or JSON string). null/undefined means "not configured" → silence.
 */
export function isResponsibilityBlockedForRole(
  role,
  responsibilityKey,
  savedAllowedRoles,
) {
  if (!role || !responsibilityKey) return false;
  if (WARNING_BYPASS_ROLES.includes(role)) return false;

  const allowed = normalizeAllowedRoles(savedAllowedRoles);
  // Not configured in the database = no warning. The runtime never supplies a
  // code default: the configuration is data, owned by the Permissions screen.
  if (allowed === null) return false;
  if (!allowed) return false; // malformed configuration — don't warn
  return !allowed.includes(role);
}
