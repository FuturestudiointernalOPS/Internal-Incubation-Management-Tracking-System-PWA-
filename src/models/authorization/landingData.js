/**
 * LANDING PRIORITY — DATA ONLY.
 *
 * The order in which a person's home is chosen after sign-in. Each entry is a
 * destination plus the condition that makes it applicable:
 *
 *   space        "admin" | "staff" | "member" — the structural space
 *   role         an exact session role (only `team` uses it)
 *   profile      an active profile key
 *   capability   { module, capability } — the right the destination requires
 *   kind         "team" for destinations whose href is dynamic
 *
 * The decision engine never reads a destination out of thin air: it walks this
 * list and stops at the first entry whose condition holds.
 *
 * ── The member space has ONE home ────────────────────────────────────────────
 * Every member-space identity resolves to `/dashboard`. The page no longer
 * changes with a membership: a founder, an investor, a facilitator and a
 * learner all open the SAME dashboard, and the sections inside it are decided
 * by the dashboard's own read (see `services/member/dashboard.js`). There is
 * therefore no "owned venture" or "investor" destination here any more — those
 * were the two ways the product used to give two members two dashboards.
 *
 * The only member-space exception is `team`: an entity account is the account
 * itself, not a person, and keeps its own workspace.
 *
 * Consumed by `resolveLandingFromAccess` in `models/platform/roles.js`.
 */

export const LANDING_PRIORITY = [
  // ── Internal / owner ─────────────────────────────────────────────────────
  {
    key: "admin",
    href: "/admin",
    space: "admin",
    capability: { module: "permissions", capability: "view_matrix" },
  },
  // The owner stays in the admin space even if the matrix view was revoked;
  // the admin dashboard is the space's home, not a role label branch.
  { key: "admin_home", href: "/admin", space: "admin" },

  {
    key: "program_manager",
    href: "/staff/program-manager",
    space: "staff",
    profile: "program_manager",
    capability: { module: "programs", capability: "view" },
  },
  {
    key: "finance",
    href: "/staff/finance",
    space: "staff",
    capability: { module: "finance", capability: "view" },
  },
  { key: "staff_home", href: "/staff", space: "staff" },

  // ── Member space ─────────────────────────────────────────────────────────
  { key: "team", kind: "team", space: "member", role: "team" },
  // THE one member dashboard, for every member.
  { key: "member_home", href: "/dashboard", space: "member" },
];
