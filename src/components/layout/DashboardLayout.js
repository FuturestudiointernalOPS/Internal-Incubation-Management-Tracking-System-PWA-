"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Users,
  LayoutDashboard,
  Briefcase,
  Calendar,
  User,
  MessageSquare,
  Settings,
  LogOut,
  Bell,
  Search,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  FileText,
  ShieldCheck,
  Activity,
  Menu,
  X,
  Zap,
  Rocket,
  Trash2,
  Send,
  Library,
  Globe,
  BarChart3,
  UserCheck,
  UploadCloud,
  ListTodo,
  ClipboardList,
  Wrench,
  CheckSquare,
  Megaphone,
  HeartPulse,
  Blocks,
  Clock,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import GlobalToast from "@/components/ui/GlobalToast";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";

// Map legacy sidebar keys to new namespaced i18n keys
const NAV_KEY_MAP = {
  dashboard: "navigation.dashboard",
  programs: "navigation.programs",
  all_programs: "navigation.allPrograms",
  create_program: "navigation.createProgram",
  create_project: "navigation.createProject",
  progress_hub: "navigation.progress",
  progress: "navigation.progress",
  internal_ops: "navigation.internalOps",
  internal_ops_board: "navigation.internalOpsBoard",
  messages: "navigation.messages",
  communication: "navigation.communication",

  forms: "navigation.forms",
  all_contacts: "navigation.contacts",
  knowledge: "navigation.knowledgeBase",
  knowledge_base: "navigation.knowledgeBase",
  intelligence: "navigation.intelligence",
  reports: "navigation.reports",
  report_responses: "navigation.reportResponses",
  internal_reports: "navigation.internalReports",
  settings: "navigation.settings",
  profile: "navigation.profile",
  logout: "navigation.logout",
  projects: "navigation.projects",
  all_projects: "navigation.allProjects",
  my_projects: "navigation.myProjects",
  my_tasks: "navigation.myTasks",
  assigned_tasks: "navigation.assignedTasks",
  sessions: "navigation.sessions",
  reviews: "navigation.reviews",
  assignments: "navigation.assignments",
  rituals: "navigation.rituals",
  tasks: "reports.tasks",
  blockers: "reports.blockers",
  no_new_intel: "navigation.noNewIntel",
  intel_feed: "navigation.intelFeed",
  announcements: "navigation.announcements",
  followups: "navigation.followups",
  notifications: "navigation.notifications",
  timeline: "navigation.timeline",
  certificates: "navigation.certificates",
  activity: "navigation.activity",
  pipeline: "navigation.pipeline",
  portfolio: "navigation.portfolio",
  watchlist: "navigation.watchlist",
  ventures: "navigation.ventures",
  all_ventures: "navigation.allVentures",
  register_venture: "navigation.registerVenture",
  investors: "navigation.investors",
  investors_manage: "navigation.investorsManage",
  investors_dashboard: "navigation.investorsDashboard",
  investors_review: "navigation.investorsReview",
  investors_overview: "navigation.investorsOverview",
  investors_campaigns: "navigation.investorsCampaigns",
  investors_relationships: "navigation.investorsRelationships",
  operations: "navigation.operations",
  standup: "navigation.standup",
  retro: "navigation.retro",
  standups_retros: "navigation.standupsRetros",
  weekly_ops: "navigation.weeklyOps",
  finance: "navigation.finance",
  metrics: "navigation.metrics",
  program_reports: "navigation.programReports",
  audit_logs: "navigation.auditLogs",
  security: "navigation.security",
  integrations: "navigation.integrations",
  access_summary: "navigation.accessSummary",
  permissions: "navigation.permissions",
  engineering_dashboard: "navigation.engineering",
  system: "navigation.system",
  personnel: "navigation.personnel",
  logs: "navigation.logs",
  groups: "navigation.groups",
  crm: "navigation.crm",
  crm_dashboard: "navigation.crmDashboard",
  crm_timeline: "navigation.crmTimeline",
  crm_duplicates: "navigation.crmDuplicates",
  pending_users: "navigation.pendingUsers",
  bulk_upload: "navigation.bulkUpload",
};

function tnav(key) {
  const mapped = NAV_KEY_MAP[key];
  if (mapped) return mapped;
  return key;
}

// Map last path segment -> translation key for the topbar breadcrumb
const CRUMB_PATH_MAP = {
  admin: "navigation.dashboard",
  crm: "navigation.crm",
  timeline: "navigation.crmTimeline",
  duplicates: "navigation.crmDuplicates",
  contacts: "navigation.contacts",
  communications: "navigation.communication",
  pending_users: "navigation.pendingUsers",
  "pending-users": "navigation.pendingUsers",
  bulk_upload: "navigation.bulkUpload",
  "bulk-upload": "navigation.bulkUpload",
  forms: "navigation.forms",
  announcements: "navigation.announcements",
  programs: "navigation.programs",
  progress: "navigation.progress",
  responses: "navigation.reportResponses",
  ventures: "navigation.ventures",
  investors: "navigation.investors",
  campaigns: "navigation.investorsCampaigns",
  relationships: "navigation.investorsRelationships",
  review: "navigation.investorsReview",
  overview: "navigation.investorsOverview",
  dashboard: "navigation.dashboard",
  work: "navigation.internalOpsBoard",
  projects: "navigation.projects",
  tasks: "navigation.tasks",
  blockers: "navigation.blockers",
  standup: "navigation.standup",
  retro: "navigation.retro",
  knowledge: "navigation.knowledgeBase",
  intelligence: "navigation.intelligence",
  finance: "navigation.finance",
  reports: "navigation.reports",
  metrics: "navigation.metrics",
  settings: "navigation.settings",
  security: "navigation.security",
  integrations: "navigation.integrations",
  access: "navigation.accessSummary",
  permissions: "navigation.permissions",
  engineering: "navigation.engineering",
  system: "navigation.system",
  profile: "navigation.profile",
  messages: "navigation.messages",
  notifications: "navigation.notifications",
  sessions: "navigation.sessions",
  reviews: "navigation.reviews",
  assignments: "navigation.assignments",
  rituals: "navigation.rituals",
  followups: "navigation.followups",
  certificates: "navigation.certificates",
  portfolio: "navigation.portfolio",
  pipeline: "navigation.pipeline",
  history: "navigation.activity",
  teams: "navigation.manageTeams",
  submit: "navigation.forms",
  runs: "navigation.forms",
  collections: "navigation.collections",
  modules: "navigation.modules",
  responses: "navigation.forms",
  groups: "navigation.groups",
  submissions: "navigation.submissions",
};

function navCrumb(pathname) {
  const seg = (pathname || "").split("/").filter(Boolean).pop() || "";
  return CRUMB_PATH_MAP[seg] || (NAV_KEY_MAP[seg] ? NAV_KEY_MAP[seg] : seg);
}

/**
 * IMPACTOS OPERATIONAL CONTROL ÔÇö GLOBAL LAYOUT
 * Simplified, high-performance frame with i18n and theme support.
 */

const SidebarContent = ({
  collapsed,
  role,
  user,
  navItems,
  openMenus,
  toggleMenu,
  pathname,
  setMobileMenuOpen,
  handleLogout,
  t,
  submissionCount,
  unreadByType,
  hasCommunicationActivity,
}) => {
  const { switchLang } = useI18n();
  const profileHref = `/${role === "super_admin" ? "admin" : role === "program_manager" ? "pm" : role === "teacher" ? "teacher" : role === "developer" || role === "intern" ? "developer" : role === "investor" ? "investor" : "participant"}/profile`;
  return (
    <>
      <div className="flex items-center gap-4 px-3 mb-14 mt-4">
        {collapsed ? (
          <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <img
              src="/brand/icon_orange.png"
              alt="FS"
              className="w-8 h-8 object-contain"
            />
          </div>
        ) : (
          <img
            src="/brand/logo_full.png"
            alt="Future Studio"
            className="h-8 object-contain animate-in fade-in"
          />
        )}
      </div>

      {!collapsed && (
        <div className="px-3 mb-4">
          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] opacity-40">
            {t("navigation.mainOperations")}
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1">
        {(navItems || []).map((item) => {
          if (item.subItems) {
            const isChildActive = item.subItems.some((sub) =>
              pathname?.startsWith(sub.href),
            );
            const isOpen = openMenus[item.id] || false;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-bold text-[12px] uppercase tracking-wider ${isChildActive ? "text-[var(--text-primary)] bg-tertiary border border-[var(--border-secondary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <item.icon
                        className={`w-4 h-4 flex-shrink-0 ${isChildActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                      />
                      {item.id === "communication" &&
                        hasCommunicationActivity && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />
                        )}
                    </div>
                    {!collapsed && (
                      <span className="truncate">
                        {t(tnav(item.id)) || item.name}
                      </span>
                    )}
                  </div>
                  {!collapsed &&
                    item.id === "programs" &&
                    submissionCount > 0 && (
                      <span className="text-[8px] font-black bg-[var(--brand-orange)] text-black px-1.5 py-0.5 rounded-full mr-2">
                        {submissionCount}
                      </span>
                    )}
                  {!collapsed &&
                    item.id === "communication" &&
                    hasCommunicationActivity && (
                      <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)] shrink-0" />
                    )}
                  {!collapsed && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="pl-8 space-y-1 py-1">
                    {item.subItems.map((subItem) => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.id || subItem.href}
                          href={subItem.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide ${isSubActive ? "text-[var(--brand-orange)] bg-tertiary" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
                        >
                          <span className="truncate">
                            {subItem.id?.startsWith("prog_")
                              ? subItem.name
                              : t(tnav(subItem.id)) || subItem.name}
                          </span>
                          {unreadByType && unreadByType[subItem.id] > 0 && (
                            <span className="ml-auto w-5 h-5 rounded-full bg-[var(--brand-orange)] text-black text-[8px] font-black flex items-center justify-center shrink-0">
                              {unreadByType[subItem.id]}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id || item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-bold text-[12px] uppercase tracking-wider ${isActive ? "bg-tertiary text-[var(--brand-orange)] border border-[var(--border-secondary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
              />
              {!collapsed && (
                <span className="truncate">
                  {t(tnav(item.id)) || item.name}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 border-t border-[var(--border-secondary)] space-y-3">
        {!collapsed && (
          <p className="px-3 mb-2 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-30">
            {t("navigation.userProtocol")}
          </p>
        )}
        <div className="space-y-1">
          <button
            onClick={() => toggleMenu("profile")}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] ${pathname?.includes("profile") ? "bg-tertiary text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
          >
            <div className="flex items-center gap-4">
              <User className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{t(tnav("profile"))}</span>}
            </div>
            {!collapsed && (
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenus["profile"] ? "rotate-180" : ""}`} />
            )}
          </button>
          {openMenus["profile"] && !collapsed && (
            <div className="pl-8 space-y-1 py-1">
              <Link
                href={profileHref}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
              >
                <span className="truncate">{t(tnav("profile"))}</span>
              </Link>
              <Link
                href={`${profileHref}#timeline`}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
              >
                <span className="truncate">{t(tnav("timeline"))}</span>
              </Link>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (typeof window === "undefined") return;
            const current = localStorage.getItem("impactos_lang") || "en";
            switchLang(current === "en" ? "fr" : "en");
          }}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all font-black uppercase tracking-widest text-[10px]"
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>FR/EN</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-black uppercase tracking-widest text-[10px]"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>{t(tnav("logout"))}</span>}
        </button>
      </div>
    </>
  );
};

const NAVIGATION_MATRIX = {
  super_admin: [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: LayoutDashboard,
      href: "/admin",
    },

    {
      id: "crm",
      name: "CRM",
      icon: Users,
      subItems: [
        { id: "crm_dashboard", name: "DASHBOARD", href: "/admin/crm" },
        { id: "all_contacts", name: "PEOPLE", href: "/admin/communications/contacts" },
        { id: "crm_timeline", name: "TIMELINE", href: "/admin/crm/timeline" },
        { id: "crm_duplicates", name: "DUPLICATES", href: "/admin/crm/duplicates" },
        { id: "pending_users", name: "PENDING APPROVALS", href: "/admin/pending-users" },
        { id: "bulk_upload", name: "BULK IMPORT", href: "/admin/bulk-upload" },
        { id: "forms", name: "FORMS", href: "/platform" },
        { id: "messages", name: "MESSAGES", href: "/admin/internal-comms" },
        { id: "announcements", name: "ANNOUNCEMENTS", href: "/admin/announcements" },

      ],
    },

    {
      id: "programs",
      name: "PROGRAMS",
      icon: Briefcase,
      subItems: [
        { id: "all_programs", name: "ALL PROGRAMS", href: "/admin/programs" },
        {
          id: "create_program",
          name: "CREATE PROGRAM",
          href: "/admin/programs/new",
        },
        { id: "progress", name: "PROGRESS", href: "/admin/progress" },
        {
          id: "program_reports",
          name: "PROGRAM REPORTS",
          href: "/admin/reports/responses",
        },
      ],
    },

    {
      id: "ventures",
      name: "VENTURES",
      icon: Rocket,
      subItems: [
        { id: "all_ventures", name: "ALL VENTURES", href: "/admin/ventures" },
        { id: "register_venture", name: "REGISTER STARTUP", href: "/admin/ventures/register" },
      ],
    },

    {
      id: "investors",
      name: "INVESTORS",
      icon: Briefcase,
      subItems: [
        { id: "investors_manage", name: "INVESTOR MANAGEMENT", href: "/admin/investors" },
        { id: "investors_dashboard", name: "DASHBOARD", href: "/admin/investors/dashboard" },
        { id: "investors_review", name: "REVIEW", href: "/admin/investors/review" },
        { id: "investors_overview", name: "OVERVIEW", href: "/admin/investors/overview" },
        { id: "investors_campaigns", name: "CAMPAIGNS", href: "/admin/investors/campaigns" },
        { id: "investors_relationships", name: "RELATIONSHIPS", href: "/admin/investors/relationships" },
      ],
    },

    {
      id: "operations",
      name: "OPERATIONS",
      icon: ListTodo,
      subItems: [
        { id: "internal_ops_board", name: "WORKSPACE", href: "/admin/work" },
        { id: "all_projects", name: "PROJECTS", href: "/admin/projects" },
        { id: "create_project", name: "CREATE PROJECT", href: "/admin/projects?action=create" },
        { id: "tasks", name: "TASKS", href: "/admin/tasks" },
        { id: "blockers", name: "BLOCKERS", href: "/admin/blockers" },
        { id: "standup", name: "STANDUP", href: "/staff/op-report" },
        { id: "retro", name: "RETRO", href: "/staff/op-report" },
      ],
    },

    {
      id: "knowledge",
      name: "KNOWLEDGE",
      icon: Library,
      subItems: [
        { id: "knowledge_base", name: "KNOWLEDGE BASE", href: "/admin/knowledge" },
        { id: "intelligence", name: "INTELLIGENCE", href: "/admin/intelligence" },
      ],
    },

    { id: "finance", name: "FINANCE", icon: BarChart3, href: "/admin/finance" },
    {
      id: "reports",
      name: "REPORTS",
      icon: FileText,
      subItems: [
        { id: "program_reports", name: "PROGRAM REPORTS", href: "/admin/reports/responses" },
        { id: "internal_reports", name: "OP REPORTS", href: "/admin/op-reports" },
        { id: "metrics", name: "PROGRAM HEALTH", href: "/admin/metrics" },
      ],
    },

    {
      id: "settings",
      name: "SETTINGS",
      icon: Wrench,
      subItems: [
        { id: "audit_logs", name: "AUDIT LOGS", href: "/admin/audit-logs" },
        { id: "security", name: "SECURITY", href: "/admin/security" },
        { id: "integrations", name: "INTEGRATIONS", href: "/admin/integrations" },
        { id: "access_summary", name: "USER ACCESS", href: "/admin/access" },
        { id: "permissions", name: "PERMISSIONS", href: "/admin/engineering/permissions" },
        { id: "engineering_dashboard", name: "ENGINEERING", href: "/admin/engineering" },
        { id: "system", name: "SYSTEM MONITORING", href: "/admin/system" },
      ],
    },
  ],
  admin: [
    { id: "dashboard", name: "DASHBOARD", icon: ShieldCheck, href: "/admin" },
    {
      id: "personnel",
      name: "TEAM SETTINGS",
      icon: Users,
      href: "/admin/personnel",
    },
    {
      id: "projects",
      name: "PROJECTS",
      icon: Rocket,
      href: "/admin/projects",
    },
    { id: "logs", name: "ACTIVITY LOGS", icon: FileText, href: "/admin/logs" },
    {
      id: "reports",
      name: "REPORTS",
      icon: BarChart3,

      href: "/admin/reports",
    },
  ],
  program_manager: [
    { id: "dashboard", name: "DASHBOARD", icon: LayoutDashboard, href: "/pm" },
    { id: "programs", name: "PROGRAMS", icon: Briefcase, href: "/pm/programs" },
    {
      id: "communication",
      name: "COMMUNICATION",
      icon: MessageSquare,
      subItems: [
        {
          id: "groups",
          name: "GROUPS",
          href: "/pm/communications/contacts",
        },
        {
          id: "messages",
          name: "MESSAGES",
          href: "/pm/messages",
        },
      ],
    },
    {
      id: "reports",
      name: "REPORTS",
      icon: BarChart3,
      subItems: [
        {
          id: "internal_reports",
          name: "INTERNAL REPORTS",
          href: "/staff/op-report",
        },
        {
          id: "my_projects",
          name: "MY PROJECTS",
          href: "/staff/projects",
        },
      ],
    },
  ],
  staff: [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: LayoutDashboard,
      href: "/staff",
    },
    {
      id: "weekly_ops",
      name: "WEEKLY OPS",
      icon: Calendar,
      href: "/staff/op-report",
    },
    {
      id: "my_projects",
      name: "MY PROJECTS",
      icon: Briefcase,
      href: "/staff/projects",
    },
    {
      id: "messages",
      name: "MESSAGES",
      icon: Send,
      href: "/staff/messages",
    },
  ],

  teacher: [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: LayoutDashboard,
      href: "/teacher",
    },
    {
      id: "communication",
      name: "COMMUNICATION",
      icon: MessageSquare,
      subItems: [
        {
          id: "groups",
          name: "GROUPS",
          href: "/pm/communications/contacts",
        },
        {
          id: "messages",
          name: "MESSAGES",
          href: "/teacher/messages",
        },
      ],
    },
    {
      id: "programs",
      name: "PROGRAMS",
      icon: Briefcase,
      subItems: [
        { id: "all_programs", name: "ALL PROGRAMS", href: "/pm/programs" },
      ],
    },
    {
      id: "reports",
      name: "REPORTS",
      icon: BarChart3,
      subItems: [
        {
          id: "internal_reports",
          name: "INTERNAL REPORTS",
          href: "/staff/op-report",
        },
        {
          id: "my_projects",
          name: "MY PROJECTS",
          href: "/staff/projects",
        },
      ],
    },
  ],
  facilitator: [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: LayoutDashboard,
      href: "/facilitator",
    },
    {
      id: "my_programs",
      name: "MY PROGRAMS",
      icon: Briefcase,
      href: "/facilitator",
    },
    {
      id: "reviews",
      name: "MY REVIEWS",
      icon: ClipboardList,
      href: "/facilitator/reviews",
    },
    {
      id: "profile",
      name: "PROFILE",
      icon: User,
      href: "/facilitator/profile",
    },
  ],
  developer: [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: LayoutDashboard,
      href: "/developer",
    },
    {
      id: "my_tasks",
      name: "MY TASKS",
      icon: CheckSquare,
      href: "/developer/my-tasks",
    },
    {
      id: "assigned_tasks",
      name: "ASSIGNED TASKS",
      icon: ListTodo,
      href: "/developer/assigned-tasks",
    },
    {
      id: "rituals",
      name: "STANDUPS & RETROS",
      icon: MessageSquare,
      subItems: [
        {
          id: "standup",
          name: "STANDUP",
          href: "/staff/op-report?tab=standup",
        },
        { id: "retro", name: "RETRO", href: "/staff/op-report?tab=retro" },
      ],
    },
    {
      id: "projects",
      name: "PROJECTS",
      icon: Briefcase,
      href: "/staff/projects",
    },
    {
      id: "notifications",
      name: "NOTIFICATIONS",
      icon: Bell,
      href: "/developer/notifications",
    },
    {
      id: "messages",
      name: "MESSAGES",
      icon: Send,
      href: "/staff/messages",
    },
  ],

  // Neutral member: a valid person with no program/group/assignment yet.
  // Only genuinely global surfaces — no program-specific items that would
  // immediately 403 with "not enrolled".
  member: [
    {
      id: "dashboard",
      name: "WORKSPACES",
      icon: LayoutDashboard,
      href: "/workspaces",
    },
    {
      id: "messages",
      name: "MESSAGES",
      icon: MessageSquare,
      href: "/participant/messages",
    },
  ],

  participant: [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: LayoutDashboard,
      href: "/participant",
    },
    {
      id: "programs",
      name: "MY PROGRAMS",
      icon: Briefcase,
      href: "/participant/dashboard",
    },
    {
      id: "timeline",
      name: "MY TIMELINE",
      icon: Clock,
      href: "/participant/profile#timeline",
    },
    {
      id: "certificates",
      name: "MY CERTIFICATES",
      icon: FileText,
      href: "/participant/certificates",
    },
    {
      id: "messages",
      name: "MESSAGES",
      icon: MessageSquare,
      href: "/participant/messages",
    },
  ],

  founder: [
    {
      id: "dashboard",
      name: "DASHBOARD",
      icon: LayoutDashboard,
      href: "/participant",
    },
    {
      id: "programs",
      name: "MY PROGRAMS",
      icon: Briefcase,
      href: "/participant/dashboard",
    },
    {
      id: "ventures",
      name: "MY VENTURES",
      icon: Rocket,
      href: "/participant/ventures",
    },
    {
      id: "timeline",
      name: "MY TIMELINE",
      icon: Clock,
      href: "/participant/profile#timeline",
    },
    {
      id: "messages",
      name: "MESSAGES",
      icon: MessageSquare,
      href: "/participant/messages",
    },
  ],

  team: [
    {
      id: "dashboard",
      name: "TEAM WORKSPACE",
      icon: LayoutDashboard,
      href: "/team",
    },
    {
      id: "programs",
      name: "DELIVERABLES",
      icon: FileText,
      href: "/team",
    },
  ],

  investor: [
    {
      id: "dashboard",
      name: "DISCOVER",
      icon: LayoutDashboard,
      href: "/investor/dashboard",
    },
    {
      id: "pipeline",
      name: "PIPELINE",
      icon: BarChart3,
      href: "/investor/pipeline",
    },
    {
      id: "portfolio",
      name: "PORTFOLIO",
      icon: TrendingUp,
      href: "/investor/portfolio",
    },
    {
      id: "activity",
      name: "ACTIVITY",
      icon: Clock,
      href: "/investor/history",
    },
    {
      id: "profile",
      name: "PROFILE",
      icon: User,
      href: "/investor/profile",
    },
  ],
};

// =============================================================================
// RESPONSIBILITY-GATED NAVIGATION
// =============================================================================
// Maps nav item IDs to the responsibility key required to see them.
// Items not listed here are visible to everyone with that role.
// Super Admin always sees everything.
// =============================================================================

const NAV_RESPONSIBILITY_MAP = {
  // CRM
  crm: "crm",
  crm_dashboard: "crm",
  crm_timeline: "crm",
  all_contacts: "crm",
  pending_users: "crm",
  bulk_upload: "crm",
  forms: "crm",
  messages: "crm",
  announcements: "crm",

  // Programs
  programs: "program_management",
  all_programs: "program_management",
  create_program: "program_management",
  progress: "program_management",
  program_reports: "program_management",
  submissions: "program_management",
  // Ventures
  ventures: "program_management",
  all_ventures: "program_management",
  register_venture: "program_management",
  // Projects / Operations
  operations: "operations",
  internal_ops: "operations",
  internal_ops_board: "operations",
  all_projects: "project_ownership",
  create_project: "project_ownership",
  my_projects: "project_ownership",
  tasks: "operations",
  blockers: "operations",
  standup: "operations",
  retro: "operations",
  standups_retros: "operations",
  weekly_ops: "operations",
  internal_reports: "reporting",
  // Knowledge
  knowledge: "knowledge_base",
  knowledge_base: "knowledge_base",
  intelligence: "intelligence",
  // Finance & Health
  finance: "finance",
  metrics: "reporting",
  reports: "reporting",
  // Settings
  settings: "system_settings",
  audit_logs: "system_settings",
  security: "system_settings",
  integrations: "system_settings",
  system: "system_settings",
  access_summary: "user_management",
  permissions: "user_management",
  engineering_dashboard: "engineering",
  engineering: "engineering",
  // Legacy / always visible
  dashboard: null,
  projects: null,
  personnel: "user_management",
  logs: "user_management",
  groups: "crm",
  communication: "crm",
  my_tasks: "operations",
  assigned_tasks: "operations",
  rituals: "operations",
};

// Roles that bypass responsibility filtering entirely
const RESPONSIBILITY_BYPASS_ROLES = ["super_admin"];

/**
 * Build nav items from responsibilities across ALL role matrices.
 * Collects items from every role's matrix where the required responsibility
 * matches the user's assigned responsibilities. Items with no responsibility
 * requirement are always included (dashboard, profile, logout).
 */
function buildNavFromResponsibilities(userRespKeys) {
  const allItems = [];
  const seenIds = new Set();

  for (const matrix of Object.values(NAVIGATION_MATRIX)) {
    for (const item of matrix) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      const required = NAV_RESPONSIBILITY_MAP[item.id];
      // Include if no responsibility required OR user has the required responsibility
      if (!required || userRespKeys.has(required)) {
        if (item.subItems) {
          const filteredSubs = item.subItems.filter((sub) => {
            const subRequired = NAV_RESPONSIBILITY_MAP[sub.id];
            return !subRequired || userRespKeys.has(subRequired);
          });
          if (filteredSubs.length > 0) {
            allItems.push({ ...item, subItems: filteredSubs });
          }
        } else {
          allItems.push(item);
        }
      }
    }
  }
  return allItems;
}

/**
 * Filter nav items based on a user's responsibilities.
 * Recursively handles subItems.
 */
function filterNavByResponsibilities(items, userResponsibilities, bypass) {
  if (bypass) return items;

  // If no responsibilities assigned yet, don't filter — backward compatible.
  // Users who haven't been seeded with responsibilities see full role-based nav.
  if (!userResponsibilities || userResponsibilities.length === 0) return items;

  const respKeys = new Set(userResponsibilities.map((r) => r.key));

  return items.reduce((acc, item) => {
    // Check if this item has a responsibility requirement
    const required = NAV_RESPONSIBILITY_MAP[item.id];

    // If it has a required responsibility and user doesn't have it, skip
    if (required && !respKeys.has(required)) {
      return acc;
    }

    // If no requirement, always include it
    // Process subItems if any
    if (item.subItems) {
      const filteredSubItems = item.subItems.filter((sub) => {
        const subRequired = NAV_RESPONSIBILITY_MAP[sub.id];
        return !subRequired || respKeys.has(subRequired);
      });
      if (filteredSubItems.length > 0) {
        acc.push({ ...item, subItems: filteredSubItems });
      }
      // If no subItems remain, don't include the parent
      return acc;
    }

    acc.push(item);
    return acc;
  }, []);
}

export default function DashboardLayout({ children, role = "admin", modals, fullWidth = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [openMenus, setOpenMenus] = useState({});
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { lang, t, switchLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [userResponsibilities, setUserResponsibilities] = useState([]);
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      if (data.success) {
        // Only keep pinned, non-archived announcements for the banner
        setPinnedAnnouncements(
          (data.announcements || []).filter(
            (a) => a.is_pinned && !a.is_archived,
          ),
        );
      }
    } catch (_) {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) return;
      const parsedUser = JSON.parse(savedUser);
      const recipientId =
        parsedUser.role === "super_admin"
          ? "sa"
          : parsedUser.cid || parsedUser.id;
      const res = await fetch(`/api/notifications?recipient_id=${recipientId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(
          (data.notifications || []).filter((n) => !n.is_read).length,
        );
      }
    } catch (e) {}
  }, []);

  // ── Fetch actual unread message count (not from notifications) ──
  const fetchUnreadMessageCount = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) return;
      const parsedUser = JSON.parse(savedUser);
      const cid = parsedUser.cid || parsedUser.id;
      if (!cid) return;
      const res = await fetch(`/api/internal-comms?cid=${cid}`);
      const data = await res.json();
      if (data.success) {
        const myMessages = data.messages.filter(
          (m) =>
            String(m.recipient_id) === String(cid) &&
            (m.is_read === 0 || m.is_read === null),
        );
        setUnreadMessageCount(myMessages.length);
      }
    } catch (_) {}
  }, []);

  // ── Fetch pending user approvals count ──
  const fetchPendingUsersCount = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) return;
      const parsedUser = JSON.parse(savedUser);
      if (parsedUser.role !== "super_admin") return;
      const res = await fetch("/api/admin/pending-users");
      const data = await res.json();
      if (data.success) {
        setPendingUsersCount(
          (data.users || data.pendingUsers || []).filter(
            (u) => u.status === "pending",
          ).length,
        );
      }
    } catch (_) {}
  }, []);

  // ── Fetch pending submission count for PM ──
  const [submissionCount, setSubmissionCount] = useState(0);
  const fetchSubmissionCount = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) return;
      const parsedUser = JSON.parse(savedUser);
      if (parsedUser.role !== "program_manager") return;
      const pmId = parsedUser.cid || parsedUser.id;
      if (!pmId) return;
      const res = await fetch(
        `/api/pm/submissions?assigned_pm_id=${encodeURIComponent(pmId)}`,
      );
      const data = await res.json();
      if (data.success) {
        const pending = (data.submissions || []).filter(
          (s) => s.status === "pending",
        ).length;
        setSubmissionCount(pending);
      }
    } catch (_) {}
  }, []);

  const fetchPendingInvites = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) return;
      const parsedUser = JSON.parse(savedUser);
      const cid = parsedUser.cid || parsedUser.id;
      if (!cid) return;
      const res = await fetch(
        `/api/projects/invitations?invitee_id=${cid}&status=pending`,
      );
      const data = await res.json();
      if (data.success) setPendingInvites(data.invitations || []);
    } catch (_) {}
  }, []);

  const fetchPendingAssignments = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem("user");
      if (!savedUser) return;
      const parsedUser = JSON.parse(savedUser);
      const cid = parsedUser.cid || parsedUser.id;
      if (!cid) return;
      const res = await fetch(
        `/api/tasks/assignments?assignee_id=${cid}&status=pending`,
      );
      const data = await res.json();
      if (data.success) setPendingAssignments(data.assignments || []);
    } catch (_) {}
  }, []);

  // Listen for manual refresh events from approve actions
  useEffect(() => {
    const onRefresh = () => {
      fetchNotifications();
      fetchSubmissionCount();
      fetchAnnouncements();
      fetchUnreadMessageCount();
      fetchPendingUsersCount();
    };
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
  }, [
    fetchNotifications,
    fetchSubmissionCount,
    fetchAnnouncements,
    fetchUnreadMessageCount,
    fetchPendingUsersCount,
  ]);

  useEffect(() => {
    // Poll every 30s for real-time notifications
    const id = setInterval(() => {
      fetchNotifications();
      fetchSubmissionCount();
      fetchPendingInvites();
      fetchPendingAssignments();
      fetchAnnouncements();
      fetchUnreadMessageCount();
      fetchPendingUsersCount();
    }, 30000);
    return () => clearInterval(id);
  }, [
    fetchNotifications,
    fetchSubmissionCount,
    fetchPendingInvites,
    fetchPendingAssignments,
    fetchAnnouncements,
    fetchPendingUsersCount,
  ]);

  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState({});
  const [authChecked, setAuthChecked] = useState(false);
  const [pmPrograms, setPmPrograms] = useState([]);

  // Load user from session API first, fallback to localStorage
  useEffect(() => {
    async function initAuth() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();

        if (sessionData.authenticated && sessionData.user) {
          // Session API returned user — use it as source of truth
          const userWithFullData = {
            ...sessionData.user,
            // Merge with localStorage if available for extra fields
            ...(localStorage.getItem("user")
              ? JSON.parse(localStorage.getItem("user"))
              : {}),
            // But session data wins for these critical fields
            cid: sessionData.user.cid,
            name: sessionData.user.name,
            email: sessionData.user.email,
            role: sessionData.user.role,
            group_name: sessionData.user.group_name,
          };
          setUser(userWithFullData);
          // Sync localStorage for components that still read from it
          localStorage.setItem("user", JSON.stringify(userWithFullData));

          // Fetch user groups + responsibilities + notifications in parallel
          const [groupsRes, respRes, notifRes] = await Promise.allSettled([
            fetch(`/api/user-groups?user_cid=${sessionData.user.cid}`),
            fetch(`/api/responsibilities?user_cid=${sessionData.user.cid}`),
            fetch(`/api/notifications?recipient_id=${sessionData.user.cid}`),
          ]);

          // User groups
          if (groupsRes.status === "fulfilled") {
            try {
              const groupsData = await groupsRes.value.json();
              if (groupsData.success && groupsData.groups.length > 0) {
                const updatedUser = {
                  ...userWithFullData,
                  groups: groupsData.groups,
                };
                setUser(updatedUser);
                localStorage.setItem("user", JSON.stringify(updatedUser));
              }
            } catch (_) {}
          }

          // Responsibilities
          if (respRes.status === "fulfilled") {
            try {
              const respData = await respRes.value.json();
              if (respData.success) {
                setUserResponsibilities(respData.responsibilities || []);
              }
            } catch (_) {}
          }

          // Notifications (pre-fetch to avoid separate effect)
          if (notifRes.status === "fulfilled") {
            try {
              const notifData = await notifRes.value.json();
              if (notifData.success) {
                // Only set if we haven't already fetched via the interval
                setNotifications((prev) =>
                  prev.length > 0 ? prev : notifData.notifications || [],
                );
                setUnreadCount((notifData.notifications || []).filter((n) => !n.is_read).length);
              }
            } catch (_) {}
          }

          // Pre-fetch announcements for banner
          fetchAnnouncements();

          // Pre-fetch unread message count for badge
          fetchUnreadMessageCount();
          // Pre-fetch pending users count
          fetchPendingUsersCount();
        } else {
          // Session API failed — fallback to localStorage
          const savedUser = localStorage.getItem("user");
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        }
      } catch (e) {
        // Network error — fallback to localStorage
        const savedUser = localStorage.getItem("user");
        if (savedUser) setUser(JSON.parse(savedUser));
      } finally {
        setAuthChecked(true);
      }
    }
    initAuth();
  }, []);

  // Fetch PM programs when user changes
  useEffect(() => {
    if (!user.cid && !user.id) return;
    if (user.role === "program_manager" || user.role === "super_admin") {
      const url =
        user.role === "super_admin"
          ? "/api/pm/programs"
          : "/api/pm/programs?assigned_pm_id=" + (user.cid || user.id);
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setPmPrograms(data.programs || []);
        })
        .catch((e) => console.error(e));
    }
  }, [user.role, user.cid, user.id]);

  // Pre-open menus that have an active child route
  // useEffect(() => {
  //   const toOpen = {};
  //   const checkItems = (items) => {
  //     items.forEach((item) => {
  //       if (item.subItems) {
  //         const hasActiveChild = item.subItems.some((sub) =>
  //           pathname?.startsWith(sub.href),
  //         );
  //         if (hasActiveChild) toOpen[item.id] = true;
  //       }
  //     });
  //   };
  //   Object.values(NAVIGATION_MATRIX).forEach((matrix) => checkItems(matrix));
  //   setOpenMenus((prev) => ({ ...prev, ...toOpen }));
  // }, [pathname]);

  const toggleMenu = useCallback((id) => {
    if (!id) return;
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Unread counts per nav type — messages from actual unread count, others from notifications
  const unreadByType = useMemo(() => {
    const counts = {
      messages: unreadMessageCount,
      announcements: 0,
      forms: 0,
      all_contacts: 0,
      pending_users: pendingUsersCount,
      bulk_upload: 0,
    };
    for (const n of notifications) {
      if (!n.is_read) {
        if (n.type === "announcement") counts.announcements++;
        if (n.type === "form") counts.forms++;
      }
    }
    return counts;
  }, [notifications, unreadMessageCount, pendingUsersCount]);

  // Whether the COMMUNICATION section has any activity in its sub-items
  const hasCommunicationActivity = useMemo(() => {
    if (!unreadByType) return false;
    const commSubIds = [
      "messages",
      "announcements",
      "forms",
      "all_contacts",
      "pending_users",
      "bulk_upload",
    ];
    return commSubIds.some((id) => unreadByType[id] > 0);
  }, [unreadByType]);

  const navItems = useMemo(() => {
    // Priority: user.role (from session) > role (from prop) > fallback 'admin'
    const activeRole = user.role || role || "admin";

    // Check if user belongs to Future Studio Interns group
    const userGroups = user.groups || [];
    const isIntern = userGroups.some(
      (g) =>
        g.toUpperCase() === "FUTURE STUDIO INTERNS" ||
        g.toUpperCase() === "INTERN",
    );

    if (isIntern && activeRole !== "participant") {
      // Interns get restricted navigation regardless of their role
      // Exception: participants keep their own dashboard
      return [
        {
          id: "dashboard",
          name: "DASHBOARD",
          icon: LayoutDashboard,
          href: "/developer",
        },
        {
          id: "standup",
          name: "STAND-UP",
          icon: MessageSquare,
          href: "/staff/op-report?tab=standup",
        },
        {
          id: "my_tasks",
          name: "MY TASKS",
          icon: CheckSquare,
          href: "/developer/my-tasks",
        },
        {
          id: "projects",
          name: "MY PROJECTS",
          icon: Briefcase,
          href: "/staff/projects",
        },
        {
          id: "messages",
          name: "MESSAGING",
          icon: Send,
          href: "/staff/messages",
        },
      ];
    }

    const matrix = NAVIGATION_MATRIX[activeRole] || NAVIGATION_MATRIX.admin;
    const bypass = RESPONSIBILITY_BYPASS_ROLES.includes(activeRole);

    // If user has responsibilities assigned, build nav from responsibilities
    // across ALL role matrices instead of just the user's role matrix
    if (!bypass && userResponsibilities && userResponsibilities.length > 0) {
      const respKeys = new Set(userResponsibilities.map((r) => r.key));
      return buildNavFromResponsibilities(respKeys);
    }

    // Fallback: role-based matrix (backward compatible)
    const items = [...matrix];

    if (
      (activeRole === "program_manager" || activeRole === "super_admin") &&
      pmPrograms.length > 0
    ) {
      const progIndex = items.findIndex((i) => i.id === "programs");
      if (progIndex !== -1) {
        const baseSubItems =
          activeRole === "super_admin"
            ? [
                {
                  id: "all_programs",
                  name: "ALL PROGRAMS",
                  href: "/admin/programs",
                },
                {
                  id: "create_program",
                  name: "CREATE PROGRAM",
                  href: "/admin/programs/new",
                },
              ]
            : [
                { id: "all_programs", name: "OVERVIEW", href: "/pm/programs" },
                {
                  id: "submissions",
                  name: "SUBMISSIONS",
                  href: "/pm/submissions",
                },
              ];

        // Only static menu items — no dynamic program listing
        items[progIndex] = {
          ...items[progIndex],
          subItems: [...baseSubItems],
        };
      }
    }

    return filterNavByResponsibilities(items, userResponsibilities, bypass);
  }, [user.role, user.groups, role, pmPrograms, userResponsibilities]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    }
    localStorage.clear();
    router.replace("/login");
  };

  const activeRole = user.role || role || "admin";
  const commonProps = {
    collapsed,
    role: activeRole,
    user,
    navItems,
    openMenus,
    toggleMenu,
    pathname,
    setMobileMenuOpen,
    handleLogout,
    t,
    submissionCount,
    unreadByType,
    hasCommunicationActivity,
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-primary" />;
  }

  return (
    <AppErrorBoundary>
      <div className="flex h-screen w-full overflow-hidden bg-primary text-[var(--text-primary)]">
        <aside
          style={{ width: collapsed ? 64 : 260 }}
          className="hidden md:flex flex-col h-screen sticky top-0 bg-secondary border-r border-[var(--border-primary)] p-4 overflow-hidden min-h-0 z-[100] transition-[width] duration-150"
        >
          <SidebarContent {...commonProps} />
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[150]">
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <aside className="absolute inset-y-0 left-0 w-64 bg-secondary p-6 border-r border-[var(--border-primary)]">
              <SidebarContent {...commonProps} />
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-20 flex items-center px-4 lg:px-6 border-b border-[var(--border-primary)] bg-secondary/80 backdrop-blur-xl sticky top-0 z-[100]">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-orange)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] uppercase relative z-10 min-w-0">
              <span className="hidden sm:inline">ImpactOS</span>
              <ChevronRight className="w-3 h-3 opacity-30 hidden sm:inline" />
              <span className="text-[var(--text-primary)] truncate">
                {pathname ? t(navCrumb(pathname)) : t("navigation.dashboard")}
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto relative z-10">
              {/* Theme Selector */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                  className="p-2 rounded-md flex items-center gap-1"
                  style={{ color: "var(--text-secondary)" }}
                  title={theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}
                >
                  {theme === "system" ? (
                    <Monitor className="w-4 h-4" />
                  ) : theme === "dark" ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                {themeMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[210]"
                      onClick={() => setThemeMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-10 w-36 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-2xl z-[220] overflow-hidden">
                      {[
                        { value: "dark", label: "Dark", icon: Moon },
                        { value: "light", label: "Light", icon: Sun },
                        { value: "system", label: "System", icon: Monitor },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setTheme(opt.value);
                            setThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors ${
                            theme === opt.value
                              ? "text-[var(--brand-orange)] bg-[var(--brand-orange)]/10"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
                          }`}
                        >
                          <opt.icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => switchLang(lang === "en" ? "fr" : "en")}
                className="px-2 py-1 text-[10px] font-bold border border-[var(--border-primary)] rounded uppercase"
              >
                {lang}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--brand-orange)] text-black text-[10px] font-black rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-10 w-72 bg-secondary border border-[var(--border-primary)] rounded-lg p-4 z-[200]">
                    <h4 className="text-[10px] font-bold uppercase mb-3 text-[var(--text-secondary)]">
                      {t(tnav("intel_feed"))}
                    </h4>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={async () => {
                              // Mark as read
                              try {
                                await fetch("/api/notifications", {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    id: n.id,
                                    action: "read",
                                  }),
                                });
                                fetchNotifications();
                              } catch (_) {}

                              if (
                                n.type === "verification" ||
                                n.title.includes("ACCESS")
                              ) {
                                router.push("/admin/communications/contacts");
                                setShowNotifications(false);
                              }
                              if (n.type === "message") {
                                const role = user?.role || "";
                                if (role === "super_admin")
                                  router.push("/admin/internal-comms");
                                else if (
                                  role === "staff" ||
                                  role === "developer"
                                )
                                  router.push("/staff/messages");
                                else if (role === "teacher")
                                  router.push("/teacher/messages");
                                else if (role === "program_manager")
                                  router.push("/pm/messages");
                                else if (role === "participant")
                                  router.push("/participant/messages");
                                setShowNotifications(false);
                              }
                              if (
                                n.type === "comment" ||
                                n.type === "mention"
                              ) {
                                const role = user?.role || "";
                                if (role === "developer")
                                  router.push("/developer/standup");
                                else router.push("/staff/op-report");
                                setShowNotifications(false);
                              }
                              if (n.type === "blocker_discussion") {
                                const role = user?.role || "";
                                if (role === "super_admin")
                                  router.push("/admin/blockers");
                                else router.push("/staff/op-report");
                                setShowNotifications(false);
                              }
                              if (n.type === "investor" && n.link) {
                                router.push(n.link);
                                setShowNotifications(false);
                              }
                            }}
                            className={`p-3 rounded-xl hover:bg-primary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)] group ${!n.is_read ? "bg-[var(--brand-orange)]/5" : ""}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-black text-[10px] uppercase tracking-tight text-[var(--text-primary)]">
                                {n.title}
                              </p>
                              {!n.is_read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">
                              {n.message}
                            </p>
                            {/* Accept/Decline buttons for project invitations */}
                            {n.type === "project_invite" && (
                              <div
                                className="flex gap-2 mt-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={async () => {
                                    setPendingInvites([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const cid = saved.cid || saved.id;
                                      const invRes = await fetch(
                                        `/api/projects/invitations?invitee_id=${cid}&status=pending`,
                                      );
                                      const invData = await invRes.json();
                                      const pendingInvite =
                                        invData.invitations?.[0];
                                      if (pendingInvite) {
                                        await fetch(
                                          "/api/projects/invitations/respond",
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              invitation_id: pendingInvite.id,
                                              action: "accept",
                                            }),
                                          },
                                        );
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: n.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications();
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-emerald-500 text-white rounded text-[8px] font-black uppercase"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={async () => {
                                    setPendingInvites([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const cid = saved.cid || saved.id;
                                      const invRes = await fetch(
                                        `/api/projects/invitations?invitee_id=${cid}&status=pending`,
                                      );
                                      const invData = await invRes.json();
                                      const pendingInvite =
                                        invData.invitations?.[0];
                                      if (pendingInvite) {
                                        await fetch(
                                          "/api/projects/invitations/respond",
                                          {
                                            method: "POST",
                                            headers: {
                                              "Content-Type":
                                                "application/json",
                                            },
                                            body: JSON.stringify({
                                              invitation_id: pendingInvite.id,
                                              action: "decline",
                                            }),
                                          },
                                        );
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: n.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications();
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-slate-600 text-white rounded text-[8px] font-black uppercase"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                            {/* Accept/Decline for task assignments */}
                            {n.type === "task_assignment" && (
                              <div
                                className="flex gap-2 mt-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={async () => {
                                    setPendingAssignments([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const cid = saved.cid || saved.id;
                                      const assRes = await fetch(
                                        `/api/tasks/assignments?assignee_id=${cid}&status=pending`,
                                      );
                                      const assData = await assRes.json();
                                      const pendingAss =
                                        assData.assignments?.[0];
                                      if (pendingAss) {
                                        await fetch("/api/tasks/assignments", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            assignment_id: pendingAss.id,
                                            action: "accept",
                                          }),
                                        });
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: n.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications();
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-emerald-500 text-white rounded text-[8px] font-black uppercase"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={async () => {
                                    setPendingAssignments([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const cid = saved.cid || saved.id;
                                      const assRes = await fetch(
                                        `/api/tasks/assignments?assignee_id=${cid}&status=pending`,
                                      );
                                      const assData = await assRes.json();
                                      const pendingAss =
                                        assData.assignments?.[0];
                                      if (pendingAss) {
                                        await fetch("/api/tasks/assignments", {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            assignment_id: pendingAss.id,
                                            action: "decline",
                                          }),
                                        });
                                      }
                                      await fetch("/api/notifications", {
                                        method: "PATCH",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          id: n.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications();
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-slate-600 text-white rounded text-[8px] font-black uppercase"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] opacity-40 italic py-4 text-center">
                          {t(tnav("no_new_intel"))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-[var(--border-primary)]">
                <div className="text-right hidden sm:block">
                  <p className="text-[11px] font-bold leading-none">
                    {user?.name || "User"}
                  </p>
                </div>
                <div className="w-8 h-8 rounded bg-primary border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs">
                  {String(user?.name || "U").charAt(0)}
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 bg-[var(--brand-orange)] rounded-md"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-10 overflow-y-auto bg-primary">
            {/* Staging Impersonation Banner */}
            {user?.is_impersonation && (
              <div className="mb-6 p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center gap-3">
                <Wrench className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                    STAGING ENVIRONMENT — Impersonating: {user?.name || "Unknown"} ({user?.role || "unknown"})
                  </p>
                  <p className="text-[9px] text-amber-500/70 mt-0.5">
                    You are viewing the application as this user. Log out to return to your own account.
                  </p>
                </div>
              </div>
            )}
            {/* Pinned Announcements Banner */}
            {pinnedAnnouncements.length > 0 && (
              <div className="mb-6 space-y-2">
                {pinnedAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 flex items-center justify-between flex-wrap gap-3 cursor-pointer hover:bg-[var(--brand-orange)]/15 transition-all"
                    onClick={() => router.push("/admin/announcements")}
                  >
                    <div className="flex items-center gap-3">
                      <Megaphone className="w-5 h-5 text-[var(--brand-orange)]" />
                      <div>
                        <p className="text-[11px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                          {t(tnav("announcements"))}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          <span className="font-bold text-[var(--text-primary)]">
                            {ann.title}
                          </span>
                          {" — "}
                          {ann.body.length > 120
                            ? ann.body.substring(0, 117) + "..."
                            : ann.body}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] text-[var(--text-secondary)] uppercase">
                      {t("common.viewAll")} →
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Project Invitation Banner */}
            {pendingInvites.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-[var(--brand-orange)]" />
                  <div>
                    <p className="text-[11px] font-black text-[var(--brand-orange)] uppercase tracking-wider">
                      Project Invitation
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      You've been invited to join{" "}
                      <span className="font-bold text-[var(--text-primary)]">
                        {pendingInvites[0].project_name || "a project"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setPendingInvites([]);
                      try {
                        await fetch("/api/projects/invitations/respond", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            invitation_id: pendingInvites[0].id,
                            action: "accept",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      setPendingInvites([]);
                      try {
                        await fetch("/api/projects/invitations/respond", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            invitation_id: pendingInvites[0].id,
                            action: "decline",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-500 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
            {/* Task Assignment Banner */}
            {pendingAssignments.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <ListTodo className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-[11px] font-black text-emerald-500 uppercase tracking-wider">
                      Task Assignment
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      You've been assigned:{" "}
                      <span className="font-bold text-[var(--text-primary)]">
                        {pendingAssignments[0].task_title || "a task"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setPendingAssignments([]);
                      try {
                        await fetch("/api/tasks/assignments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            assignment_id: pendingAssignments[0].id,
                            action: "accept",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-600 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={async () => {
                      setPendingAssignments([]);
                      try {
                        await fetch("/api/tasks/assignments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            assignment_id: pendingAssignments[0].id,
                            action: "decline",
                          }),
                        });
                        fetchNotifications();
                      } catch (_) {}
                    }}
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-500 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
            <div className={fullWidth ? "w-full animate-in" : "max-w-[1400px] mx-auto animate-in"}>{children}</div>
          </main>
          {modals}
          <GlobalToast />
        </div>
      </div>
    </AppErrorBoundary>
  );
}
