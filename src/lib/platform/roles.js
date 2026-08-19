/**
 * PLATFORM ROLE RESOLUTION
 *
 * Single source of truth for the default role. A user with no Program
 * assignment and no explicit privileged role is a PARTICIPANT — never Staff.
 *
 * Staff/program-manager/teacher/admin/etc. are only applied when explicitly
 * assigned (e.g. a group's configured default_role, or an admin action).
 */

export const DEFAULT_ROLE = "participant";

export const PRIVILEGED_ROLES = new Set([
  "super_admin",
  "admin",
  "staff",
  "program_manager",
  "teacher",
  "developer",
  "investor",
  "founder",
  "mentor",
]);

export function isPrivilegedRole(role) {
  return PRIVILEGED_ROLES.has(String(role || "").trim().toLowerCase());
}

/**
 * Resolve a role for onboarding/creation. Respects an explicitly assigned
 * privileged role; otherwise returns the participant default. A missing
 * program/group must never elevate someone to staff.
 */
export function resolveDefaultRole(explicitRole) {
  const r = String(explicitRole || "").trim().toLowerCase();
  // The neutral "member" state means "person exists, no role/assignment yet".
  // It is preserved as-is and must never be upgraded to participant.
  if (r === "member") return r;
  return isPrivilegedRole(r) ? r : DEFAULT_ROLE;
}

/**
 * Where each global role lands after login. Single source of truth shared by
 * the login redirect and the workspaces hub so the hub's "My Dashboard"
 * button can never drift from the real login routing.
 *
 * Roles not listed here (or dynamic targets like team/founder) fall back to
 * the neutral /workspaces hub.
 */
export const ROLE_HOME = {
  super_admin: "/admin",
  program_manager: "/pm",
  staff: "/staff",
  teacher: "/teacher",
  facilitator: "/facilitator",
  developer: "/developer",
  participant: "/participant",
  finance: "/finance",
  investor: "/investor/dashboard",
};

export function roleHomeHref(role) {
  return ROLE_HOME[String(role || "").toLowerCase()] || null;
}

/**
 * Roles that are internal Future Studio staff and therefore allowed to submit
 * their own weekly operational reports (standups / retros).
 *
 * External roles are deliberately excluded:
 *   - teacher      → external "Active Teammate" (program assistant / team handler)
 *   - facilitator  → external, program-scoped
 *   - participant / member / founder / investor / mentor / finance
 */
export const INTERNAL_OPS_ROLES = [
  "super_admin",
  "staff",
  "program_manager",
  "admin",
  "developer",
];
