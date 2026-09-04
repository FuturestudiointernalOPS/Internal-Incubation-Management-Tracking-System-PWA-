/**
 * ImpactOS — Master Navigation
 *
 * ONE canonical navigation tree for the whole application, consumed by every
 * role. Roles never define navigation structure; they only declare ACCESS to
 * the master tree:
 *
 *   MASTER_NAVIGATION (structure — defined once)
 *        ↓
 *   ROLE_ACCESS (flat id masks + href/icon overrides per role)
 *        ↓
 *   buildRoleNav(role) → the role's projected view (a filter, not a copy)
 *
 * Rules:
 * - A node (concept) exists exactly once, identified by its stable `id`.
 * - Route differences between roles (e.g. /admin/programs vs /pm/programs)
 *   are a ROUTING concern, resolved via ROLE_ACCESS.hrefs — never by
 *   duplicating the node.
 * - ROLE_ACCESS contains only pointers (ordered id arrays) and overrides —
 *   zero structure. Do not add navigation sections to a role config; extend
 *   MASTER_NAVIGATION instead.
 * - Node ids are the contract shared with NAV_KEY_MAP (labels), CRUMB_PATH_MAP
 *   (breadcrumbs), NAV_RESPONSIBILITY_MAP (access), badges, active-route
 *   detection and the future permission system. Never rename an id.
 * - Icons are stored as string names here (keeps this module test-friendly);
 *   the sidebar resolves them to components (see NAV_ICONS in DashboardLayout).
 */

// Shared leaf nodes — referenced from more than one parent in the master
// tree. Defined ONCE; parents hold the same object reference (never a copy).
const standupNode = { id: "standup", name: "STANDUP", href: "/staff/op-report?tab=standup" };
const retroNode = { id: "retro", name: "RETRO", href: "/staff/op-report?tab=retro" };
const myProjectsNode = { id: "my_projects", name: "MY PROJECTS", icon: "briefcase", href: "/staff/projects" };

export const MASTER_NAVIGATION = [
  { id: "dashboard", name: "DASHBOARD", icon: "layoutDashboard", href: "/admin" },

  // CRM — people data only (communication is its own section)
  {
    id: "crm",
    name: "CRM",
    icon: "users",
    children: [
      { id: "crm_dashboard", name: "DASHBOARD", icon: "users", href: "/admin/crm" },
      { id: "all_contacts", name: "PEOPLE", href: "/admin/communications/contacts" },
      { id: "crm_membership", name: "MEMBERSHIP", href: "/admin/crm/membership" },
      { id: "crm_timeline", name: "TIMELINE", href: "/admin/crm/timeline" },
      { id: "crm_duplicates", name: "DUPLICATES", href: "/admin/crm/duplicates" },
      { id: "pending_users", name: "PENDING APPROVALS", href: "/admin/pending-users" },
      { id: "bulk_upload", name: "BULK IMPORT", href: "/admin/bulk-upload" },
    ],
  },

  // Communication — messaging, announcements, forms + outreach suite.
  // Deliberately separate from CRM (people data only) above.
  {
    id: "communication",
    name: "COMMUNICATION",
    icon: "messageSquare",
    children: [
      { id: "messages", name: "MESSAGES", icon: "send", href: "/admin/internal-comms" },
      { id: "announcements", name: "ANNOUNCEMENTS", href: "/admin/announcements" },
      { id: "campaigns", name: "CAMPAIGNS", href: "/admin/communications/campaigns" },
      { id: "segments", name: "SEGMENTS", href: "/admin/communications/segments" },
      { id: "forms", name: "FORMS", icon: "fileText", href: "/platform" },
      { id: "responses", name: "RESPONSES", href: "/admin/communications/responses" },
      { id: "groups", name: "GROUPS", href: "/pm/communications/contacts" },
    ],
  },

  {
    id: "programs",
    name: "PROGRAMS",
    icon: "briefcase",
    children: [
      { id: "all_programs", name: "ALL PROGRAMS", href: "/admin/programs" },
      { id: "create_program", name: "CREATE PROGRAM", href: "/admin/programs/new" },
      { id: "progress", name: "PROGRESS", href: "/admin/progress" },
    ],
  },

  {
    id: "ventures",
    name: "VENTURES",
    icon: "rocket",
    children: [
      { id: "all_ventures", name: "ALL VENTURES", href: "/admin/ventures" },
      { id: "register_venture", name: "REGISTER STARTUP", href: "/admin/ventures/register" },
    ],
  },

  {
    id: "investors",
    name: "INVESTORS",
    icon: "briefcase",
    children: [
      { id: "investors_manage", name: "INVESTOR MANAGEMENT", href: "/admin/investors" },
      { id: "investors_dashboard", name: "DASHBOARD", href: "/admin/investors/dashboard" },
      { id: "investors_review", name: "REVIEW", href: "/admin/investors/review" },
      { id: "investors_overview", name: "OVERVIEW", href: "/admin/investors/overview" },
      { id: "investors_campaigns", name: "CAMPAIGNS", href: "/admin/investors/campaigns" },
      { id: "investors_relationships", name: "RELATIONSHIPS", href: "/admin/investors/relationships" },
    ],
  },

  { id: "finance", name: "FINANCE", icon: "barChart3", href: "/admin/finance" },

  {
    id: "operations",
    name: "OPERATIONS",
    icon: "listTodo",
    children: [
      { id: "internal_ops_board", name: "OPS BOARD", href: "/admin/work" },
      { id: "all_projects", name: "PROJECTS", href: "/admin/projects" },
      { id: "create_project", name: "CREATE PROJECT", href: "/admin/projects?action=create" },
      { id: "tasks", name: "TASKS", href: "/admin/tasks" },
      { id: "blockers", name: "BLOCKERS", href: "/admin/blockers" },
      standupNode,
      retroNode,
    ],
  },

  {
    id: "reports",
    name: "REPORTS",
    icon: "fileText",
    children: [
      { id: "program_reports", name: "PROGRAM REPORTS", href: "/admin/reports/responses" },
      { id: "internal_reports", name: "OP REPORTS", href: "/admin/op-reports" },
      { id: "metrics", name: "PROGRAM HEALTH", href: "/admin/metrics" },
      myProjectsNode,
    ],
  },

  {
    id: "knowledge",
    name: "KNOWLEDGE",
    icon: "library",
    children: [
      { id: "knowledge_base", name: "KNOWLEDGE BASE", href: "/admin/knowledge" },
      { id: "intelligence", name: "INTELLIGENCE", href: "/admin/intelligence" },
    ],
  },

  // LMS — course authoring & learning library (admin)
  {
    id: "lms",
    name: "LMS",
    icon: "graduationCap",
    children: [
      { id: "lms_courses", name: "COURSES", href: "/admin/lms/courses" },
    ],
  },

  // Security & compliance
  {
    id: "security",
    name: "SECURITY",
    icon: "shieldCheck",
    children: [
      { id: "security", name: "SECURITY", href: "/admin/security" },
      { id: "audit_logs", name: "AUDIT LOGS", href: "/admin/audit-logs" },
      { id: "access_summary", name: "USER ACCESS", href: "/admin/access" },
      { id: "permissions", name: "PERMISSIONS", href: "/admin/security/permissions" },
    ],
  },

  // System configuration
  {
    id: "settings",
    name: "SETTINGS",
    icon: "wrench",
    children: [
      { id: "integrations", name: "INTEGRATIONS", href: "/admin/integrations" },
      { id: "engineering_dashboard", name: "ENGINEERING", href: "/admin/engineering" },
      { id: "system", name: "SYSTEM MONITORING", href: "/admin/system" },
    ],
  },

  // Additional top-level surfaces owned by other roles (kept in the master
  // tree so every concept has exactly one definition).
  { id: "projects", name: "PROJECTS", icon: "rocket", href: "/admin/projects" },
  { id: "weekly_ops", name: "WEEKLY OPS", icon: "calendar", href: "/staff/op-report" },
  myProjectsNode,
  { id: "my_programs", name: "MY PROGRAMS", icon: "briefcase", href: "/facilitator/programs" },
  { id: "reviews", name: "MY REVIEWS", icon: "clipboardList", href: "/facilitator/reviews" },
  { id: "profile", name: "PROFILE", icon: "user", href: "/facilitator/profile" },
  { id: "my_tasks", name: "MY TASKS", icon: "checkSquare", href: "/developer/my-tasks" },
  { id: "assigned_tasks", name: "ASSIGNED TASKS", icon: "listTodo", href: "/developer/assigned-tasks" },
  {
    id: "rituals",
    name: "STANDUPS & RETROS",
    icon: "messageSquare",
    children: [standupNode, retroNode],
  },
  { id: "notifications", name: "NOTIFICATIONS", icon: "bell", href: "/developer/notifications" },
  { id: "learning", name: "MY LEARNING", icon: "graduationCap", href: "/participant/learning" },
  { id: "certificates", name: "MY CERTIFICATES", icon: "fileText", href: "/participant/certificates" },
  { id: "timeline", name: "MY TIMELINE", icon: "clock", href: "/participant/profile#timeline" },
  { id: "pipeline", name: "PIPELINE", icon: "barChart3", href: "/investor/pipeline" },
  { id: "portfolio", name: "PORTFOLIO", icon: "trendingUp", href: "/investor/portfolio" },
  { id: "activity", name: "ACTIVITY", icon: "clock", href: "/investor/history" },
];

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
      "finance", "operations", "reports", "knowledge", "lms", "security", "settings",
    ],
    children: {
      crm: ["crm_dashboard", "all_contacts", "crm_membership", "crm_timeline", "crm_duplicates", "pending_users", "bulk_upload"],
      communication: ["messages", "announcements", "campaigns", "segments", "forms", "responses"],
      programs: ["all_programs", "create_program", "progress"],
      ventures: ["all_ventures", "register_venture"],
      investors: ["investors_manage", "investors_dashboard", "investors_review", "investors_overview", "investors_campaigns", "investors_relationships"],
      operations: ["internal_ops_board", "all_projects", "create_project", "tasks", "blockers", "standup", "retro"],
      reports: ["program_reports", "internal_reports", "metrics"],
      knowledge: ["knowledge_base", "intelligence"],
      lms: ["lms_courses"],
      security: ["security", "audit_logs", "access_summary", "permissions"],
      settings: ["integrations", "engineering_dashboard", "system"],
    },
    hrefs: {},
    icons: {},
  },

  admin: {
    top: ["dashboard", "projects", "reports"],
    children: {},
    hrefs: { reports: "/admin/reports" },
    icons: { reports: "barChart3" },
  },

  program_manager: {
    top: ["dashboard", "programs", "communication", "reports"],
    children: {
      communication: ["groups", "messages"],
      reports: ["internal_reports", "my_projects"],
    },
    hrefs: {
      dashboard: "/pm",
      programs: "/pm/programs",
      messages: "/pm/messages",
      internal_reports: "/staff/op-report",
    },
    icons: {},
  },

  staff: {
    top: ["dashboard", "weekly_ops", "programs", "my_projects", "communication"],
    children: { communication: ["messages"] },
    hrefs: {
      dashboard: "/staff",
      programs: "/pm/programs",
      messages: "/staff/messages",
    },
    icons: {},
  },

  teacher: {
    top: ["dashboard", "communication", "programs"],
    children: {
      communication: ["groups"],
      programs: ["all_programs"],
    },
    hrefs: { dashboard: "/teacher", all_programs: "/pm/programs" },
    icons: {},
  },

  facilitator: {
    top: ["dashboard", "my_programs", "reviews", "profile"],
    children: {},
    hrefs: { dashboard: "/facilitator" },
    icons: {},
  },

  developer: {
    top: ["dashboard", "my_tasks", "assigned_tasks", "rituals", "projects", "notifications", "communication"],
    children: { rituals: ["standup", "retro"], communication: ["messages"] },
    hrefs: {
      dashboard: "/developer",
      projects: "/staff/projects",
      messages: "/staff/messages",
    },
    icons: { projects: "briefcase" },
  },

  member: {
    top: ["dashboard"],
    children: {},
    hrefs: { dashboard: "/workspaces" },
    icons: {},
  },

  participant: {
    top: ["dashboard", "learning", "programs", "certificates"],
    children: {},
    hrefs: {
      dashboard: "/participant",
      programs: "/participant/dashboard",
    },
    icons: {},
  },

  founder: {
    top: ["dashboard", "programs", "ventures", "timeline"],
    children: {},
    hrefs: {
      dashboard: "/participant",
      programs: "/participant/dashboard",
      ventures: "/participant/ventures",
    },
    icons: {},
  },

  team: {
    top: ["dashboard", "programs"],
    children: {},
    hrefs: { dashboard: "/team", programs: "/team" },
    icons: {},
  },

  investor: {
    top: ["dashboard", "pipeline", "portfolio", "activity", "profile"],
    children: {},
    hrefs: {
      dashboard: "/investor/dashboard",
      profile: "/investor/profile",
    },
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
    top: ["crm_dashboard", "communication"],
    children: { communication: ["forms"] },
    hrefs: { crm_dashboard: "/crm" },
    icons: {},
  },
};

export const NAV_ROLE_KEYS = Object.keys(ROLE_ACCESS);

// ─── Capability-projected navigation (Phase: nav reflects effective access) ──
// Nodes that represent GLOBAL-management sections carry a capability
// requirement. The projection only touches nodes listed here — everything
// else stays role-mask-driven, and roles without projection rules are
// untouched. Server-side authorization remains authoritative; this is
// visibility only.
export const NAV_CAPABILITY_REQUIREMENTS = {
  crm: { module: "contacts", capability: "view" },
  finance: { module: "finance", capability: "view" },
  security: { module: "settings", capability: "view" },
  programs: { module: "programs", capability: "view" },
  knowledge: { module: "knowledge", capability: "view" },
  reports: { module: "reports", capability: "view" },
  ventures: { module: "ventures", capability: "view" },
  investors: { module: "investor", capability: "view" },
  communication: { module: "messaging", capability: "view" },
  weekly_ops: { module: "reports", capability: "create" },
  my_projects: { module: "projects", capability: "view" },
  messages: { module: "messaging", capability: "view" },
  projects: { module: "projects", capability: "view" },
  operations: { module: "tasks", capability: "view" },
  settings: { module: "settings", capability: "view" },
};

// Per-role projection rules. Only Staff (incl. PM-as-staff, which resolves to
// the staff session role) is projected today: nodes in `hide` disappear when
// the capability is missing, sections in `show` appear when the capability is
// present (e.g. CRM for a Staff member granted contacts.view). Other roles
// keep their role masks exactly as before.
export const ROLE_NAV_PROJECTION = {
  staff: {
    hide: ["programs", "weekly_ops", "my_projects", "messages"],
    show: ["crm", "finance", "security", "knowledge", "reports", "ventures", "investors"],
  },
};

// Primary landing URL for sections added by the projection (rendered as leaf
// links — never the full admin child list, which may be admin-only).
export const EXTRA_SECTION_HREFS = {
  crm: "/admin/crm",
  finance: "/admin/finance",
  security: "/admin/security",
  knowledge: "/admin/knowledge",
  reports: "/admin/reports/responses",
  ventures: "/admin/ventures",
  investors: "/admin/investors",
};

/** Pure capability check against an effective matrix. */
export function hasCapability(effective, module, capability, minLevel = 1) {
  return Number(effective?.[module]?.[capability] ?? 0) >= minLevel;
}

/**
 * Project a role's navigation against the user's effective capabilities.
 * Returns the same items when: no projection rules exist for the role, no
 * effective matrix is available (fail-open on visibility — the server remains
 * authoritative), or the node has no capability requirement.
 */
export function projectNavForCapabilities(navItems, effective, role) {
  if (!effective) return navItems;
  const rules = ROLE_NAV_PROJECTION[role];
  if (!rules) return navItems;
  const req = NAV_CAPABILITY_REQUIREMENTS;
  const passes = (node) => {
    if (!req[node.id]) return true; // role-mask driven — never filtered
    return hasCapability(effective, req[node.id].module, req[node.id].capability);
  };

  const filterNode = (node) => {
    if (node.subItems && node.subItems.length > 0) {
      const kids = node.subItems.map(filterNode).filter(Boolean);
      if (kids.length > 0) return { ...node, subItems: kids };
      // Empty section: keep only when the section itself passes its requirement.
      return passes(node) ? node : null;
    }
    if ((rules.hide || []).includes(node.id) && !passes(node)) return null;
    return node;
  };

  const filtered = (navItems || []).map(filterNode).filter(Boolean);

  // Add sections the user now has the capability for, as leaf links to the
  // section's primary page (e.g. CRM for a Staff member granted contacts.view).
  const extras = (rules.show || [])
    .filter((id) => req[id] && hasCapability(effective, req[id].module, req[id].capability))
    .map((id) => {
      const node = NAV_NODE_INDEX[id];
      if (!node) return null;
      return {
        id: node.id,
        name: node.name,
        icon: node.icon,
        href: EXTRA_SECTION_HREFS[id] || node.href,
      };
    })
    .filter(Boolean)
    .filter((n) => !filtered.some((f) => f.id === n.id));

  return [...filtered, ...extras];
}

// ─────────────────────────────────────────────────────────────────────────────
// Node index — id → node. Every node in the master tree is reachable by id,
// so role masks can hoist any node to any position without duplicating it.
// ─────────────────────────────────────────────────────────────────────────────
const NAV_NODE_INDEX = {};
(function indexNodes(items) {
  (items || []).forEach((item) => {
    if (!NAV_NODE_INDEX[item.id]) NAV_NODE_INDEX[item.id] = item;
    if (item.children && item.children.length > 0) indexNodes(item.children);
  });
})(MASTER_NAVIGATION);

function projectNode(node, access, depth) {
  // Only master nodes that are themselves sections can project children.
  const isSectionNode = Array.isArray(node.children) && node.children.length > 0;
  const childIds =
    isSectionNode && access.children ? access.children[node.id] : undefined;
  if (childIds && childIds.length > 0) {
    return {
      id: node.id,
      name: node.name,
      icon: depth === 0 ? (access.icons && access.icons[node.id]) || node.icon : undefined,
      subItems: childIds
        .map((cid) => {
          // Prefer the parent's own child node. This is required because the
          // "security" section and its first child share the id "security":
          // the flat index would resolve that id to the section and recurse
          // forever, while the parent's children array holds the leaf.
          const child =
            (node.children || []).find((c) => c.id === cid) || NAV_NODE_INDEX[cid];
          return child ? projectNode(child, access, depth + 1) : null;
        })
        .filter(Boolean),
    };
  }
  return {
    id: node.id,
    name: node.name,
    icon: depth === 0 ? (access.icons && access.icons[node.id]) || node.icon : undefined,
    href: (access.hrefs && access.hrefs[node.id]) || node.href,
  };
}

/**
 * Project the master navigation for a role.
 * Output shape is identical to the legacy per-role matrices: top-level items
 * with `subItems` (sections) or `href` (leaves). Sections with no visible
 * children collapse to leaves using the role's resolved href.
 */
export function buildRoleNav(role) {
  const access = ROLE_ACCESS[role] || ROLE_ACCESS.admin;
  return (access.top || [])
    .map((id) => {
      const node = NAV_NODE_INDEX[id];
      return node ? projectNode(node, access, 0) : null;
    })
    .filter(Boolean);
}
