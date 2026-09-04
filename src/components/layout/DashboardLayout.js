"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { getDashboardSession, setDashboardSession } from "@/lib/dashboardSession";
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
  UploadCloud,
  ListTodo,
  ClipboardList,
  Wrench,
  CheckSquare,
  Megaphone,
  HeartPulse,
  Blocks,
  Clock,
  GraduationCap,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import GlobalToast from "@/components/ui/GlobalToast";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";
import ContextSwitcher from "@/components/layout/ContextSwitcher";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { fetchSwrJson } from "@/lib/hooks/useApi";
import { buildRoleNav, NAV_ROLE_KEYS, projectNavForCapabilities } from "@/lib/masterNavigation";

// LocalStorage keys that remember when the user last viewed a given page,
// so sidebar badges only count items that arrived after that visit.
const SEEN_KEYS = {
  submissions: "impactos_pm_submissions_seen_at",
  messages: "impactos_messages_seen_at",
  pendingUsers: "impactos_pending_users_seen_at",
  announcements: "impactos_announcements_seen_at",
  forms: "impactos_forms_seen_at",
};

const readSeenWatermark = (key) => {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(key);
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

const writeSeenWatermark = (key) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, new Date().toISOString());
};

// Returns true when `dateValue` is newer than the watermark (or when we can't
// tell — we err on the side of showing the badge).
const isNewerThan = (dateValue, watermark) => {
  if (!watermark) return true;
  if (!dateValue) return true;
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return true;
  return ts > watermark;
};

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
  campaigns: "navigation.campaigns",
  segments: "navigation.segments",
  responses: "navigation.responses",
  administration: "navigation.administration",

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
  crm_membership: "navigation.groups",
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
  lms: "navigation.lms",
  lms_courses: "navigation.lmsCourses",
  learning: "navigation.learning",
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
  responses: "navigation.responses",
  ventures: "navigation.ventures",
  investors: "navigation.investors",
  campaigns: "navigation.campaigns",
  segments: "navigation.segments",
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
  membership: "navigation.groups",
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
  responses: "navigation.responses",
  groups: "navigation.groups",
  submissions: "navigation.submissions",
};

function navCrumb(pathname) {
  const seg = (pathname || "").split("/").filter(Boolean).pop() || "";
  return CRUMB_PATH_MAP[seg] || (NAV_KEY_MAP[seg] ? NAV_KEY_MAP[seg] : seg);
}

/**
 * Resolve the active navigation path for the current route.
 * Walks the nav tree and returns the set of node ids on the single most
 * specific matching branch: an exact href match wins, otherwise the longest
 * segment-boundary prefix (so /admin/engineering matches
 * /admin/engineering/error-logs but never /admin/engineer-x). Hrefs that
 * contain a query string are skipped — they cannot be resolved from the
 * pathname alone (e.g. /staff/op-report?tab=standup keeps current behavior).
 */
function getActivePathIds(navItems, pathname) {
  if (!pathname) return new Set();
  let best = null; // { score, ids }
  const visit = (items, chain) => {
    (items || []).forEach((item) => {
      const nextChain = chain.concat(item.id);
      const kids = item.children || item.subItems;
      if (kids && kids.length > 0) {
        visit(kids, nextChain);
        return;
      }
      if (!item.href || item.href.includes("?")) return;
      let score = 0;
      if (pathname === item.href) score = 1000;
      else if (
        item.href.split("/").filter(Boolean).length >= 2 &&
        pathname.startsWith(item.href + "/")
      ) {
        score = item.href.length;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { score, ids: nextChain };
      }
    });
  };
  visit(navItems, []);
  return best ? new Set(best.ids) : new Set();
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
  activePathIds,
  setMobileMenuOpen,
  handleLogout,
  t,
  submissionCount,
  unreadByType,
  hasCommunicationActivity,
}) => {
  const { switchLang } = useI18n();
  const profileHref = `/${role === "super_admin" ? "admin" : role === "program_manager" ? "pm" : role === "teacher" ? "teacher" : role === "facilitator" ? "facilitator" : role === "developer" || role === "intern" ? "developer" : role === "investor" ? "investor" : "participant"}/profile`;

  const [flyout, setFlyout] = useState(null); // { id, top } — collapsed-rail flyout
  const flyoutTimer = useRef(null);
  // Hover-expand state (expanded sidebar): a SINGLE hover target at a time —
  // hovering the next section collapses the previous one (accordion).
  const [hoverMenu, setHoverMenu] = useState(null);
  const hoverTimer = useRef(null);

  // Clear pending hover/flyout timers on unmount.
  useEffect(
    () => () => {
      clearTimeout(hoverTimer.current);
      clearTimeout(flyoutTimer.current);
    },
    [],
  );

  const label = (item) =>
    item.id?.startsWith("prog_")
      ? item.name
      : t(tnav(item.id)) || item.name;

  const openFlyout = (e, id) => {
    clearTimeout(flyoutTimer.current);
    setFlyout({ id, top: e.currentTarget.getBoundingClientRect().top });
  };
  const scheduleFlyoutClose = () => {
    clearTimeout(flyoutTimer.current);
    flyoutTimer.current = setTimeout(() => setFlyout(null), 200);
  };
  // Hover intent for the expanded sidebar: open after a short delay (prevents
  // flicker when crossing adjacent items), close after the same 200ms delay
  // used by the collapsed-rail flyout — consistent hover timing everywhere.
  const scheduleHoverOpen = (id) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverMenu(id), 150);
  };
  const scheduleHoverClose = (id) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoverMenu((prev) => (prev === id ? null : prev));
    }, 200);
  };
  // A section stays expanded while the hover target is itself or any of its
  // descendants — hovering a nested parent keeps its ancestors open.
  const isHoverTarget = (item, id) => {
    if (!id) return false;
    if (item.id === id) return true;
    const kids = item.children || item.subItems;
    return !!kids && kids.some((k) => isHoverTarget(k, id));
  };

  // Recursive nav renderer: a node with children renders as an expandable
  // group; a node without children renders as a link (leaf). showLabels forces
  // labels/chevrons visible even when the rail is collapsed (flyout usage).
  const renderNavItem = (item, depth, showLabels) => {
    const kids = item.children || item.subItems;
    const hasKids = Array.isArray(kids) && kids.length > 0;
    const isTop = depth === 0;
    const onPath = activePathIds.has(item.id);
    const show = !collapsed || showLabels;

    if (hasKids) {
      const isOpen = openMenus[item.id] || false;
      const expanded = isOpen || isHoverTarget(item, hoverMenu);
      return (
        <div
          key={item.id}
          className="space-y-1"
          onMouseLeave={
            collapsed ? undefined : () => scheduleHoverClose(item.id)
          }
        >
          <button
            onClick={() => toggleMenu(item.id)}
            onMouseEnter={
              collapsed && !showLabels
                ? (e) => openFlyout(e, item.id)
                : collapsed
                  ? undefined
                  : () => scheduleHoverOpen(item.id)
            }
            onMouseLeave={
              collapsed && !showLabels ? scheduleFlyoutClose : undefined
            }
            className={`w-full flex items-center justify-between transition-all font-bold uppercase ${
              isTop
                ? "px-4 py-3.5 rounded-xl text-[11px] tracking-wide"
                : "px-4 py-2 rounded-lg text-[11px] tracking-wide"
            } ${
              onPath
                ? "text-[var(--text-primary)] bg-tertiary border border-[var(--border-secondary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                {item.icon && (
                  <item.icon
                    className={`w-4 h-4 flex-shrink-0 ${onPath ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                  />
                )}
                {item.id === "communication" && hasCommunicationActivity && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />
                )}
              </div>
              {show && <span className="truncate">{label(item)}</span>}
            </div>
            {show && item.id === "programs" && submissionCount > 0 && (
              <span className="text-[8px] font-black bg-[var(--brand-orange)] text-black px-1.5 py-0.5 rounded-full mr-2">
                {submissionCount}
              </span>
            )}
            {show && item.id === "communication" && hasCommunicationActivity && (
              <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)] shrink-0" />
            )}
            {show && (
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            )}
          </button>
          {expanded && show && (
            <div className={`space-y-1 py-1 ${isTop ? "pl-8" : "pl-6"}`}>
              {kids.map((kid) => renderNavItem(kid, depth + 1, showLabels))}
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
        onClick={() => {
          setMobileMenuOpen(false);
          setFlyout(null);
        }}
        className={`w-full flex items-center transition-all font-bold uppercase ${
          isTop
            ? "gap-4 px-4 py-3.5 rounded-xl text-[11px] tracking-wide"
            : "gap-3 px-4 py-2 rounded-lg text-[11px] tracking-wide"
        } ${
          isActive
            ? "text-[var(--brand-orange)] bg-tertiary border border-[var(--border-secondary)]"
            : onPath
              ? "text-[var(--text-primary)] bg-tertiary border border-[var(--border-secondary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
        }`}
      >
        {item.icon && (
          <item.icon
            className={`w-4 h-4 flex-shrink-0 ${isActive || onPath ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
          />
        )}
        {show && <span className="truncate">{label(item)}</span>}
        {show && unreadByType && unreadByType[item.id] > 0 && (
          <span className="ml-auto w-5 h-5 rounded-full bg-[var(--brand-orange)] text-black text-[8px] font-black flex items-center justify-center shrink-0">
            {unreadByType[item.id]}
          </span>
        )}
      </Link>
    );
  };
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
          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] opacity-40">
            {t("navigation.mainOperations")}
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1">
        {(navItems || []).map((item) => renderNavItem(item, 0, false))}
      </nav>

      {/* Collapsed-rail flyout: reach a section's children from the icon rail */}
      {collapsed && flyout && (() => {
        const parent = (navItems || []).find((i) => i.id === flyout.id);
        if (!parent) return null;
        const kids = parent.children || parent.subItems || [];
        return (
          <div
            className="fixed z-[120] w-64 max-h-[70vh] overflow-y-auto rounded-xl bg-secondary border border-[var(--border-primary)] p-2 shadow-xl"
            style={{ left: 76, top: flyout.top }}
            onMouseEnter={() => clearTimeout(flyoutTimer.current)}
            onMouseLeave={scheduleFlyoutClose}
          >
            <p className="px-3 py-1.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] opacity-40">
              {label(parent)}
            </p>
            {kids.map((kid) => renderNavItem(kid, 1, true))}
          </div>
        );
      })()}

      <div className="mt-auto pt-8 border-t border-[var(--border-secondary)] space-y-3">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] opacity-40">
            {t("navigation.userProtocol")}
          </p>
        )}
        <div className="space-y-1">
          <button
            onClick={() => toggleMenu("profile")}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold uppercase tracking-wide text-[11px] ${pathname?.includes("profile") ? "bg-tertiary text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
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
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all font-bold uppercase tracking-wide text-[11px]"
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>FR/EN</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-bold uppercase tracking-wide text-[11px]"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>{t(tnav("logout"))}</span>}
        </button>
      </div>
    </>
  );
};




// =============================================================================
// RESPONSIBILITY-GATED NAVIGATION
// =============================================================================
// Maps nav item IDs to the responsibility key required to see them.
// Items not listed here are visible to everyone with that role.
// Super Admin always sees everything.
// =============================================================================

const NAV_RESPONSIBILITY_MAP = {
  // CRM — people data only (dashboard, people, membership, timeline, duplicates)
  crm: "crm",
  crm_dashboard: "crm",
  crm_membership: "crm",
  crm_timeline: "crm",
  crm_duplicates: "crm",
  all_contacts: "crm",

  // Communication — messaging, announcements, forms + outreach suite.
  // These belong to the COMMUNICATION feature, never to CRM.
  communication: "communication",
  messages: "communication",
  announcements: "communication",
  forms: "communication",
  campaigns: "communication",
  segments: "communication",
  responses: "communication",
  groups: "communication",

  // Administration (user tools moved out of CRM — kept under user_management)
  pending_users: "user_management",
  bulk_upload: "user_management",

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
  my_tasks: "operations",
  assigned_tasks: "operations",
  rituals: "operations",
};

// Resolve icon names from the master navigation module into components.
const NAV_ICONS = {
  layoutDashboard: LayoutDashboard,
  users: Users,
  messageSquare: MessageSquare,
  briefcase: Briefcase,
  rocket: Rocket,
  barChart3: BarChart3,
  listTodo: ListTodo,
  fileText: FileText,
  library: Library,
  shieldCheck: ShieldCheck,
  wrench: Wrench,
  calendar: Calendar,
  send: Send,
  checkSquare: CheckSquare,
  bell: Bell,
  clipboardList: ClipboardList,
  user: User,
  trendingUp: TrendingUp,
  clock: Clock,
  graduationCap: GraduationCap,
};

function attachIcons(items) {
  return (items || []).map((item) => ({
    ...item,
    // Idempotent: string names are resolved to components; already-resolved
    // components (from a previous pass) pass through untouched.
    icon:
      typeof item.icon === "string" ? NAV_ICONS[item.icon] : item.icon,
    subItems: item.subItems ? attachIcons(item.subItems) : item.subItems,
  }));
}

// Roles that bypass responsibility filtering entirely
const RESPONSIBILITY_BYPASS_ROLES = ["super_admin"];

// Admin-only destinations remapped to a page the role can actually open when a
// responsibility grants a nav item that normally points at /admin/*. Items with
// no fallback are dropped for non-admin roles instead of leading to a login
// redirect. Super Admin and developer keep the original admin hrefs.
const NON_ADMIN_HREF_FALLBACKS = {
  finance: "/finance",
  crm_dashboard: "/crm",
  forms: "/platform",
};

// The sidebar follows the page context: a user acting under another role
// (e.g. a staff member assigned as Program Manager) sees that role's nav
// while on its pages. Order matters only where prefixes overlap — they do not.
const PATH_CONTEXT_ROLES = [
  { prefix: "/admin", role: "super_admin" },
  { prefix: "/pm", role: "program_manager" },
  { prefix: "/staff", role: "staff" },
  { prefix: "/teacher", role: "teacher" },
  { prefix: "/facilitator", role: "facilitator" },
  { prefix: "/participant", role: "participant" },
  { prefix: "/developer", role: "developer" },
  { prefix: "/finance", role: "finance" },
  { prefix: "/crm", role: "crm" },
];

function contextRoleFromPathname(pathname) {
  if (!pathname) return null;
  for (const { prefix, role } of PATH_CONTEXT_ROLES) {
    if (pathname.startsWith(prefix)) return role;
  }
  return null;
}

/**
 * Build nav items from responsibilities across ALL role matrices.
 * Collects items from every role's matrix where the required responsibility
 * matches the user's assigned responsibilities. Items with no responsibility
 * requirement are always included (dashboard, profile, logout).
 */
function buildNavFromResponsibilities(userRespKeys, activeRole) {
  const ownItems = buildRoleNav(activeRole);
  const otherItems = NAV_ROLE_KEYS.filter((r) => r !== activeRole).map((r) =>
    buildRoleNav(r),
  );
  const allItems = [];
  const seenIds = new Set();
  // Only Super Admin and developer can open /admin/* pages.
  const canOpenAdmin = activeRole === "super_admin" || activeRole === "developer";

  // Items granted from OTHER matrices may point at admin-only pages the user
  // cannot open. Remap them to a role-appropriate page, or drop them entirely.
  const resolveHref = (itemId, href) => {
    if (canOpenAdmin || !href) return href;
    const fallback = NON_ADMIN_HREF_FALLBACKS[itemId];
    if (fallback) return fallback;
    return href.startsWith("/admin/") ? null : href;
  };

  const collect = (matrix, fromOwnMatrix) => {
    for (const item of matrix) {
      if (seenIds.has(item.id)) continue;
      const required = NAV_RESPONSIBILITY_MAP[item.id];
      // The user's own role matrix is the baseline (always shown). Items from
      // other role matrices appear ONLY when a responsibility explicitly
      // grants them — unmapped items from other roles must never leak in.
      const includeItem =
        fromOwnMatrix || (required && userRespKeys.has(required));
      if (!includeItem) continue;
      seenIds.add(item.id);
      if (item.subItems) {
        const filteredSubs = item.subItems
          .filter((sub) => {
            const subRequired = NAV_RESPONSIBILITY_MAP[sub.id];
            return fromOwnMatrix
              ? true
              : subRequired && userRespKeys.has(subRequired);
          })
          .map((sub) =>
            fromOwnMatrix
              ? sub
              : { ...sub, href: resolveHref(sub.id, sub.href) },
          )
          .filter((sub) => sub.href !== null);
        if (filteredSubs.length > 0) {
          allItems.push({ ...item, subItems: filteredSubs });
        }
      } else {
        const href = fromOwnMatrix ? item.href : resolveHref(item.id, item.href);
        if (href === null) continue;
        allItems.push({ ...item, href });
      }
    }
  };

  collect(ownItems, true);
  for (const items of otherItems) collect(items, false);
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
    fetchSwrJson("/api/announcements", (data) => {
      // Only keep pinned, non-archived announcements for the banner
      setPinnedAnnouncements(
        (data.announcements || []).filter(
          (a) => a.is_pinned && !a.is_archived,
        ),
      );
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const recipientId =
      parsedUser.role === "super_admin"
        ? "sa"
        : parsedUser.cid || parsedUser.id;
    fetchSwrJson(`/api/notifications?recipient_id=${recipientId}`, (data) => {
      setNotifications(data.notifications || []);
      setUnreadCount(
        (data.notifications || []).filter((n) => !n.is_read).length,
      );
    });
  }, []);

  // ── Fetch actual unread message count (not from notifications) ──
  const fetchUnreadMessageCount = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const cid = parsedUser.cid || parsedUser.id;
    if (!cid) return;
    fetchSwrJson(`/api/internal-comms?cid=${cid}`, (data) => {
      const seenAt = readSeenWatermark(SEEN_KEYS.messages);
      const myMessages = data.messages.filter(
        (m) =>
          String(m.recipient_id) === String(cid) &&
          (m.is_read === 0 || m.is_read === null) &&
          isNewerThan(m.created_at, seenAt),
      );
      setUnreadMessageCount(myMessages.length);
    });
  }, []);

  // ── Fetch pending user approvals count ──
  const fetchPendingUsersCount = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    if (parsedUser.role !== "super_admin") return;
    fetchSwrJson("/api/admin/pending-users", (data) => {
      const seenAt = readSeenWatermark(SEEN_KEYS.pendingUsers);
      setPendingUsersCount(
        (data.users || data.pendingUsers || []).filter(
          (u) => u.status === "pending" && isNewerThan(u.created_at, seenAt),
        ).length,
      );
    });
  }, []);

  // ── Fetch pending submission count for PM ──
  const [submissionCount, setSubmissionCount] = useState(0);
  const fetchSubmissionCount = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    if (parsedUser.role !== "program_manager") return;
    const pmId = parsedUser.cid || parsedUser.id;
    if (!pmId) return;
    fetchSwrJson(
      `/api/pm/submissions?assigned_pm_id=${encodeURIComponent(pmId)}`,
      (data) => {
        const seenAt = readSeenWatermark(SEEN_KEYS.submissions);
        const pending = (data.submissions || []).filter(
          (s) => s.status === "pending" && isNewerThan(s.created_at, seenAt),
        ).length;
        setSubmissionCount(pending);
      },
    );
  }, []);

  // When a PM opens the submissions page (or a program's submissions tab),
  // remember the visit so the sidebar "programs" badge only counts submissions
  // that arrived after that point.
  const markSubmissionsSeen = useCallback(() => {
    writeSeenWatermark(SEEN_KEYS.submissions);
    fetchSubmissionCount();
  }, [fetchSubmissionCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname || !pathname.startsWith("/pm/submissions")) return;
    try {
      const savedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (savedUser?.role !== "program_manager") return;
    } catch (_) {
      return;
    }
    markSubmissionsSeen();
  }, [pathname, markSubmissionsSeen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSeen = () => {
      try {
        const savedUser = JSON.parse(localStorage.getItem("user") || "null");
        if (savedUser?.role !== "program_manager") return;
      } catch (_) {
        return;
      }
      markSubmissionsSeen();
    };
    window.addEventListener("pm:submissions-seen", onSeen);
    return () => window.removeEventListener("pm:submissions-seen", onSeen);
  }, [markSubmissionsSeen]);

  // Clear the other sidebar badges when the user visits their page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname) return;
    const p = pathname;

    const messagesPage =
      p === "/admin/internal-comms" || p.endsWith("/messages");
    if (messagesPage) {
      writeSeenWatermark(SEEN_KEYS.messages);
      fetchUnreadMessageCount();
    }
    if (p.startsWith("/admin/pending-users")) {
      writeSeenWatermark(SEEN_KEYS.pendingUsers);
      fetchPendingUsersCount();
    }
    if (p.startsWith("/admin/communications/announcements")) {
      writeSeenWatermark(SEEN_KEYS.announcements);
      fetchNotifications();
    }
    if (p.startsWith("/admin/communications/forms")) {
      writeSeenWatermark(SEEN_KEYS.forms);
      fetchNotifications();
    }
  }, [
    pathname,
    fetchNotifications,
    fetchUnreadMessageCount,
    fetchPendingUsersCount,
  ]);

  const fetchPendingInvites = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const cid = parsedUser.cid || parsedUser.id;
    if (!cid) return;
    fetchSwrJson(
      `/api/projects/invitations?invitee_id=${cid}&status=pending`,
      (data) => setPendingInvites(data.invitations || []),
    );
  }, []);

  const fetchPendingAssignments = useCallback(async () => {
    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;
    let parsedUser;
    try {
      parsedUser = JSON.parse(savedUser);
    } catch {
      return;
    }
    const cid = parsedUser.cid || parsedUser.id;
    if (!cid) return;
    fetchSwrJson(
      `/api/tasks/assignments?assignee_id=${cid}&status=pending`,
      (data) => setPendingAssignments(data.assignments || []),
    );
  }, []);

  // Listen for manual refresh events from approve actions
  useEffect(() => {
    const onRefresh = () => {
      fetchNotifications();
      fetchSubmissionCount();
      fetchPendingInvites();
      fetchPendingAssignments();
      fetchAnnouncements();
      fetchUnreadMessageCount();
      fetchPendingUsersCount();
    };
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
  }, [
    fetchNotifications,
    fetchSubmissionCount,
    fetchPendingInvites,
    fetchPendingAssignments,
    fetchAnnouncements,
    fetchUnreadMessageCount,
    fetchPendingUsersCount,
  ]);

  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState({});
  const [authChecked, setAuthChecked] = useState(false);
  const [pmPrograms, setPmPrograms] = useState([]);
  // null = unknown (show by default), false = hide "My Learning"
  const [hasLmsEnrollments, setHasLmsEnrollments] = useState(null);

  // Fast path: restore the cached session synchronously before first paint so
  // navigating between pages doesn't flash an empty screen while initAuth()
  // re-validates against the server in the background.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    // In-memory session (set by initAuth) is fresher than localStorage and
    // survives navigation remounts — restore from it instantly while initAuth
    // revalidates in the background.
    const s = getDashboardSession();
    if (s) {
      if (s.user) setUser(s.user);
      if (s.responsibilities) setUserResponsibilities(s.responsibilities);
      setAuthChecked(true);
      return;
    }
    try {
      const cached = localStorage.getItem("user");
      if (cached) {
        setUser(JSON.parse(cached));
        setAuthChecked(true);
      }
    } catch (_) {}
  }, []);
  // Effective capability matrix for visibility projection (server remains authoritative).
  const [effectiveCaps, setEffectiveCaps] = useState(null);

  // Load the current user's effective permissions once (resolver-cached server-side).
  useEffect(() => {
    let alive = true;
    fetch("/api/me/permissions")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.success) setEffectiveCaps(d.effective || null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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
          setDashboardSession({ user: userWithFullData });
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
                setDashboardSession({ user: updatedUser });
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
                const current = getDashboardSession() || {};
                setDashboardSession({
                  ...current,
                  responsibilities: respData.responsibilities || [],
                });
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
          // Pre-fetch pending invitations & task assignments for banners
          fetchPendingInvites();
          fetchPendingAssignments();
        } else {
          // Session API failed — fallback to localStorage
          const savedUser = localStorage.getItem("user");
          if (savedUser) {
            setUser(JSON.parse(savedUser));
            setDashboardSession({ user: JSON.parse(savedUser) });
          }
        }
      } catch (e) {
        // Network error — fallback to localStorage
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          setUser(JSON.parse(savedUser));
          setDashboardSession({ user: JSON.parse(savedUser) });
        }
      } finally {
        setAuthChecked(true);
      }
    }
    initAuth();
  }, []);

  // Fetch PM programs when user changes or when the user is acting in the PM
  // context (e.g. a staff member assigned as Program Manager on /pm/*).
  useEffect(() => {
    if (!user.cid && !user.id) return;
    const inPmContext = (pathname || "").startsWith("/pm");
    if (
      !inPmContext &&
      user.role !== "program_manager" &&
      user.role !== "super_admin"
    ) {
      return;
    }
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
  }, [user.role, user.cid, user.id, pathname]);

  // "My Learning" only appears once the participant has subscribed to a course
  // or been assigned one (admin/program enrollment). The flag is refreshed on
  // every navigation inside the participant context so the entry appears as
  // soon as an enrollment exists. null (unknown) keeps the entry visible
  // instead of flashing it off for learners who are enrolled.
  useEffect(() => {
    const sessionRole = user.role || role || "";
    const participantNavActive =
      contextRoleFromPathname(pathname) === "participant" ||
      sessionRole === "participant";
    if (
      sessionRole === "super_admin" ||
      sessionRole === "developer" ||
      !participantNavActive
    ) {
      setHasLmsEnrollments(null);
      return;
    }
    let active = true;
    fetch("/api/lms/my-learning?exists=1")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setHasLmsEnrollments(data && data.success ? !!data.enrolled : null);
      })
      .catch(() => {
        if (active) setHasLmsEnrollments(null);
      });
    return () => {
      active = false;
    };
  }, [user.role, user.cid, user.id, pathname, role]);

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
  //   Object.keys(ROLE_ACCESS).forEach((role) => checkItems(buildRoleNav(role)));
  //   setOpenMenus((prev) => ({ ...prev, ...toOpen }));
  // }, [pathname]);

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
    const announcementsSeenAt = readSeenWatermark(SEEN_KEYS.announcements);
    const formsSeenAt = readSeenWatermark(SEEN_KEYS.forms);
    for (const n of notifications) {
      if (!n.is_read) {
        if (
          n.type === "announcement" &&
          isNewerThan(n.created_at, announcementsSeenAt)
        ) {
          counts.announcements++;
        }
        if (n.type === "form" && isNewerThan(n.created_at, formsSeenAt)) {
          counts.forms++;
        }
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

  // Personal relationships (program participation + venture membership) —
  // these drive the personal sidebar so it reflects actual membership, not
  // the legacy contact.role string.
  const [relationships, setRelationships] = useState(null);
  useEffect(() => {
    if (!user.cid) return;
    let alive = true;
    fetch("/api/me/relationships")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.success) setRelationships(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.cid]);

  const navItems = useMemo(() => {
    // Priority: page context > user.role (from session) > role (from prop) > fallback 'admin'.
    // The sidebar follows the page context so a user acting under another role
    // (e.g. a staff member assigned as Program Manager) sees that role's nav
    // while on its pages. Super Admin and developer always keep their own.
    const sessionRole = user.role || role || "admin";
    const activeRole =
      sessionRole === "super_admin" || sessionRole === "developer"
        ? sessionRole
        : contextRoleFromPathname(pathname) || sessionRole;

    // "My Learning" is hidden until the participant actually has a course
    // (self-subscribed, admin enrollment or program assignment). hasLmsEnrollments
    // is null while unknown, so the entry never flickers off for enrolled users.
    const hideMyLearning =
      activeRole === "participant" && hasLmsEnrollments === false;
    const gateMyLearning = (items) =>
      hideMyLearning ? items.filter((i) => i.id !== "learning") : items;

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
          id: "communication",
          name: "COMMUNICATION",
          icon: MessageSquare,
          subItems: [
            {
              id: "messages",
              name: "MESSAGING",
              icon: Send,
              href: "/staff/messages",
            },
          ],
        },
      ];
    }

    const matrix = buildRoleNav(activeRole);
    const bypass = RESPONSIBILITY_BYPASS_ROLES.includes(activeRole);

    // Personal roles: sidebar is relationship-driven (Phase 1). A person with
    // no program and no venture sees only Dashboard; programs/certificates
    // appear only for participants, ventures only for venture members.
    const PERSONAL_ROLES = ["member", "founder", "participant", "team"];
    if (PERSONAL_ROLES.includes(activeRole)) {
      const rel = relationships || {
        isProgramParticipant: false,
        isVentureMember: false,
        ventures: [],
      };
      const homeRole = sessionRole || activeRole;
      const dashboardHref =
        homeRole === "team"
          ? "/team"
          : homeRole === "participant"
            ? "/participant"
            : "/workspaces";
      const items = [
        { id: "dashboard", name: "DASHBOARD", icon: LayoutDashboard, href: dashboardHref },
      ];
      if (rel.isProgramParticipant) {
        items.push({ id: "programs", name: "MY PROGRAMS", icon: Briefcase, href: "/participant/dashboard" });
        items.push({ id: "certificates", name: "MY CERTIFICATES", icon: FileText, href: "/participant/certificates" });
      }
      if (rel.isVentureMember) {
        items.push({ id: "ventures", name: "MY VENTURES", icon: Rocket, href: "/participant/ventures" });
      }
      return items;
    }

    // If user has responsibilities assigned, build nav from responsibilities
    // across ALL role views instead of just the user's role view
    if (!bypass && userResponsibilities && userResponsibilities.length > 0) {
      const respKeys = new Set(userResponsibilities.map((r) => r.key));
      return gateMyLearning(attachIcons(buildNavFromResponsibilities(respKeys, activeRole)));
    }

    // Fallback: role view (backward compatible)
    const items = attachIcons(matrix);

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

    const base = filterNavByResponsibilities(items, userResponsibilities, bypass);
    // Capability projection (visibility only — the server remains authoritative).
    // Currently applies to staff (incl. PM-as-staff); other roles pass through.
    const projected = projectNavForCapabilities(base, effectiveCaps, activeRole);
    // "My Learning" is hidden for participants who have no course enrollment.
    return gateMyLearning(attachIcons(projected));
  }, [
    user.role,
    user.groups,
    role,
    pmPrograms,
    userResponsibilities,
    pathname,
    hasLmsEnrollments,
    effectiveCaps,
  ]);

  // Active navigation path — the current page plus every ancestor node id.
  const activePathIds = useMemo(
    () => getActivePathIds(navItems, pathname),
    [navItems, pathname],
  );
  const activePathKey = useMemo(
    () => [...(activePathIds || [])].join("|"),
    [activePathIds],
  );

  // Auto-expand the active route's ancestors and close everything else, so
  // only the section(s) containing the current page stay open (accordion).
  useEffect(() => {
    if (!activePathKey) return;
    const ids = activePathKey.split("|").filter(Boolean);
    setOpenMenus((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (!ids.includes(key)) {
          next[key] = false;
          changed = true;
        }
      }
      for (const id of ids) {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activePathKey]);

  // Accordion toggle: opening one section closes the other click-opened ones,
  // except sections on the active path (they stay as context). Defined AFTER
  // activePathIds — referencing it in the dependency array before its
  // declaration would hit the const temporal dead zone (build crash).
  const toggleMenu = useCallback(
    (id) => {
      if (!id) return;
      setOpenMenus((prev) => {
        const next = { ...prev };
        if (next[id]) {
          next[id] = false;
          return next;
        }
        for (const key of Object.keys(next)) {
          if (key !== id && !activePathIds.has(key)) next[key] = false;
        }
        next[id] = true;
        return next;
      });
    },
    [activePathIds],
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    }
    localStorage.clear();
    setDashboardSession(null);
    router.replace("/login");
  };

  const activeRole =
    user.role === "super_admin" || user.role === "developer"
      ? user.role
      : contextRoleFromPathname(pathname) || user.role || role || "admin";
  const commonProps = {
    collapsed,
    role: activeRole,
    user,
    navItems,
    openMenus,
    toggleMenu,
    pathname,
    activePathIds,
    setMobileMenuOpen,
    handleLogout,
    t,
    submissionCount,
    unreadByType,
    hasCommunicationActivity,
  };

  // The CRM contacts grid renders edge-to-edge; preserve that behavior now
  // that the shell lives in the layout instead of the page.
  const isFullWidth =
    fullWidth ||
    (typeof pathname === "string" &&
      pathname.startsWith("/admin/communications/contacts"));

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
              {/* Context Switcher — navigate between legitimate contexts (Phase 2C) */}
              <ContextSwitcher />
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
                                  className="flex-1 py-1 px-2 bg-emerald-500 text-white rounded text-[10px] font-bold uppercase"
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
                                  className="flex-1 py-1 px-2 bg-slate-600 text-white rounded text-[10px] font-bold uppercase"
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
                                  className="flex-1 py-1 px-2 bg-emerald-500 text-white rounded text-[10px] font-bold uppercase"
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
                                  className="flex-1 py-1 px-2 bg-slate-600 text-white rounded text-[10px] font-bold uppercase"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] opacity-40 py-4 text-center">
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
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    STAGING ENVIRONMENT — Impersonating: {user?.name || "Unknown"} ({user?.role || "unknown"})
                  </p>
                  <p className="text-[10px] font-medium text-amber-500/70 mt-0.5">
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
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
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
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-600 transition-all"
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
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-slate-500 transition-all"
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
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-600 transition-all"
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
                    className="px-4 py-2 bg-slate-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-slate-500 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
            <div className={isFullWidth ? "w-full animate-in" : "max-w-[1400px] mx-auto animate-in"}>{children}</div>
          </main>
          {modals}
          <GlobalToast />
        </div>
      </div>
    </AppErrorBoundary>
  );
}
