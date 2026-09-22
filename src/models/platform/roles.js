/**
 * PLATFORM ROLE RESOLUTION
 *
 * Single source of truth for the default role. A user with no Program
 * assignment and no explicit privileged role is a PARTICIPANT — never Staff.
 *
 * Staff/program-manager/admin/etc. are only applied when explicitly
 * assigned (e.g. a group's configured default_role, or an admin action).
 */

export const DEFAULT_ROLE = "participant";

export const PRIVILEGED_ROLES = new Set([
  "super_admin",
  "admin",
  "staff",
  "program_manager",
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
 * Policy: an ACTIVE FUTURE STUDIO membership = internal staff membership.
 *
 * Precedence (high → low):
 *   1. Team / Family entity logins keep their entity identity.
 *   2. Privileged identities ALWAYS win and are never overridden by group
 *      membership — this is what protects Super Admin from demotion/lockout.
 *   3. Staff-family roles (staff / project_manager / admin) normalize to staff.
 *   4. An ACTIVE FUTURE STUDIO membership ⇒ staff  (the rule). Expired or
 *      ended memberships must NOT produce staff — the caller passes the
 *      EFFECTIVE (active, unexpired) group list from the membership layer.
 *   5. All other identities (participant, member, facilitator, ...)
 *      keep their role; unknown/empty roles default to participant.
 *
 * Known conflicts (deliberate, per policy):
 *   - A participant with an active FUTURE STUDIO membership is resolved as
 *     staff at login (their participant identity is overridden; enrollments
 *     stay visible via the Workspaces hub).
 *   - A facilitator with an active FUTURE STUDIO membership is
 *     resolved as staff. If an external facilitator must keep their
 *     facilitator identity even inside the group, move facilitator
 *     before the group rule.
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
  const r = String(role || "").trim().toLowerCase();

  if (isTeam) return "team";
  if (isFamily) return "participant"; // family entity acts as participant

  if (r === "super_admin" || legacySa) return "super_admin";
  if (r === "developer") return "developer";
  if (r === "investor") return "investor";
  if (r === "founder") return "founder";

  // Staff-family identities normalize to staff. Program Manager is a function
  // layered on Staff (not a separate global identity) — a PM contact must
  // resolve to staff at login, never fall through to participant.
  if (r === "staff" || r === "program_manager" || r === "project_manager" || r === "admin") return "staff";

  // THE RULE — active FUTURE STUDIO membership = internal staff membership.
  // `group_name` is accepted as a compatibility fallback for callers that
  // only have the raw contact column (it must then be a CURRENT group value).
  const memberGroups = Array.isArray(groups) ? groups : [];
  if (group_name) memberGroups.push(group_name);
  const isInternal = memberGroups.some(
    (g) => String(g || "").trim().toUpperCase() === INTERNAL_GROUP,
  );
  if (isInternal) return "staff";

  // Explicit identities are preserved outside the group.
  if (["participant", "member", "facilitator"].includes(r)) return r;
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
  facilitator: "/facilitator",
  developer: "/developer",
  participant: "/participant",
  // A member starts on the DASHBOARD (the page that owns the calendar), not on
  // the /workspaces listing — the workspace hub showed first and read like a
  // second home. Contexts are sidebar additions and the hub stays reachable.
  // With no program context the dashboard simply shows its empty states.
  member: "/participant",
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
 * depends on a Venture membership — which is also why reading those memberships
 * for such a person would be wasted work.
 */
export function landingNeedsRelationships(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "team") return false; // an entity account, not a person
  const home = roleHomeHref(r);
  // The personal identities share the Participant surface, and an identity the
  // map does not know has no section of its own to claim.
  return !home || r === "member" || r === "participant";
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
 *
 * The last resort is the neutral hub, which refuses nobody, so no branch here
 * can strand someone.
 */
export function resolveLanding({ role, teamId = null, ventures = [] } = {}) {
  const r = String(role || "").trim().toLowerCase();

  // An entity login IS the account (a team, a family), not a person whose
  // relationships would be read — it keeps its own space.
  if (r === "team") return teamId ? `/team/${teamId}` : "/team";

  const home = roleHomeHref(r);
  if (!landingNeedsRelationships(r)) return home;

  const owned = (ventures || []).filter((v) => isActiveVenture(v) && isFounderMembership(v));
  if (owned.length === 1 && owned[0].venture_id) {
    return `/participant/ventures/${owned[0].venture_id}`;
  }

  // Several Ventures is not a decision this rule can take for the person, and
  // none is the empty state the personal surfaces already handle.
  return home || "/workspaces";
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
  "admin",
  "developer",
];
