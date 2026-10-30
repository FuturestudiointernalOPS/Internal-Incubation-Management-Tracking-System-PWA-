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
      "finance", "operations", "intelligence", "reports", "knowledge", "lms", "settings",
    ],
    children: {
      crm: [
        "crm_dashboard", "all_contacts", "crm_organizations", "crm_leads",
        "crm_opportunities", "crm_pipelines", "crm_activities", "crm_segments",
        "crm_automations", "crm_timeline", "crm_membership", "crm_duplicates",
        "pending_users", "bulk_upload",
      ],
      communication: ["messages", "announcements", "forms"],
      programs: ["all_programs", "create_program", "progress"],
      ventures: ["all_ventures"],
      investors: ["investors_manage", "investors_dashboard", "investors_review", "investors_campaigns", "investors_relationships"],
      operations: ["internal_ops_board", "all_projects", "create_project", "tasks", "blockers", "standup", "retro"],
      reports: ["program_reports", "internal_reports", "metrics"],
      knowledge: ["knowledge_base"],
      lms: ["lms_courses", "lms_registrations"],
      settings: ["system", "security", "audit_logs", "access_summary", "permissions"],
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
    // The CRM responsibility opens the whole workspace as one section. Children
    // whose admin route has no non-admin equivalent are deliberately absent
    // (duplicates, pending approvals, bulk import arrive through capabilities
    // or stay in the Super Admin shell).
    //
    // Forms and runs are NOT CRM: they belong to the Communication feature, so
    // they open through the Communication section like they do for every other
    // role. The Forms workspace itself carries Runs in its own sidebar.
    top: ["crm", "communication"],
    children: {
      crm: [
        "crm_dashboard", "all_contacts", "crm_organizations", "crm_leads",
        "crm_opportunities", "crm_pipelines", "crm_activities", "crm_segments",
        "crm_automations", "crm_timeline", "crm_membership", "crm_duplicates",
      ],
      communication: ["forms"],
    },
    hrefs: {
      crm_dashboard: "/crm",
      all_contacts: "/crm/contacts",
      crm_timeline: "/crm/timeline",
      crm_membership: "/crm/membership",
      crm_duplicates: "/crm/duplicates",
    },
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
//   authorization/constants (canonical) → featureAccess responsibility roles
//   → NAV_CAPABILITY_REQUIREMENTS (node → module capability) → projection.
// navigation.test.js's "capability projection consistency" contract locks:
// requirements resolve to real catalog capabilities/nav nodes, show/hide ids
// never exceed the eligibility boundary, and every extra has a landing href.
// Changing eligibility for a feature does NOT auto-change the menu — add the
// node to a role's hide/show list deliberately (visibility is curated, and
// the server gates remain authoritative).
/**
 * A requirement names one capability, or a list of alternatives ("any of").
 * The CRM section is the first user: the workspace is granted by `crm.view`,
 * while a people-only profile carries `contacts.view` — either one opens the
 * section, and each child keeps its own, stricter requirement.
 */
export function requirementAlternatives(requirement) {
  if (!requirement) return [];
  return Array.isArray(requirement.anyOf) ? requirement.anyOf : [requirement];
}

export const NAV_CAPABILITY_REQUIREMENTS = {
  // The section opens for any of its three live domains; the children below
  // stay strict, so a membership-only profile sees the roster and nothing else.
  crm: {
    anyOf: [
      { module: "crm", capability: "view" },
      { module: "contacts", capability: "view" },
      { module: "org_membership", capability: "view" },
      { module: "duplicates", capability: "view" },
    ],
  },
  crm_dashboard: {
    anyOf: [
      { module: "crm", capability: "view" },
      { module: "contacts", capability: "view" },
    ],
  },
  // People and their history belong to the contacts module.
  all_contacts: { module: "contacts", capability: "view" },
  crm_timeline: { module: "contacts", capability: "view" },
  // The records layer is the CRM module's own surface.
  crm_organizations: { module: "crm", capability: "view" },
  crm_leads: { module: "crm", capability: "view" },
  crm_opportunities: { module: "crm", capability: "view" },
  crm_pipelines: { module: "crm", capability: "view" },
  crm_activities: { module: "crm", capability: "view" },
  crm_segments: { module: "crm", capability: "view" },
  crm_automations: { module: "crm", capability: "view" },
  // Membership lives under the CRM section but is backed by its own module
  // (GET /api/org-membership requires org_membership.view) — so it only appears
  // when that capability is actually held, not merely because CRM is granted.
  crm_membership: { module: "org_membership", capability: "view" },
  // The queue and the import are administration doors, kept in the CRM section
  // by decision; each follows the capability its endpoint actually checks.
  crm_duplicates: { module: "duplicates", capability: "view" },
  pending_users: { module: "permissions", capability: "view_matrix" },
  bulk_upload: { module: "bulk_upload", capability: "execute" },
  finance: { module: "finance", capability: "view" },
  security: { module: "settings", capability: "view" },
  programs: { module: "programs", capability: "view" },
  knowledge: { module: "knowledge", capability: "view" },
  // LMS — course authoring. Any of the three authoring rights opens the
  // section: a delegated creator may hold `create` without `view` (the course
  // reads accept it), and an editor may hold only `edit`. Admin-capable roles
  // (super_admin) open the /admin/lms pages directly; a role without a
  // reachable non-admin landing still has the node DROPPED by the projection
  // (no dead links), so this requirement never leaks an /admin link.
  lms: {
    anyOf: [
      { module: "lms", capability: "view" },
      { module: "lms", capability: "create" },
      { module: "lms", capability: "edit" },
    ],
  },
  reports: { module: "reports", capability: "view" },
  ventures: { module: "ventures", capability: "view" },
  investors: { module: "investor", capability: "view" },
  // The section opens for any of its live domains, exactly like the CRM
  // section: a person allowed to read forms or runs no longer loses the whole
  // Communication section because they cannot read messages.
  communication: {
    anyOf: [
      { module: "messaging", capability: "view" },
      { module: "internal_comms", capability: "view" },
      { module: "forms", capability: "view" },
      { module: "runs", capability: "view" },
      { module: "collections", capability: "view" },
    ],
  },
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
  crm_organizations: "/crm/organizations",
  crm_leads: "/crm/leads",
  crm_opportunities: "/crm/opportunities",
  crm_pipelines: "/crm/pipelines",
  crm_activities: "/crm/activities",
  crm_segments: "/crm/segments",
  crm_automations: "/crm/automations",
  crm_membership: "/crm/membership",
  crm_duplicates: "/crm/duplicates",
  crm_timeline: "/crm/timeline",
  forms: "/platform",
  lms_courses: "/pm/lms/courses",
};
