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

import { FEATURE_ELIGIBILITY_DEFAULTS } from "@/models/authorization/eligibility-defaults";

// Initial defaults — used to seed the DB once and as fallback for
// responsibilities that have not been configured yet.
//
// SINGLE SOURCE: these ARE the canonical eligibility defaults, aliased (not
// copied) so the two can never drift apart. `authorization-model.test.js`
// still enforces the alignment.
export const RESPONSIBILITY_FEATURE_ROLES = FEATURE_ELIGIBILITY_DEFAULTS;

// Canonical role list offered in the "Responsibility Access" toggle UI.
// Keep in sync with src/lib/platform/roles.js when new roles are added.
export const ALL_FEATURE_ROLES = [
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
];

/**
 * Roles that are NOT subject to feature-access warnings. Super Admin and
 * developer bypass the /admin/* layout guard, so they never hit the
 * redirect-to-login problem this warning exists to prevent.
 */
const WARNING_BYPASS_ROLES = ["super_admin", "developer"];

/**
 * Default allowed roles for a responsibility key (the seed). Returns null
 * for unknown keys.
 */
export function defaultAllowedRoles(responsibilityKey) {
  const allowed = RESPONSIBILITY_FEATURE_ROLES[responsibilityKey];
  return allowed ? [...allowed] : null;
}

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
    (r) => r.identity_type === "role" && r.feature_key === featureKey,
  );
  if (scoped.length === 0) return [...allRoles]; // no ceiling to apply
  const eligible = new Set(
    scoped.filter((r) => Number(r.eligible) === 1).map((r) => r.identity_value),
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
 *   (array or JSON string). null/undefined means "not configured" → seed.
 */
export function isResponsibilityBlockedForRole(
  role,
  responsibilityKey,
  savedAllowedRoles,
) {
  if (!role || !responsibilityKey) return false;
  if (WARNING_BYPASS_ROLES.includes(role)) return false;

  let allowed = normalizeAllowedRoles(savedAllowedRoles);
  if (allowed === null) {
    allowed = defaultAllowedRoles(responsibilityKey);
  }
  if (!allowed) return false; // unknown responsibility — don't warn
  return !allowed.includes(role);
}
