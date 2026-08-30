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

  // Communication — messaging, announcements, forms
  {
    id: "communication",
    name: "COMMUNICATION",
    icon: "messageSquare",
    children: [
      { id: "messages", name: "MESSAGES", icon: "send", href: "/admin/internal-comms" },
      { id: "announcements", name: "ANNOUNCEMENTS", href: "/admin/announcements" },
      { id: "forms", name: "FORMS", icon: "fileText", href: "/platform" },
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
      "finance", "operations", "reports", "knowledge", "security", "settings",
    ],
    children: {
      crm: ["crm_dashboard", "all_contacts", "crm_membership", "crm_timeline", "crm_duplicates", "pending_users", "bulk_upload"],
      communication: ["messages", "announcements", "forms"],
      programs: ["all_programs", "create_program", "progress"],
      ventures: ["all_ventures", "register_venture"],
      investors: ["investors_manage", "investors_dashboard", "investors_review", "investors_overview", "investors_campaigns", "investors_relationships"],
      operations: ["internal_ops_board", "all_projects", "create_project", "tasks", "blockers", "standup", "retro"],
      reports: ["program_reports", "internal_reports", "metrics"],
      knowledge: ["knowledge_base", "intelligence"],
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
    top: ["dashboard", "weekly_ops", "programs", "my_projects", "messages"],
    children: {},
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
    top: ["dashboard", "my_tasks", "assigned_tasks", "rituals", "projects", "notifications", "messages"],
    children: { rituals: ["standup", "retro"] },
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
    top: ["dashboard", "programs", "certificates"],
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
    top: ["crm_dashboard", "forms"],
    children: {},
    hrefs: { crm_dashboard: "/crm" },
    icons: {},
  },
};

export const NAV_ROLE_KEYS = Object.keys(ROLE_ACCESS);

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
