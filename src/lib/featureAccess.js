import { FEATURE_ELIGIBILITY_DEFAULTS } from "@/models/authorization/eligibility-defaults";

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
 * The DEFAULT role allowlists are derived from FEATURE_ELIGIBILITY_DEFAULTS
 * (single source of truth) — the same role lists that seed feature
 * eligibility — so the two can never drift. RESPONSIBILITY_FEATURES lists
 * which features have a responsibility; to make another feature
 * responsibility-driven, add it here and to seedDefaultResponsibilities() +
 * NAV_RESPONSIBILITY_MAP.
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

/**
 * Features that have an assignable responsibility. Order preserved for
 * readability; lookups are key-based.
 */
export const RESPONSIBILITY_FEATURES = [
  // Financial operations — budgets, transactions, reports
  "finance",
  // CRM — people, contacts, timeline, membership, duplicates
  "crm",
  // Communication — messaging, announcements, forms (distinct from CRM)
  "communication",
  // Program oversight — programs, participants, submissions
  "program_management",
  // Project management — projects, tasks, team reporting
  "project_ownership",
  // Internal operations — workspace, reports, standups
  "operations",
  // Reports and analytics
  "reporting",
  // Knowledge management
  "knowledge_base",
  // Business intelligence and trends
  "intelligence",
  // Engineering operations — tasks, standups, retros, error logs
  "engineering",
  // User administration — personnel, permissions
  "user_management",
  // System configuration
  "system_settings",
  // LMS — course management (admin authoring area)
  "lms",
];

/**
 * Role allowlist per responsibility — mirrors the feature's eligibility
 * defaults (single source of truth in models/authorization/eligibility-defaults).
 */
export const RESPONSIBILITY_FEATURE_ROLES = Object.fromEntries(
  RESPONSIBILITY_FEATURES.map((key) => [
    key,
    [...(FEATURE_ELIGIBILITY_DEFAULTS[key] || [])],
  ]),
);

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
