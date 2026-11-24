/**
 * PLATFORM ROLE RESOLUTION
 *
 * THREE baseline identities: the platform owner (super_admin), internal staff
 * (staff) and member. Everything else is a contextual PROFILE. A person with no
 * assignment is a MEMBER — never Staff, and never a contextual label.
 *
 * Staff/program-manager are only applied when explicitly assigned (a group's
 * configured default_role, or an admin action).
 */

import {
  BASELINE_IDENTITIES,
  RETIRED_CONTEXTUAL_LABELS,
  resolveProgramManagerIdentity,
} from "@/lib/identity";
import { spaceForRole } from "@/spaces/registry";
import { LANDING_PRIORITY } from "@/models/authorization/landingData";

export const DEFAULT_ROLE = "member";

export const PRIVILEGED_ROLES = new Set([
  "super_admin",
  "staff",
  "program_manager",
]);

export function isPrivilegedRole(role) {
  return PRIVILEGED_ROLES.has(String(role || "").trim().toLowerCase());
}

/**
 * Resolve a role for onboarding/creation. Respects an explicitly assigned
 * privileged role; otherwise returns the MEMBER default. A missing
 * program/group must never elevate someone to staff, and a retired contextual
 * label is a function (a profile), not an identity.
 */
export function resolveDefaultRole(explicitRole) {
  const normalizedRole = String(explicitRole || "").trim().toLowerCase();
  // The neutral "member" state means "person exists, no role/assignment yet".
  if (normalizedRole === "member") return normalizedRole;
  return isPrivilegedRole(normalizedRole) ? normalizedRole : DEFAULT_ROLE;
}

/**
 * The internal membership group: belonging to it means the person is a member
 * of Future Studio's internal team and is resolved as staff at login.
 */
export const INTERNAL_GROUP = "FUTURE STUDIO";

/**
 * CANONICAL LOGIN IDENTITY RESOLUTION
 *
 * Policy: an ACTIVE FUTURE STUDIO membership = internal staff membership.
 *
 * Precedence (high → low):
 *   1. Team / Family entity logins keep their entity identity.
 *   2. Privileged identities ALWAYS win and are never overridden by group
 *      membership — this is what protects Super Admin from demotion/lockout.
 *   3. Staff-family roles (staff / project_manager) normalize to staff.
 *   4. An ACTIVE FUTURE STUDIO membership ⇒ staff  (the rule). Expired or
 *      ended memberships must NOT produce staff — the caller passes the
 *      EFFECTIVE (active, unexpired) group list from the membership layer.
 *   5. All other identities are MEMBER. A stored retired label
 *      (`participant`, `facilitator`, `investor`, `founder`) is normalized to
 *      member here — its function comes from the contextual profile.
 *
 * Known conflict (deliberate, per policy):
 *   - A personal identity with an active FUTURE STUDIO membership is resolved
 *     as staff at login; enrollments stay visible via the Workspaces hub.
 *   - The rule applies at login (session snapshot). Membership changes
 *     mid-session take effect on the next login.
 */
export function resolveEffectiveRole({
  role,
  groups = [],
  group_name,
  isTeam = false,
  isFamily = false,
  legacySa = false,
} = {}) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  if (isTeam) return "team";
  if (isFamily) return "member"; // family entity acts as a personal identity

  if (normalizedRole === "super_admin" || legacySa) return "super_admin";

  // Staff-family identities normalize to staff. Program Manager is a function
  // layered on Staff (decision D-1): the canonical result is `staff` + the
  // `program_manager` profile. The identity helper keeps the switch reversible.
  if (normalizedRole === "program_manager") {
    return resolveProgramManagerIdentity(normalizedRole);
  }
  if (normalizedRole === "staff" || normalizedRole === "project_manager") return "staff";

  // THE RULE — active FUTURE STUDIO membership = internal staff membership.
  // `group_name` is accepted as a compatibility fallback for callers that
  // only have the raw contact column (it must then be a CURRENT group value).
  const memberGroups = Array.isArray(groups) ? [...groups] : [];
  if (group_name) memberGroups.push(group_name);
  const isInternal = memberGroups.some(
    (group) => String(group || "").trim().toUpperCase() === INTERNAL_GROUP,
  );
  if (isInternal) return "staff";

  // Baseline identities are preserved outside the group.
  if (BASELINE_IDENTITIES.includes(normalizedRole)) {
    return normalizedRole;
  }

  // A retired contextual label is a FUNCTION now: its identity is member.
  if (RETIRED_CONTEXTUAL_LABELS.includes(normalizedRole)) return DEFAULT_ROLE;

  return DEFAULT_ROLE; // unknown / no role → member
}

/**
 * THE ONE MEMBER DASHBOARD.
 *
 * Every member-space identity lands here, whatever they are inside the space
 * (participant, facilitator, venture member, founder, learner, investor). The
 * page is the same one for all of them; the SECTIONS it shows are decided from
 * the relationships the person actually holds, never from the badge.
 */
export const MEMBER_HOME = "/dashboard";

/**
 * Where each GLOBAL role lands after login. Single source of truth shared by
 * the login redirect and the workspaces hub so the hub's "My Dashboard"
 * button can never drift from the real login routing.
 *
 * A PERSONAL identity has no section of its own: "member" is what anyone
 * without a role resolves to, so it cannot carry a destination. Every
 * member-space identity resolves to the one dashboard (`MEMBER_HOME`); the
 * retired context labels below are kept only for callers that still hold a
 * stored one, and they all answer the same page now.
 *
 * Roles not listed here still resolve through their SPACE (`spaceForRole`),
 * and an entity account (team) keeps its own workspace.
 */
export const ROLE_HOME = {
  super_admin: "/admin",
  program_manager: "/staff/program-manager",
  staff: "/staff",
  facilitator: MEMBER_HOME,
  participant: MEMBER_HOME,
  finance: "/staff/finance",
  investor: MEMBER_HOME,
};

export function roleHomeHref(role) {
  return ROLE_HOME[String(role || "").toLowerCase()] || null;
}

/** Étape 4 — landing from access. Default OFF while the production rule is reviewed. */
export const landingFromRightsEnabled = () =>
  process.env.AUTHZ_LANDING_FROM_RIGHTS === "true";

/**
 * A right is held when the matrix says so. `null` means the matrix is not
 * loaded: a capability-only destination cannot be chosen, but a destination
 * that a PROFILE or a RELATIONSHIP already opens still can.
 */
function holdsRight(effective, module, capability) {
  if (!effective) return null;
  return Number(effective?.[module]?.[capability] ?? 0) >= 1;
}

/**
 * Which space a session role works in. `spaceForRole` is the registry's answer;
 * a legacy global label that has a section of its own (`finance`, `crm`) but is
 * not a registry identity is derived from its home address.
 */
function landingSpace(role) {
  const space = spaceForRole(role);
  if (space) return space;
  const home = roleHomeHref(role);
  if (home && home.startsWith("/admin")) return "admin";
  if (home && home.startsWith("/staff")) return "staff";
  return "member";
}

/**
 * Étape 4 — where a person belongs, from their space, profiles and (when
 * available) their effective rights. The priority list is data
 * (`authorization/landingData.js`); this function only evaluates it.
 *
 * The member space answers ONE destination for every member: the unified
 * dashboard. An entity account (team) is the one exception, because it is the
 * account itself rather than a person whose relationships would be read.
 */
export function resolveLandingFromAccess({
  role,
  teamId = null,
  profiles = [],
  effective = null,
} = {}) {
  const space = landingSpace(role);
  const profileList = Array.isArray(profiles) ? profiles : [];

  for (const destination of LANDING_PRIORITY) {
    if (destination.space && destination.space !== space) continue;
    if (
      destination.role &&
      String(role || "").toLowerCase() !== destination.role
    ) {
      continue;
    }

    const hasSignal = Boolean(destination.profile);
    if (hasSignal && !profileList.includes(destination.profile)) continue;

    if (destination.capability) {
      const { module, capability } = destination.capability;
      const right = holdsRight(effective, module, capability);
      if (right === false) continue;
      // Unknown matrix: only a profile can still justify the destination. A
      // capability-only entry waits for the real matrix.
      if (right === null && !hasSignal) continue;
    }

    if (destination.kind === "team") {
      return teamId ? `/member/team/${teamId}` : "/member/team";
    }
    if (destination.href) return destination.href;
  }

  // Space home: the structural fallback, never a role-label branch.
  if (space === "admin") return "/admin";
  if (space === "staff") return "/staff";
  return MEMBER_HOME;
}

/**
 * Which Venture memberships mark their holder as the Venture's founder.
 *
 * This is the classification the authorization layer already uses (an owning
 * membership, or one typed as founder), kept here so the question "is this
 * person a Venture's founder?" has ONE answer instead of one per caller.
 */
export function isFounderMembership(row) {
  const owner = row?.is_owner === true || Number(row?.is_owner) === 1;
  return String(row?.member_type || "").toLowerCase() === "founder" || owner;
}



/**
 * WHERE A PERSON BELONGS AFTER SIGNING IN — the single answer shared by the
 * login redirect, the workspaces hub's home button and the root bounce page.
 *
 * Two questions, asked in this order:
 *
 *   1. Is this an ENTITY account? A team login IS the account, not a person:
 *      it keeps its own workspace.
 *   2. Otherwise, does the identity own a SECTION? Staff, a program manager and
 *      the platform owner work in their own section, whatever they also happen
 *      to own (a Venture is one of their doors, not their desk).
 *
 * Everyone else belongs to the member space, and the member space has ONE home:
 * `/dashboard`. The page is identical for a participant, a facilitator, a
 * venture member, a founder, a learner and an investor — what changes is which
 * SECTIONS it shows, and that is decided by the dashboard's own read from the
 * relationships the person really holds.
 *
 * This is why the landing no longer branches on memberships: sending a founder
 * into their Venture, or an investor into an investor-only page, would give two
 * members two different dashboards again.
 */
export function resolveLanding({ role, teamId = null, profiles = [] } = {}) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  // An entity login IS the account (a team, a family), not a person whose
  // relationships would be read — it keeps its own space.
  if (normalizedRole === "team") return teamId ? `/member/team/${teamId}` : "/member/team";

  // D-1 — a staff identity carrying the program-manager PROFILE works in the
  // PM space. The hidden role default still lands there through ROLE_HOME.
  if (normalizedRole === "staff" && profiles.includes("program_manager")) {
    return roleHomeHref("program_manager");
  }

  const space = landingSpace(normalizedRole);
  if (space === "admin" || space === "staff") {
    return roleHomeHref(normalizedRole) || `/${space}`;
  }

  return MEMBER_HOME;
}

/**
 * Roles that are internal Future Studio staff and therefore allowed to submit
 * their own weekly operational reports (standups / retros).
 *
 * External roles are deliberately excluded:
 *   - facilitator  → external, program-scoped
 *   - participant / member / founder / investor / mentor / finance
 */
export const INTERNAL_OPS_ROLES = [
  "super_admin",
  "staff",
  "program_manager",
];
