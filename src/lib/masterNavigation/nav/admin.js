/**
 * Master navigation — the ADMIN sections.
 *
 * The Super Admin's view is the canonical expression of the tree: every
 * concept has exactly one definition here, and the other roles point at it
 * through the role access table (see ../access.js). It ends with the admin-owned
 * top-level surfaces that are hoisted for other roles too.
 */

import { standupNode, retroNode, myProjectsNode } from "./shared";

export const ADMIN_NODES = [
  { id: "dashboard", name: "DASHBOARD", icon: "layoutDashboard", href: "/admin" },

  // CRM — people data and the records layer (communication is its own section)
  {
    id: "crm",
    name: "CRM",
    icon: "users",
    children: [
      { id: "crm_dashboard", name: "DASHBOARD", icon: "users", href: "/staff/crm" },
      { id: "all_contacts", name: "PEOPLE", href: "/staff/crm/contacts" },
      { id: "crm_organizations", name: "ORGANIZATIONS", icon: "building", href: "/staff/crm/organizations" },
      { id: "crm_leads", name: "LEADS", icon: "target", href: "/staff/crm/leads" },
      { id: "crm_opportunities", name: "OPPORTUNITIES", icon: "trendingUp", href: "/staff/crm/opportunities" },
      { id: "crm_pipelines", name: "PIPELINES", icon: "gitBranch", href: "/staff/crm/pipelines" },
      { id: "crm_activities", name: "ACTIVITIES", icon: "activity", href: "/staff/crm/activities" },
      { id: "crm_segments", name: "SEGMENTS", icon: "filter", href: "/staff/crm/segments" },
      { id: "crm_automations", name: "AUTOMATIONS", icon: "zap", href: "/staff/crm/automations" },
      { id: "crm_timeline", name: "TIMELINE", href: "/staff/crm/timeline" },
      { id: "crm_membership", name: "MEMBERSHIP", href: "/staff/crm/membership" },
      { id: "crm_duplicates", name: "DUPLICATES", href: "/staff/crm/duplicates" },
      { id: "pending_users", name: "PENDING APPROVALS", href: "/admin/security/pending-users" },
      { id: "bulk_upload", name: "BULK IMPORT", href: "/admin/crm/bulk-upload" },
    ],
  },

  // Communication — messaging, announcements, forms
  {
    id: "communication",
    name: "COMMUNICATION",
    icon: "messageSquare",
    children: [
      { id: "messages", name: "MESSAGES", icon: "send", href: "/admin/communication/messages" },
      { id: "announcements", name: "ANNOUNCEMENTS", href: "/admin/communication/announcements" },
      // The Forms workspace unfolds in the main sidebar: its screens render in
      // the same shell instead of a second one. Each child mirrors a module of
      // the forms registry.
      {
        id: "forms",
        name: "FORMS",
        icon: "fileText",
        href: "/admin/communication/forms",
        children: [
          { id: "forms_dashboard", name: "DASHBOARD", href: "/admin/communication/forms" },
          { id: "forms_list", name: "FORMS", href: "/admin/communication/forms/list" },
          { id: "forms_runs", name: "RUNS", href: "/admin/communication/forms/runs" },
          { id: "forms_import", name: "HISTORICAL IMPORT", href: "/admin/communication/forms/import" },
          { id: "forms_identity_review", name: "IDENTITY REVIEW", href: "/admin/communication/forms/import/review" },
          { id: "forms_scores", name: "SCORES", href: "/admin/communication/forms/scores" },
        ],
      },
      { id: "groups", name: "GROUPS", href: "/staff/program-manager/communications/contacts" },
    ],
  },

  {
    id: "programs",
    name: "PROGRAMS",
    icon: "briefcase",
    children: [
      { id: "all_programs", name: "ALL PROGRAMS", href: "/admin/programs" },
      { id: "create_program", name: "CREATE PROGRAM", href: "/admin/programs/new" },
      { id: "progress", name: "PROGRESS", href: "/admin/programs/progress" },
    ],
  },

  {
    id: "ventures",
    name: "VENTURES",
    icon: "rocket",
    children: [
      { id: "all_ventures", name: "ALL VENTURES", href: "/admin/ventures" },
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
      { id: "investors_portfolio", name: "STUDIO PORTFOLIO", href: "/admin/investors/portfolio" },
      { id: "investors_deal_flow", name: "DEAL FLOW", href: "/admin/investors/deal-flow" },
      { id: "investors_introductions", name: "INTRODUCTIONS", href: "/admin/investors/introductions" },
      { id: "investors_metrics", name: "METRICS", href: "/admin/investors/metrics" },
    ],
  },

  { id: "finance", name: "FINANCE", icon: "barChart3", href: "/admin/finance" },

  {
    id: "operations",
    name: "OPERATIONS",
    icon: "listTodo",
    children: [
      { id: "internal_ops_board", name: "OPS BOARD", href: "/admin/operations/board" },
      { id: "all_projects", name: "PROJECTS", href: "/admin/operations/projects" },
      { id: "create_project", name: "CREATE PROJECT", href: "/admin/operations/projects?action=create" },
      { id: "tasks", name: "TASKS", href: "/admin/operations/tasks" },
      { id: "blockers", name: "BLOCKERS", href: "/admin/operations/blockers" },
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
      { id: "internal_reports", name: "OP REPORTS", href: "/admin/reports/op-reports" },
      { id: "metrics", name: "PROGRAM HEALTH", href: "/admin/reports/metrics" },
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

  // System configuration — settings, plus security & compliance: the security
  // pages (security overview, audit logs, user access, permissions) live UNDER
  // Settings rather than as a section of their own.
  {
    id: "settings",
    name: "SETTINGS",
    icon: "wrench",
    children: [
      { id: "system", name: "SYSTEM MONITORING", href: "/admin/settings/system" },
      { id: "security", name: "SECURITY", href: "/admin/security" },
      { id: "audit_logs", name: "AUDIT LOGS", href: "/admin/security/audit-logs" },
      { id: "access_summary", name: "USER ACCESS", href: "/admin/security/access" },
      { id: "permissions", name: "PERMISSIONS", href: "/admin/security/permissions" },
    ],
  },

  // Additional top-level surfaces owned by other roles (kept in the master
  // tree so every concept has exactly one definition).
  { id: "projects", name: "PROJECTS", icon: "rocket", href: "/admin/operations/projects" },
];
