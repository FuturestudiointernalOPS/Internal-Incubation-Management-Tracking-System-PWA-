/**
 * LANDING PRIORITY — DATA ONLY.
 *
 * The order in which a person's home is chosen after sign-in. Each entry is a
 * destination plus the condition that makes it applicable:
 *
 *   space        "admin" | "staff" | "member" — the structural space
 *   role         an exact session role (only `team` uses it)
 *   profile      an active profile key
 *   relationship a boolean fact (isInvestor, isFounder, isProgramParticipant)
 *   capability   { module, capability } — the right the destination requires
 *   kind         "owned-venture" | "team" for destinations whose href is dynamic
 *
 * A profile and a relationship on the same entry are alternatives (either one
 * opens it). A capability is required IN ADDITION when present.
 *
 * The decision engine never reads this file: it is consumed by
 * `resolveLandingFromAccess` in `models/platform/roles.js`.
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

  // ── Member contexts ──────────────────────────────────────────────────────
  { key: "team", kind: "team", space: "member", role: "team" },
  // Exactly one active owned venture: the person lands inside it. Several
  // ventures is deliberately not a decision the rule takes for them.
  { key: "owned_venture", kind: "owned-venture", space: "member" },
  {
    key: "investor",
    href: "/member/investor/dashboard",
    space: "member",
    profile: "investor",
    relationship: "isInvestor",
  },
  {
    key: "founder",
    href: "/member/founder",
    space: "member",
    profile: "founder",
    relationship: "isFounder",
  },
  {
    key: "facilitator",
    href: "/member/facilitator",
    space: "member",
    profile: "facilitator",
  },
  {
    key: "participant",
    href: "/member/participant",
    space: "member",
    profile: "participant",
    relationship: "isProgramParticipant",
  },
  // The neutral member hub refuses nobody.
  { key: "member_hub", href: "/member", space: "member" },
];
