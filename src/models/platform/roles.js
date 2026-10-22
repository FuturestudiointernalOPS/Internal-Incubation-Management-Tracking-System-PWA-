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
 * Where each GLOBAL role lands after login. Single source of truth shared by
 * the login redirect and the workspaces hub so the hub's "My Dashboard"
 * button can never drift from the real login routing.
 *
 * A PERSONAL identity deliberately has NO entry here: "member" is what anyone
 * without a role resolves to, so the map cannot hand it the Participant page as
 * a default. That page is a PROGRAM seat — an enrollment, an owned Venture or
 * an approved investor profile decides it (see `resolveLanding`), and the
 * neutral hub is the destination that refuses nobody.
 *
 * Roles not listed here (or dynamic targets like team/founder) fall back to
 * the neutral /workspaces hub.
 */
export const ROLE_HOME = {
  super_admin: "/admin",
  program_manager: "/pm",
  staff: "/staff",
  facilitator: "/facilitator",
  participant: "/participant",
  finance: "/finance",
  investor: "/investor/dashboard",
};

export function roleHomeHref(role) {
  return ROLE_HOME[String(role || "").toLowerCase()] || null;
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

/** A Venture is active unless the membership row says otherwise. */
const isActiveVenture = (row) =>
  String(row?.status || row?.venture_status || "active").toLowerCase() === "active";

/**
 * Whether the LANDING depends on what the person belongs to.
 *
 * A global identity works in a section of the platform, so its home never
 * depends on a relationship — which is also why reading them for such a person
 * would be wasted work. A PERSONAL identity is the opposite: it has no section
 * of its own, and the Participant surface is a PROGRAM seat, so a relationship
 * read is exactly what decides it.
 */
export function landingNeedsRelationships(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "team") return false; // an entity account, not a person
  const home = roleHomeHref(normalizedRole);
  // No section of its own, or the Participant surface: both are decided by the
  // person's actual enrollments/memberships.
  return !home || home === "/participant";
}

/**
 * WHERE A PERSON BELONGS AFTER SIGNING IN — the single answer shared by the
 * login redirect, the neutral hub's home button and the root bounce page.
 *
 * Two questions, asked in this order, because they are not the same question:
 *
 *   1. A GLOBAL identity owns a whole SECTION: where that person works follows
 *      from being staff, a program manager, the platform's administrator. A
 *      Venture they happen to own is one of their doors, not their desk.
 *   2. Everyone else lives in the PERSONAL world, where the RELATIONSHIPS
 *      decide. Founding exactly one active Venture is the case the product
 *      wants to land directly inside it. That is a fact about what the person
 *      OWNS, and the baseline badge ("member") cannot express it — which is why
 *      the old badge-keyed shortcut only ever fired for legacy accounts.
 *      Being MADE an investor (an approved investor context) is the same kind
 *      of fact, so it lands in the investor space for the same reason.
 *
 * Precedence inside the personal world: an owned Venture first (the existing
 * single-Venture shortcut is unchanged), then an approved investor context,
 * then a PROGRAM ENROLLMENT. A person who owns a Venture also gets the
 * investor door in the sidebar; the Venture still wins the landing.
 *
 * The Participant page is a PROGRAM seat, not the resting place of every
 * personal identity: "member" is what anyone with no role resolves to, so it
 * cannot, on its own, open a page reserved for a program's participants. A
 * person with no program, no Venture and no investor context is offered the
 * neutral hub, which lists the contexts they really hold.
 *
 * The last resort is that neutral hub, which refuses nobody, so no branch here
 * can strand someone.
 */
export function resolveLanding({
  role,
  teamId = null,
  ventures = [],
  isInvestor = false,
  isProgramParticipant = false,
  profiles = [],
} = {}) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  // An entity login IS the account (a team, a family), not a person whose
  // relationships would be read — it keeps its own space.
  if (normalizedRole === "team") return teamId ? `/team/${teamId}` : "/team";

  // D-1 — a staff identity carrying the program-manager PROFILE works in the
  // PM space. The hidden role default still lands there through ROLE_HOME.
  if (normalizedRole === "staff" && profiles.includes("program_manager")) {
    return roleHomeHref("program_manager");
  }

  const home = roleHomeHref(normalizedRole);
  if (!landingNeedsRelationships(normalizedRole)) return home;

  const owned = (ventures || []).filter((venture) => isActiveVenture(venture) && isFounderMembership(venture));
  if (owned.length === 1 && owned[0].venture_id) {
    return `/participant/ventures/${owned[0].venture_id}`;
  }

  // An approved investor context is a relationship the badge cannot carry:
  // a baseline member who was taken as an investor belongs in their investor
  // space, not on the empty participant dashboard.
  if (isInvestor) return roleHomeHref("investor");

  // THE PARTICIPANT PAGE IS A PROGRAM SEAT. Only an actual enrollment hands
  // out that destination; without one the person is offered the neutral hub,
  // which lists the contexts they really hold and refuses nobody.
  if (!isProgramParticipant) return "/workspaces";

  return home || "/participant";
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
