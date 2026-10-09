/**
 * ImpactOS — Master Navigation: node tables.
 *
 * The single canonical navigation TREE. Nodes are defined exactly once,
 * identified by their stable `id`; route differences between roles are a
 * routing concern (see ./access.js), never a duplicated node.
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
      // The operational view of the same work the Journey screen structures:
      // every milestone, activity and deliverable, with owner, support and dates.
      // Named PROJECT MANAGEMENT rather than PROJECTS so it cannot be mistaken
      // for the platform's separate top-level PROJECTS section (Future Studio's
      // own internal projects, which is a different table and a different idea).
      { id: "venture_projects", name: "PROJECT MANAGEMENT", href: "/admin/ventures/projects" },
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
