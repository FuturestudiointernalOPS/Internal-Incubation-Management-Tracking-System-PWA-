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
 * The internal membership group: belonging to it means the person is a member
 * of Future Studio's internal team and is resolved as staff at login.
 */
export const INTERNAL_GROUP = "FUTURE STUDIO";

/**
 * CANONICAL LOGIN IDENTITY RESOLUTION
 *
 * Policy: FUTURE STUDIO group membership = internal staff membership.
 *
 * Precedence (high → low):
 *   1. Team / Family entity logins keep their entity identity.
 *   2. Privileged identities ALWAYS win and are never overridden by group
 *      membership — this is what protects Super Admin from demotion/lockout.
 *   3. Staff-family roles (staff / project_manager / admin) normalize to staff.
 *   4. FUTURE STUDIO group membership ⇒ staff  (the rule).
 *   5. All other identities (participant, member, facilitator, teacher, ...)
 *      keep their role; unknown/empty roles default to participant.
 *
 * Known conflicts (deliberate, per policy):
 *   - A participant in the FUTURE STUDIO group is resolved as staff at login
 *     (their participant identity is overridden; enrollments stay visible via
 *     the Workspaces hub).
 *   - A facilitator/teacher in the FUTURE STUDIO group is resolved as staff.
 *     If an external facilitator must keep their facilitator identity even
 *     inside the group, move facilitator/teacher before the group rule.
 *   - The rule applies at login (session snapshot). Group changes mid-session
 *     take effect on the next login.
 */
export function resolveEffectiveRole({
  role,
  group_name,
  isTeam = false,
  isFamily = false,
  legacySa = false,
} = {}) {
  const r = String(role || "").trim().toLowerCase();

  if (isTeam) return "team";
  if (isFamily) return "participant"; // family entity acts as participant

  if (r === "super_admin" || legacySa) return "super_admin";
  if (r === "developer") return "developer";
  if (r === "investor") return "investor";
  if (r === "founder") return "founder";

  // Staff-family identities normalize to staff.
  if (r === "staff" || r === "project_manager" || r === "admin") return "staff";

  // THE RULE — FUTURE STUDIO group membership = internal staff membership.
  if (String(group_name || "").trim().toUpperCase() === INTERNAL_GROUP) {
    return "staff";
  }

  // Explicit identities are preserved outside the group.
  if (["participant", "member", "facilitator", "teacher"].includes(r)) return r;
  return DEFAULT_ROLE; // unknown / no role → participant (legacy default)
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
