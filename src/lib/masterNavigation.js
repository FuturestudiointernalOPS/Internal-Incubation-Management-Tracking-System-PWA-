/**
 * ImpactOS — Sidebar navigation (single source of truth)
 *
 * ONE logic for the sidebar:
 *
 *   1. Le rôle de l'utilisateur détermine son point d'entrée (Dashboard).
 *   2. Ses responsabilités déterminent les features affichées.
 *   3. Chaque feature = un item de premier niveau + ses sous-sections.
 *
 * Il n'y a ni arbre maître ni matrice par rôle à croiser : une responsabilité
 * possède exactement UNE feature. Une feature n'apparaît que si l'utilisateur
 * détient sa responsabilité — sauf pour les rôles privilégiés (super_admin,
 * developer) qui voient toutes les features.
 *
 * Les rôles sans responsabilité (participant, facilitator, investor, …)
 * n'affichent pour l'instant que leur Dashboard : ils seront branchés plus
 * tard sur le même filtre.
 *
 * Icons are stored as string names (keeps this module test-friendly); the
 * sidebar resolves them to components (see NAV_ICONS in DashboardLayout).
 */

import { roleHomeHref } from "@/lib/platform/roles";

/** Rôles qui voient toutes les features sans devoir les détenir. */
export const SUPERUSER_ROLES = ["super_admin", "developer"];

/**
 * Pages personnelles stables d'un rôle — affichées après son Dashboard.
 * Elles ne sont PAS pilotées par une responsabilité : chaque rôle possède
 * les siennes, au même titre qu'une feature possède ses sous-sections.
 * Un item dont l'id coincide avec une feature détenue est ignoré (la
 * feature gagne) pour ne jamais dupliquer une entrée de la sidebar.
 *
 * Rôles absents ici (member, finance, mentor, …) n'ont que leur Dashboard.
 */
export const ROLE_PERSONAL_NAV = {
  participant: [
    { id: "learning", name: "MY LEARNING", icon: "graduationCap", href: "/participant/learning" },
    { id: "programs", name: "MY PROGRAMS", icon: "briefcase", href: "/participant/dashboard" },
    { id: "certificates", name: "MY CERTIFICATES", icon: "fileText", href: "/participant/certificates" },
    { id: "ventures", name: "MY VENTURES", icon: "rocket", href: "/participant/ventures" },
  ],
  facilitator: [
    { id: "my_programs", name: "MY PROGRAMS", icon: "briefcase", href: "/facilitator/programs" },
    { id: "reviews", name: "MY REVIEWS", icon: "clipboardList", href: "/facilitator/reviews" },
  ],
  founder: [
    { id: "programs", name: "MY PROGRAMS", icon: "briefcase", href: "/participant/dashboard" },
    { id: "ventures", name: "MY VENTURES", icon: "rocket", href: "/participant/ventures" },
  ],
  investor: [
    { id: "pipeline", name: "PIPELINE", icon: "barChart3", href: "/investor/pipeline" },
    { id: "portfolio", name: "PORTFOLIO", icon: "trendingUp", href: "/investor/portfolio" },
    { id: "activity", name: "ACTIVITY", icon: "clock", href: "/investor/history" },
  ],
  teacher: [
    {
      id: "communication",
      name: "COMMUNICATION",
      icon: "messageSquare",
      children: [
        { id: "groups", name: "GROUPS", icon: "users", href: "/pm/communications/contacts" },
      ],
    },
    {
      id: "programs",
      name: "PROGRAMS",
      icon: "briefcase",
      children: [
        { id: "all_programs", name: "ALL PROGRAMS", href: "/pm/programs" },
      ],
    },
  ],
  team: [
    { id: "programs", name: "MY PROGRAMS", icon: "briefcase", href: "/team" },
  ],
  crm: [
    { id: "crm_dashboard", name: "CRM DASHBOARD", icon: "users", href: "/crm" },
    { id: "forms", name: "FORMS", icon: "fileText", href: "/platform" },
  ],
};

/**
 * Dashboard home pour les rôles hors table ROLE_HOME (identités d'entité /
 * d'espace qui ont quand même une page d'accueil dédiée).
 */
const ROLE_HOME_FALLBACKS = {
  team: "/team",
  crm: "/crm",
  founder: "/participant",
  member: "/workspaces",
};

/** Ordre canonique d'affichage des features dans la sidebar. */
export const RESPONSIBILITY_ORDER = [
  "crm",
  "communication",
  "program_management",
  "project_ownership",
  "tasks",
  "operations",
  "reporting",
  "finance",
  "knowledge_base",
  "intelligence",
  "engineering",
  "user_management",
  "system_settings",
  "lms",
  "ventures",
  "investor",
];

/**
 * Responsabilité → feature de la sidebar.
 *
 * Une feature est soit une feuille (`href`), soit une section avec
 * `children` (ses sous-sections). `adminHref` (facultatif) est la variante
 * /admin/* utilisée par les rôles privilégiés lorsque la feuille a une
 * version déléguée ailleurs (ex. Finance → /finance pour un staff).
 */
export const RESPONSIBILITY_NAV = {
  crm: {
    id: "crm",
    name: "CRM",
    icon: "users",
    children: [
      { id: "crm_dashboard", name: "DASHBOARD", icon: "users", href: "/admin/crm" },
      { id: "all_contacts", name: "PEOPLE", href: "/admin/communications/contacts" },
      { id: "crm_membership", name: "MEMBERSHIP", href: "/admin/crm/membership" },
      { id: "crm_timeline", name: "TIMELINE", href: "/admin/crm/timeline" },
      { id: "crm_duplicates", name: "DUPLICATES", href: "/admin/crm/duplicates" },
    ],
  },

  communication: {
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

  program_management: {
    id: "programs",
    name: "PROGRAMS",
    icon: "briefcase",
    children: [
      { id: "all_programs", name: "ALL PROGRAMS", href: "/admin/programs" },
      { id: "create_program", name: "CREATE PROGRAM", href: "/admin/programs/new" },
      { id: "progress", name: "PROGRESS", href: "/admin/progress" },
    ],
  },

  project_ownership: {
    id: "projects",
    name: "PROJECTS",
    icon: "rocket",
    children: [
      { id: "all_projects", name: "ALL PROJECTS", href: "/admin/projects" },
      { id: "create_project", name: "CREATE PROJECT", href: "/admin/projects?action=create" },
      { id: "my_projects", name: "MY PROJECTS", icon: "briefcase", href: "/staff/projects" },
    ],
  },

  tasks: {
    id: "tasks",
    name: "TASKS",
    icon: "checkSquare",
    children: [
      { id: "tasks", name: "TASKS", href: "/admin/tasks" },
      { id: "blockers", name: "BLOCKERS", href: "/admin/blockers" },
      { id: "my_tasks", name: "MY TASKS", href: "/developer/my-tasks" },
    ],
  },

  operations: {
    id: "operations",
    name: "OPERATIONS",
    icon: "listTodo",
    children: [
      { id: "internal_ops_board", name: "OPS BOARD", href: "/admin/work" },
      { id: "weekly_ops", name: "WEEKLY OPS", icon: "calendar", href: "/staff/op-report" },
      { id: "standup", name: "STAND-UP", href: "/staff/op-report?tab=standup" },
      { id: "retro", name: "RETRO", href: "/staff/op-report?tab=retro" },
    ],
  },

  reporting: {
    id: "reports",
    name: "REPORTS",
    icon: "fileText",
    children: [
      { id: "program_reports", name: "PROGRAM REPORTS", href: "/admin/reports/responses" },
      { id: "internal_reports", name: "OP REPORTS", href: "/admin/op-reports" },
      { id: "metrics", name: "PROGRAM HEALTH", href: "/admin/metrics" },
    ],
  },

  finance: {
    id: "finance",
    name: "FINANCE",
    icon: "barChart3",
    href: "/finance",
    adminHref: "/admin/finance",
  },

  knowledge_base: {
    id: "knowledge",
    name: "KNOWLEDGE",
    icon: "library",
    children: [{ id: "knowledge_base", name: "KNOWLEDGE BASE", href: "/admin/knowledge" }],
  },

  intelligence: {
    id: "intelligence",
    name: "INTELLIGENCE",
    icon: "trendingUp",
    href: "/admin/intelligence",
  },

  engineering: {
    id: "engineering",
    name: "ENGINEERING",
    icon: "wrench",
    href: "/admin/engineering",
  },

  user_management: {
    id: "user_management",
    name: "USER MANAGEMENT",
    icon: "users",
    children: [
      { id: "pending_users", name: "PENDING APPROVALS", href: "/admin/pending-users" },
      { id: "bulk_upload", name: "BULK IMPORT", href: "/admin/bulk-upload" },
      { id: "access_summary", name: "USER ACCESS", href: "/admin/access" },
      { id: "permissions", name: "PERMISSIONS", href: "/admin/security/permissions" },
    ],
  },

  system_settings: {
    id: "settings",
    name: "SETTINGS",
    icon: "wrench",
    children: [
      { id: "security", name: "SECURITY", href: "/admin/security" },
      { id: "audit_logs", name: "AUDIT LOGS", href: "/admin/audit-logs" },
      { id: "integrations", name: "INTEGRATIONS", href: "/admin/integrations" },
      { id: "engineering_dashboard", name: "ENGINEERING", href: "/admin/engineering" },
      { id: "system", name: "SYSTEM MONITORING", href: "/admin/system" },
    ],
  },

  lms: {
    id: "lms",
    name: "LMS",
    icon: "graduationCap",
    children: [{ id: "lms_courses", name: "COURSES", href: "/admin/lms/courses" }],
  },

  ventures: {
    id: "ventures",
    name: "VENTURES",
    icon: "rocket",
    children: [
      { id: "all_ventures", name: "ALL VENTURES", href: "/admin/ventures" },
      { id: "register_venture", name: "REGISTER STARTUP", href: "/admin/ventures/register" },
    ],
  },

  investor: {
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
};

/**
 * All features as a flat list, in canonical order — the union of every page
 * the sidebar can show. Used by pages that need "feature → its pages"
 * (e.g. the Permission Manager's subsection tables).
 */
export const SIDEBAR_FEATURES = RESPONSIBILITY_ORDER.map(
  (key) => RESPONSIBILITY_NAV[key],
);

/**
 * THE single sidebar builder.
 *
 * @param {object} opts
 * @param {string} opts.role            Rôle effectif (session ou contexte page).
 * @param {Array}  [opts.responsibilities] Responsabilités détenues (objets
 *   `{ key }` ou chaînes).
 * @returns {Array} Items de premier niveau prêts à être rendus
 *   ({ id, name, icon, href | children }).
 */
export function buildSidebarNav({ role, responsibilities = [] } = {}) {
  const superuser = SUPERUSER_ROLES.includes(String(role || "").toLowerCase());
  const held = new Set(
    responsibilities
      .map((r) => (typeof r === "string" ? r : r && r.key))
      .filter(Boolean)
      .map((k) => String(k).toLowerCase()),
  );

  const items = [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: "layoutDashboard",
      href: roleHomeHref(role) || ROLE_HOME_FALLBACKS[role] || "/workspaces",
    },
  ];
  const seenIds = new Set(items.map((i) => i.id));
  const push = (item) => {
    if (!item || seenIds.has(item.id)) return;
    seenIds.add(item.id);
    items.push(item);
  };

  // 1. Pages personnelles du rôle (non pilotées par une responsabilité).
  for (const entry of ROLE_PERSONAL_NAV[role] || []) push(entry);

  // 2. Features des responsabilités détenues (ou toutes, pour superuser).
  for (const key of RESPONSIBILITY_ORDER) {
    if (!superuser && !held.has(key)) continue;
    const feature = RESPONSIBILITY_NAV[key];
    if (!feature) continue;
    const href = superuser && feature.adminHref ? feature.adminHref : feature.href;
    push(href ? { ...feature, href } : feature);
  }
  return items;
}

/**
 * The responsibility required to OPEN an /admin page (longest /admin href
 * prefix match across every feature/subsections). Returns null when the path
 * is not covered → super_admin/developer only. Shared with the /admin layout
 * guard so the sidebar and the guard can never drift.
 */
export function responsibilityRequiredForPath(pathname) {
  if (!pathname) return null;
  let best = null;
  let bestLen = -1;
  const pages = [];
  for (const key of RESPONSIBILITY_ORDER) {
    const feature = RESPONSIBILITY_NAV[key];
    if (!feature) continue;
    if (feature.href) pages.push([feature.href, key]);
    if (feature.adminHref) pages.push([feature.adminHref, key]);
    for (const child of feature.children || []) {
      if (child.href) pages.push([child.href, key]);
    }
  }
  for (const [href, key] of pages) {
    if (String(href).startsWith("/admin") && pathname.startsWith(href) && href.length > bestLen) {
      best = key;
      bestLen = href.length;
    }
  }
  return best;
}
