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
  return isPrivilegedRole(r) ? r : DEFAULT_ROLE;
}
