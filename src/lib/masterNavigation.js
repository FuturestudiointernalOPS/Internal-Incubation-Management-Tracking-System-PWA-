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
 *   (breadcrumbs), buildAccessNav (access), badges, active-route
 *   detection and the permission system. Never rename an id.
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
      { id: "journey_reports", name: "JOURNEY REPORTS", href: "/admin/journey-reports" },
      { id: "register_venture", name: "REGISTER STARTUP", href: "/admin/ventures/register" },
      { id: "document_types", name: "DATA BANK DOCUMENTS", href: "/admin/ventures/document-types" },
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

  { id: "intelligence", name: "INTELLIGENCE", icon: "trendingUp", href: "/admin/intelligence" },

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
    ],
  },

  // LMS — course authoring & learning library (admin)
  {
    id: "lms",
    name: "LMS",
    icon: "graduationCap",
    children: [
      { id: "lms_courses", name: "COURSES", href: "/admin/lms/courses" },
      { id: "lms_registrations", name: "REGISTRATIONS", href: "/admin/lms/registrations" },
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
  { id: "learning", name: "MY LEARNING", icon: "graduationCap", href: "/participant/learning" },
  { id: "certificates", name: "MY CERTIFICATES", icon: "fileText", href: "/participant/certificates" },
  { id: "timeline", name: "MY TIMELINE", icon: "clock", href: "/participant/profile#timeline" },
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
      "finance", "operations", "intelligence", "reports", "knowledge", "lms", "security", "settings",
    ],
    children: {
      crm: ["crm_dashboard", "all_contacts", "crm_membership", "crm_timeline", "crm_duplicates", "pending_users", "bulk_upload"],
      communication: ["messages", "announcements", "forms"],
      programs: ["all_programs", "create_program", "progress"],
      ventures: ["all_ventures", "journey_reports", "document_types"],
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
      lms_courses: "/pm/lms/courses",
    },
    icons: {},
  },

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

  facilitator: {
    top: ["dashboard", "my_programs", "reviews", "profile"],
    children: {},
    hrefs: { dashboard: "/facilitator" },
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
    top: ["dashboard", "portfolio", "activity", "profile"],
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

// Fallback access for a role absent from ROLE_ACCESS (an unknown/legacy
// identity). It is NOT a role: it only gives such an identity three neutral
// doors, and the server-side gate remains authoritative.
const FALLBACK_ACCESS = {
  top: ["dashboard", "projects", "reports"],
  children: {},
  hrefs: { reports: "/admin/reports" },
  icons: { reports: "barChart3" },
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

/** Pure capability check against an effective matrix. */
export function hasCapability(effective, module, capability, minLevel = 1) {
  return Number(effective?.[module]?.[capability] ?? 0) >= minLevel;
}

/** Project one master section for a role (role child list + href/icon overrides). */
function projectMasterSection(node, access) {
  // Child list precedence: the role's own list, then Super Admin's canonical
  // expression of the master tree (which omits role-specific extras such as
  // `groups`), then the raw master children.
  const childIds =
    (access.children && access.children[node.id]) ||
    ROLE_ACCESS.super_admin.children[node.id] ||
    (node.children || []).map((child) => child.id);
  return {
    id: node.id,
    name: node.name,
    icon: (access.icons && access.icons[node.id]) || node.icon,
    subItems: childIds
      .map(
        (id) =>
          (node.children || []).find((child) => child.id === id) ||
          NAV_NODE_INDEX[id],
      )
      .filter(Boolean)
      .map((child) => ({
        id: child.id,
        name: child.name,
        icon: child.icon,
        href: (access.hrefs && access.hrefs[child.id]) || child.href,
      })),
  };
}

/**
 * The single source of sidebar truth: a role's navigation projected against the
 * user's effective capabilities.
 *
 *   base   = buildRoleNav(role) — the role's own doors (hrefs already resolved)
 *   grants = master sections the role matrix omits but the capabilities grant
 *
 * One pass then:
 *   - drops every node whose NAV_CAPABILITY_REQUIREMENTS entry is not met;
 *   - resolves non-admin hrefs through the role's scoped href or
 *     NON_ADMIN_HREF_FALLBACKS, and DROPS the node when neither exists
 *     (no dead links, and no leak from another role's flat menu);
 *   - drops a section left without children;
 *   - renders every id at most once (first occurrence wins).
 *
 * `effective === null` (capabilities not loaded yet) fails OPEN on visibility —
 * the server stays authoritative — but never on hrefs.
 */
export function buildAccessNav(role, effective) {
  const access = ROLE_ACCESS[role] || FALLBACK_ACCESS;
  const canOpenAdmin = role === "super_admin";
  const roleHrefs = access.hrefs || {};

  const passes = (id) => {
    const req = NAV_CAPABILITY_REQUIREMENTS[id];
    if (!req || !effective) return true;
    return hasCapability(effective, req.module, req.capability);
  };

  const resolveHref = (id, href) => {
    if (canOpenAdmin || !href) return href;
    if (roleHrefs[id]) return roleHrefs[id];
    const fallback = NON_ADMIN_HREF_FALLBACKS[id];
    if (fallback) return fallback;
    return href.startsWith("/admin") ? null : href;
  };

  const base = buildRoleNav(role);
  const present = new Set();
  const collect = (items) =>
    (items || []).forEach((item) => {
      present.add(item.id);
      collect(item.subItems);
    });
  collect(base);

  // Top-level nodes that carry a requirement can be ADDED by a capability when
  // the role matrix omits them (sections get their canonical children, leaves
  // such as `finance` are added as a single link). Grants require an effective
  // matrix: while it is still loading we show the role's own doors, never guess.
  const grants = !effective
    ? []
    : MASTER_NAVIGATION.filter(
        (node) =>
          NAV_CAPABILITY_REQUIREMENTS[node.id] &&
          !present.has(node.id) &&
          passes(node.id),
      ).map((node) =>
        Array.isArray(node.children) && node.children.length > 0
          ? projectMasterSection(node, access)
          : {
              id: node.id,
              name: node.name,
              icon: (access.icons && access.icons[node.id]) || node.icon,
              href: (access.hrefs && access.hrefs[node.id]) || node.href,
            },
      );

  // Capability gate. A role's OWN doors keep their hrefs (a role matrix may
  // legitimately point at /admin); only GRANTED nodes get href surgery, because
  // they come from another role's world and must not become dead links.
  const gate = (items, dropUnreachable) =>
    (items || [])
      .map((item) => {
        if (!passes(item.id)) return null;
        if (item.subItems && item.subItems.length > 0) {
          const kids = gate(item.subItems, dropUnreachable).filter(Boolean);
          return kids.length > 0 ? { ...item, subItems: kids } : null;
        }
        const href = dropUnreachable
          ? resolveHref(item.id, item.href)
          : item.href;
        return href ? { ...item, href } : null;
      })
      .filter(Boolean);

  const seen = new Set();
  const dedupe = (items) =>
    (items || [])
      .map((item) => {
        if (seen.has(item.id)) return null;
        if (item.subItems) {
          const kids = dedupe(item.subItems).filter(Boolean);
          if (kids.length === 0) return null;
          seen.add(item.id);
          return { ...item, subItems: kids };
        }
        seen.add(item.id);
        return item;
      })
      .filter(Boolean);

  return dedupe([...gate(base, false), ...gate(grants, true)]);
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
            (node.children || []).find((candidate) => candidate.id === cid) || NAV_NODE_INDEX[cid];
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
  const access = ROLE_ACCESS[role] || FALLBACK_ACCESS;
  return (access.top || [])
    .map((id) => {
      const node = NAV_NODE_INDEX[id];
      return node ? projectNode(node, access, 0) : null;
    })
    .filter(Boolean);
}
