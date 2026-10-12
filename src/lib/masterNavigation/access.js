/**
 * ImpactOS — Master Navigation: role access tables.
 *
 * Pointers and overrides only — never navigation STRUCTURE (that lives in
 * ./nodes.js). Roles declare which master nodes they can see, the routes those
 * nodes resolve to in the role's context, and any icon overrides.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ROLE_ACCESS — flat access/context data per role. Pointers only:
//   top      — ordered ids of the nodes shown at the top level of the sidebar
//              (a node may be hoisted here from anywhere in the master tree).
//   children — ordered ids of the visible children for a section node.
//              Absent/empty = the node renders as a leaf (with its resolved
//              href) — exactly how a section collapses to a link per role.
//   hrefs    — role-scoped route resolution for nodes whose URL differs in
//              this role's context.
//   icons    — icon-name overrides for nodes whose icon differs in this role.
// Super Admin's view is the canonical expression of the master tree.
// ─────────────────────────────────────────────────────────────────────────────
export const ROLE_ACCESS = {
  super_admin: {
    top: [
      "dashboard", "crm", "communication", "programs", "ventures", "investors",
      "finance", "operations", "intelligence", "reports", "knowledge", "lms", "security", "settings",
    ],
    children: {
      crm: ["crm_dashboard", "all_contacts", "crm_membership", "crm_timeline", "crm_duplicates", "pending_users", "bulk_upload"],
      communication: ["messages", "announcements", "forms"],
      programs: ["all_programs", "create_program", "progress"],
      ventures: ["all_ventures", "venture_projects"],
      investors: ["investors_manage", "investors_dashboard", "investors_review", "investors_overview", "investors_campaigns", "investors_relationships"],
      operations: ["internal_ops_board", "all_projects", "create_project", "tasks", "blockers", "standup", "retro"],
      reports: ["program_reports", "internal_reports", "metrics"],
      knowledge: ["knowledge_base"],
      lms: ["lms_courses", "lms_registrations"],
      security: ["security", "audit_logs", "access_summary", "permissions"],
      settings: ["integrations", "system"],
    },
    hrefs: {},
    icons: {},
  },

  // NOTE (Phase H vocabulary) — no CONTEXTUAL profile has a mask here: a profile
  // is not a role. A legacy value (program_manager, facilitator, participant,
  // founder, investor) is normalized to its BASELINE surface by the projection
  // builders (staff for a staff-only profile, member otherwise), and the personal
  // surfaces are relationship-driven, so an account not yet aligned still gets a
  // working sidebar instead of the neutral fallback.
  staff: {
    top: ["dashboard", "weekly_ops", "programs", "my_projects", "communication"],
    children: {
      communication: ["messages", "forms"],
    },
    hrefs: {
      dashboard: "/staff",
      programs: "/pm/programs",
      messages: "/staff/messages",
    },
    icons: {},
  },

  member: {
    top: ["dashboard"],
    children: {},
    // The dashboard is the page that owns the calendar. A member has no
    // program context yet, so it is the participant dashboard's empty state —
    // NOT the /workspaces hub, which made "the workspace show first".
    hrefs: { dashboard: "/participant" },
    icons: {},
  },

  team: {
    top: ["dashboard", "programs"],
    children: {},
    hrefs: { dashboard: "/team", programs: "/team" },
    icons: {},
  },

  finance: {
    top: ["dashboard", "profile"],
    children: {},
    hrefs: {
      dashboard: "/finance",
      profile: "/participant/profile",
    },
    icons: { dashboard: "barChart3" },
  },

  crm: {
    top: ["crm_dashboard", "forms"],
    children: {},
    hrefs: { crm_dashboard: "/crm" },
    icons: {},
  },
};

// ─── Capability-projected navigation (Phase: nav reflects effective access) ──
// Nodes that represent GLOBAL-management sections carry a capability
// requirement. The projection only touches nodes listed here — everything
// else stays role-mask-driven, and roles without projection rules are
// untouched. Server-side authorization remains authoritative; this is
// visibility only.
//
// CONFIG CHAIN (single source, enforced by tests):
//   eligibility-defaults (canonical) → featureAccess responsibility roles
//   → NAV_CAPABILITY_REQUIREMENTS (node → module capability) → projection.
// navigation.test.js's "capability projection consistency" contract locks:
// requirements resolve to real catalog capabilities/nav nodes, show/hide ids
// never exceed the eligibility boundary, and every extra has a landing href.
// Changing eligibility for a feature does NOT auto-change the menu — add the
// node to a role's hide/show list deliberately (visibility is curated, and
// the server gates remain authoritative).
export const NAV_CAPABILITY_REQUIREMENTS = {
  crm: { module: "contacts", capability: "view" },
  // Membership lives under the CRM section but is backed by its own module
  // (GET /api/org-membership requires org_membership.view) — so it only appears
  // when that capability is actually held, not merely because CRM is granted.
  crm_membership: { module: "org_membership", capability: "view" },
  finance: { module: "finance", capability: "view" },
  security: { module: "settings", capability: "view" },
  programs: { module: "programs", capability: "view" },
  knowledge: { module: "knowledge", capability: "view" },
  // LMS — course authoring. Admin-capable roles (super_admin) open
  // the /admin/lms pages directly; a role without a reachable non-admin landing
  // still has the node DROPPED by the projection (no dead links), so this
  // requirement never leaks an /admin link to a non-admin role.
  lms: { module: "lms", capability: "view" },
  reports: { module: "reports", capability: "view" },
  ventures: { module: "ventures", capability: "view" },
  // The Project Management view reads the Venture's work through the SAME
  // capability that already means "may read this Venture" — the scope half of
  // requireVentureScopedAccess is what keeps one Venture Manager out of another
  // Venture's work. No new permission model.
  venture_projects: { module: "ventures", capability: "view" },
  investors: { module: "investor", capability: "view" },
  communication: { module: "messaging", capability: "view" },
  weekly_ops: { module: "reports", capability: "create" },
  my_projects: { module: "projects", capability: "view" },
  messages: { module: "messaging", capability: "view" },
  projects: { module: "projects", capability: "view" },
  operations: { module: "tasks", capability: "view" },
  settings: { module: "settings", capability: "view" },
};

// Admin-only destinations remapped to a page the role can actually open. Any
// OTHER /admin node is dropped for a non-admin role: the sidebar never renders
// a link the role would be redirected away from.
export const NON_ADMIN_HREF_FALLBACKS = {
  finance: "/finance",
  crm_dashboard: "/crm",
  all_contacts: "/crm/contacts",
  crm_membership: "/crm/membership",
  crm_timeline: "/crm/timeline",
  forms: "/platform",
  lms_courses: "/pm/lms/courses",
};
