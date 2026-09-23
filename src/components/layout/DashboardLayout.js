"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import {
  getDashboardSession,
  getDashboardSessionUser,
  setDashboardSession,
  subscribeDashboardSession,
} from "@/lib/dashboardSession";
import {
  Sun,
  Moon,
  Monitor,
  ChevronsLeft,
  ChevronsRight,
  Users,
  LayoutDashboard,
  Briefcase,
  Calendar,
  User,
  MessageSquare,
  LogOut,
  Bell,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  FileText,
  ShieldCheck,
  Menu,
  Rocket,
  Send,
  Library,
  Globe,
  BarChart3,
  ListTodo,
  ClipboardList,
  Wrench,
  CheckSquare,
  Megaphone,
  Clock,
  GraduationCap,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import GlobalToast from "@/components/ui/GlobalToast";
import AppErrorBoundary from "@/components/ui/AppErrorBoundary";
import ContextSwitcher from "@/components/layout/ContextSwitcher";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { fetchSwrJson, useApi } from "@/lib/hooks/useApi";
import { buildAccessNav } from "@/lib/masterNavigation";
import {
  HOVER_CAPABLE_QUERY,
  canUseHoverIntent,
  resolveSectionExpanded,
  nextExplicitState,
} from "@/components/layout/sidebarMenu";
import { PermissionProvider, usePermissions } from "@/lib/PermissionProvider";

// LocalStorage keys that remember when the user last viewed a given page,
// so sidebar badges only count items that arrived after that visit.
const SEEN_KEYS = {
  submissions: "impactos_pm_submissions_seen_at",
  messages: "impactos_messages_seen_at",
  pendingUsers: "impactos_pending_users_seen_at",
  announcements: "impactos_announcements_seen_at",
  forms: "impactos_forms_seen_at",
};

// The bell opens a GLANCE, not an inbox: only this many unread rows are listed
// at once, and "Show more" reveals the rest in place rather than making the
// header panel grow with the inbox.
const NOTIFICATIONS_PREVIEW = 3;

// The badge's own rhythm, and the floor under every automatic re-read: the
// inbox is one shared read, and no combination of triggers may ask for it more
// often than this.
const NOTIFICATIONS_POLL_MS = 10_000;
const NOTIFICATIONS_MIN_INTERVAL_MS = 10_000;

const readSeenWatermark = (key) => {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(key);
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
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
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return timestamp > watermark;
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
  sessions: "navigation.sessions",
  reviews: "navigation.reviews",
  assignments: "navigation.assignments",
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
  journey_reports: "navigation.journeyReports",
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
  crm_membership: "navigation.membership",
  permissions: "navigation.permissions",
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

// Map last path segment -> translation key for the topbar breadcrumb.
// Keys must be unique: a duplicated key silently wins over the earlier one.
// When one segment means different things under different parents (e.g.
// /admin/reports/responses vs /platform/responses) disambiguate in
// CRUMB_FULL_PATH_MAP below instead of adding a second entry here.
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
  membership: "navigation.groups",
  permissions: "navigation.permissions",
  system: "navigation.system",
  profile: "navigation.profile",
  messages: "navigation.messages",
  notifications: "navigation.notifications",
  sessions: "navigation.sessions",
  reviews: "navigation.reviews",
  assignments: "navigation.assignments",
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
  groups: "navigation.groups",
  submissions: "navigation.submissions",
};

// Exact-path overrides, checked before CRUMB_PATH_MAP so a segment that means
// different things in different sections still resolves to the right crumb.
const CRUMB_FULL_PATH_MAP = {
  "/admin/reports/responses": "navigation.reportResponses",
  "/platform/responses": "navigation.forms",
};

function navCrumb(pathname) {
  const clean = (pathname || "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
  if (CRUMB_FULL_PATH_MAP[clean]) return CRUMB_FULL_PATH_MAP[clean];
  const segment = clean.split("/").filter(Boolean).pop() || "";
  return CRUMB_PATH_MAP[segment] || (NAV_KEY_MAP[segment] ? NAV_KEY_MAP[segment] : segment);
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
      const childItems = item.children || item.subItems;
      if (childItems && childItems.length > 0) {
        visit(childItems, nextChain);
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
  setCollapsed,
  role,
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
  const profileHref = `/${role === "super_admin" ? "admin" : role === "program_manager" ? "pm" : role === "facilitator" ? "facilitator" : role === "investor" ? "investor" : "participant"}/profile`;

  const [flyout, setFlyout] = useState(null); // { id, top } — collapsed-rail flyout
  const flyoutTimer = useRef(null);
  // Hover-expand state (expanded sidebar): a SINGLE hover target at a time —
  // hovering the next section collapses the previous one (accordion).
  const [hoverMenu, setHoverMenu] = useState(null);
  const hoverTimer = useRef(null);
  // Sections the user closed by clicking. An explicit close must win over the
  // hover intent until the pointer leaves (otherwise "collapse" looks broken).
  const [closedByClick, setClosedByClick] = useState(null);

  // Touch devices fire mouseenter on tap, so hover intent would re-open a
  // section the user just closed. Unknown capability = keep desktop behaviour.
  const pointerCanHover = () =>
    canUseHoverIntent(
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(HOVER_CAPABLE_QUERY).matches
        : undefined,
    );

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

  const openFlyout = (event, id) => {
    clearTimeout(flyoutTimer.current);
    setFlyout({ id, top: event.currentTarget.getBoundingClientRect().top });
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
      // The pointer left: a previous explicit close no longer applies.
      setClosedByClick((prev) => (prev === id ? null : prev));
    }, 200);
  };
  // Click on a section header: store the explicit state and remember whether
  // this click was a close, so the hover cannot immediately undo it.
  const toggleSection = (id) => {
    const willOpen = nextExplicitState(openMenus[id]);
    toggleMenu(id);
    setClosedByClick(willOpen ? null : id);
  };
  // A section stays expanded while the hover target is itself or any of its
  // descendants — hovering a nested parent keeps its ancestors open.
  const isHoverTarget = (item, id) => {
    if (!id) return false;
    if (item.id === id) return true;
    const childItems = item.children || item.subItems;
    return !!childItems && childItems.some((childItem) => isHoverTarget(childItem, id));
  };

  // Recursive nav renderer: a node with children renders as an expandable
  // group; a node without children renders as a link (leaf). showLabels forces
  // labels/chevrons visible even when the rail is collapsed (flyout usage).
  const renderNavItem = (item, depth, showLabels) => {
    const childItems = item.children || item.subItems;
    const hasKids = Array.isArray(childItems) && childItems.length > 0;
    const isTop = depth === 0;
    const onPath = activePathIds.has(item.id);
    const show = !collapsed || showLabels;

    if (hasKids) {
      const isOpen = openMenus[item.id] || false;
      const expanded = resolveSectionExpanded({
        open: isOpen,
        hovered: isHoverTarget(item, hoverMenu),
        closedByClick: closedByClick === item.id,
      });
      return (
        <div
          key={item.id}
          className="space-y-1"
          onMouseLeave={
            collapsed ? undefined : () => scheduleHoverClose(item.id)
          }
        >
          <button
            onClick={() => toggleSection(item.id)}
            aria-expanded={expanded}
            onMouseEnter={
              collapsed && !showLabels
                ? (event) => openFlyout(event, item.id)
                : collapsed
                  ? undefined
                  : () => {
                      if (pointerCanHover()) scheduleHoverOpen(item.id);
                    }
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
              {childItems.map((childItem) => renderNavItem(childItem, depth + 1, showLabels))}
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
      <div
        className={`px-3 mb-14 mt-4 ${
          collapsed ? "flex flex-col items-center gap-3" : "flex items-center gap-4"
        }`}
      >
        {collapsed ? (
          <Image
            src="/icon-192x192.png"
            alt="Future Studio"
            width={192}
            height={192}
            className="w-8 h-8 object-contain"
          />
        ) : (
          <Image
            src="/brand/logo_full.png"
            alt="Future Studio"
            width={1018}
            height={1024}
            className="h-8 w-auto object-contain animate-in fade-in"
          />
        )}
        {/* The rail can always be reopened, so the control is present in both
            widths: beside the logo when open, under the mark when collapsed. */}
        <button
          type="button"
          onClick={() => setCollapsed((previousCollapsed) => !previousCollapsed)}
          aria-label={t(
            collapsed ? "navigation.expandSidebar" : "navigation.collapseSidebar",
          )}
          title={t(
            collapsed ? "navigation.expandSidebar" : "navigation.collapseSidebar",
          )}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-colors ${
            collapsed ? "" : "ml-auto"
          }`}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <ChevronsLeft className="w-4 h-4" />
          )}
        </button>
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
        const parent = (navItems || []).find((navItem) => navItem.id === flyout.id);
        if (!parent) return null;
        const childItems = parent.children || parent.subItems || [];
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
            {childItems.map((childItem) => renderNavItem(childItem, 1, true))}
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

/**
 * The role that drives the shell + sidebar. It is ALWAYS the connected user's
 * session role; the section layout's `role` prop is only a pre-session
 * fallback (before the cached/server session supplies `user.role`). The visited
 * page never contributes a role — a staff member on /crm stays staff.
 */
function shellRole(userRole, role) {
  return userRole || role || "super_admin";
}

// ─── The identity the shell paints with ─────────────────────────────────────
//
// It comes from the shared session store: the session this shell has already
// published (an in-memory store that survives a remount, so navigating costs no
// re-fetch), or — on a cold load, before the session has answered — the browser's
// stored copy. Reading it through a SUBSCRIPTION is what removes the effect that
// used to copy it into state, and with it the cascaded render that copy caused.
// The server snapshot is deliberately absent, so the server's render and the
// browser's first render agree and the identity arrives on the client's own read.
const EMPTY_USER = {};

function getShellUserSnapshot() {
  return getDashboardSessionUser();
}

function getShellUserServerSnapshot() {
  return null;
}

// Roles whose shell is a PERSONAL surface (a person, not a staff function).
// Their sidebar is relationship-driven and their learning door is derived from
// an actual course enrollment, never from the role string.
const PERSONAL_ROLES = ["member", "founder", "participant", "team"];

/** Whether the connected person actually holds at least one course enrollment. */
const pickLmsEnrollment = (payload) => (payload && payload.success ? !!payload.enrolled : false);

function DashboardLayoutInner({ children, role = "super_admin", modals, fullWidth = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  // The sections the person opened or closed BY HAND, recorded together with the
  // route they were on. Nothing else about the accordion is state: the effective
  // map is derived below, so a navigation no longer needs an effect to settle it.
  const [menuToggles, setMenuToggles] = useState({ key: null, map: {} });
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { lang, t, switchLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  // When the inbox was last read — shared by every trigger through
  // fetchNotifications, so they throttle each other instead of each keeping
  // their own idea of "recently".
  const lastInboxReadAt = useRef(0);

  const fetchAnnouncements = useCallback(async () => {
    fetchSwrJson("/api/announcements", (data) => {
      // Only keep pinned, non-archived announcements for the banner
      setPinnedAnnouncements(
        (data.announcements || []).filter(
          (announcement) => announcement.is_pinned && !announcement.is_archived,
        ),
      );
    });
  }, []);

  // The inbox is read by several triggers — the timer below, a return to the
  // tab, a refresh event, the panel reopening — and each re-read is a full
  // server round trip (~590 ms measured). They share ONE read per
  // NOTIFICATIONS_MIN_INTERVAL_MS, so a burst of triggers can never become a
  // burst of requests, and a hidden tab asks for nothing at all (it re-asks
  // when it comes back, which is wired below). A read that a user action must
  // show immediately — marking a row read, answering an invitation — passes
  // `force`.
  const fetchNotifications = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force) {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (now - lastInboxReadAt.current < NOTIFICATIONS_MIN_INTERVAL_MS) return;
    }
    lastInboxReadAt.current = now;
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
      const rows = data.notifications || [];
      setNotifications(rows);
      // The badge is the server's own COUNT of unread rows, not the length of
      // this page of rows: the list is limited (50), so a list-derived badge
      // under-reports a big inbox and can only shrink when those 50 are read.
      setUnreadCount(
        typeof data.unread_count === "number"
          ? data.unread_count
          : rows.filter((row) => !row.is_read).length,
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
    const userCid = parsedUser.cid || parsedUser.id;
    if (!userCid) return;
    fetchSwrJson(`/api/internal-comms?cid=${userCid}`, (data) => {
      const seenAt = readSeenWatermark(SEEN_KEYS.messages);
      const myMessages = data.messages.filter(
        (message) =>
          String(message.recipient_id) === String(userCid) &&
          (message.is_read === 0 || message.is_read === null) &&
          isNewerThan(message.created_at, seenAt),
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
          (user) => user.status === "pending" && isNewerThan(user.created_at, seenAt),
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
          (submission) => submission.status === "pending" && isNewerThan(submission.created_at, seenAt),
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
    const currentPath = pathname;

    const messagesPage =
      currentPath === "/admin/internal-comms" || currentPath.endsWith("/messages");
    if (messagesPage) {
      writeSeenWatermark(SEEN_KEYS.messages);
      fetchUnreadMessageCount();
    }
    if (currentPath.startsWith("/admin/pending-users")) {
      writeSeenWatermark(SEEN_KEYS.pendingUsers);
      fetchPendingUsersCount();
    }
    if (currentPath.startsWith("/admin/communications/announcements")) {
      writeSeenWatermark(SEEN_KEYS.announcements);
      fetchNotifications();
    }
    if (currentPath.startsWith("/admin/communications/forms")) {
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
    const userCid = parsedUser.cid || parsedUser.id;
    if (!userCid) return;
    fetchSwrJson(
      `/api/projects/invitations?invitee_id=${userCid}&status=pending`,
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
    const userCid = parsedUser.cid || parsedUser.id;
    if (!userCid) return;
    fetchSwrJson(
      `/api/tasks/assignments?assignee_id=${userCid}&status=pending`,
      (data) => setPendingAssignments(data.assignments || []),
    );
  }, []);

  // Listen for manual refresh events from approve actions
  useEffect(() => {
    const onRefresh = () => {
      // A refresh event is automatic: it respects the same floor as the timer,
      // so a screen that emits several of them reads the inbox once.
      const now = Date.now();
      if (now - lastInboxReadAt.current < NOTIFICATIONS_MIN_INTERVAL_MS) return;
      lastInboxReadAt.current = now;
      fetchNotifications({ force: true });
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

  // An unread badge is only worth showing if it is CURRENT. The shell used to ask
  // once, so the number stayed frozen for the whole session: reading a
  // notification in another tab (or on any page that marks one read) left the
  // bell claiming the old total, and it never came down on its own. It now polls,
  // and re-asks whenever the tab returns to the foreground.
  useEffect(() => {
    const poll = setInterval(fetchNotifications, NOTIFICATIONS_POLL_MS);
    const onForeground = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, [fetchNotifications]);

  const { theme, setTheme } = useTheme();
  const user = useSyncExternalStore(
    subscribeDashboardSession,
    getShellUserSnapshot,
    getShellUserServerSnapshot,
  ) || EMPTY_USER;

  // "We know who is signed in, or we have finished asking." The store answers the
  // first half during render; the second is settled when the session request has
  // answered, which is a write from that request's own continuation rather than
  // from an effect body.
  const [authSettled, setAuthSettled] = useState(false);
  const authChecked = Boolean(user.cid) || authSettled;

  // The ONE writer of the identity. It publishes to the store — preserving the
  // fields other surfaces put there, such as the capability matrix — and keeps
  // the browser's copy in step for the components that still read it.
  const publishUser = useCallback((next) => {
    const current = getDashboardSession() || {};
    setDashboardSession({ ...current, user: next });
    try {
      localStorage.setItem("user", JSON.stringify(next));
    } catch {
      // A browser with storage disabled keeps the identity for this load only.
    }
  }, []);
  const [pmPrograms, setPmPrograms] = useState([]);
  // Whether the connected person holds at least one usable course enrollment.
  // true = show the "My Learning" door; false/null = hidden (known to be
  // false, or the server has not answered yet).
  // The learner door is derived from the enrolment read above and from nothing
  // else, so there is no state here to keep in step with it.

  // Effective capability matrix for sidebar visibility, read ONCE for the whole
  // surface from the shared permission context (the server remains
  // authoritative). Every gated affordance under this shell reads the same
  // value instead of firing its own request.
  const { permissions: effectiveCaps } = usePermissions();

  // The capabilities are restored by PermissionProvider (which mounts above this
  // shell) — the sidebar reads them from that context.

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
          publishUser(userWithFullData);

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
                publishUser(updatedUser);
              }
            } catch (_) {}
          }

          // Responsibilities
          if (respRes.status === "fulfilled") {
            try {
              const respData = await respRes.value.json();
              if (respData.success) {
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
                setUnreadCount(
                  typeof notifData.unread_count === "number"
                    ? notifData.unread_count
                    : (notifData.notifications || []).filter((notification) => !notification.is_read).length,
                );
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
            publishUser(JSON.parse(savedUser));
          }
        }
      } catch {
        // Network error — fallback to localStorage
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          publishUser(JSON.parse(savedUser));
        }
      } finally {
        setAuthSettled(true);
      }
    }
    initAuth();
    // Every one of these is a stable callback (an empty dependency array), so
    // naming them here does not re-run the bootstrap; without them the analyser
    // cannot tell.
  }, [
    fetchAnnouncements,
    fetchPendingAssignments,
    fetchPendingInvites,
    fetchPendingUsersCount,
    fetchUnreadMessageCount,
    publishUser,
  ]);

  // Fetch PM programs for program_manager / super_admin roles.
  useEffect(() => {
    if (!user.cid && !user.id) return;
    if (user.role !== "program_manager" && user.role !== "super_admin") {
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
      .catch((error) => console.error(error));
  }, [user.role, user.cid, user.id]);

  // "My Learning" only appears once the learner actually holds a course
  // (self-subscribed, admin enrollment or program assignment). The shell asks on
  // every PERSONAL surface — not only for the `participant` role — because a
  // course subscriber belongs to no program, so the relationship-driven sidebar
  // would leave them with a dashboard-only menu. Staff-side surfaces open the
  // course library from their capabilities instead (buildAccessNav).
  //
  // The read is addressed ON THE ROLE, so a surface that is not personal has no
  // address at all: no request is made and the door is hidden, which is what the
  // synchronous write this replaces was expressing. `pathname` is a dependency
  // rather than part of the address, so navigating inside the shell re-asks —
  // the door then opens as soon as an enrollment exists (e.g. right after
  // subscribing to a course from another page), and a failed request heals on
  // the next click instead of staying hidden.
  const sessionRole = shellRole(user.role, role);
  const { data: hasLmsEnrollments } = useApi(
    PERSONAL_ROLES.includes(sessionRole) ? "/api/lms/my-learning?exists=1" : null,
    { defaultValue: false, transform: pickLmsEnrollment, deps: [pathname] },
  );

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
    for (const notification of notifications) {
      if (!notification.is_read) {
        if (
          notification.type === "announcement" &&
          isNewerThan(notification.created_at, announcementsSeenAt)
        ) {
          counts.announcements++;
        }
        if (notification.type === "form" && isNewerThan(notification.created_at, formsSeenAt)) {
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
      .then((response) => response.json())
      .then((payload) => {
        if (alive && payload.success) setRelationships(payload);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.cid]);

  // Staff Venture console visibility (Phase 3): delegated staff see the
  // Ventures entry ONLY when they hold at least one active Venture assignment.
  const [ventureAssignCount, setVentureAssignCount] = useState(null);
  useEffect(() => {
    if (!user.cid) return;
    if (!["staff", "program_manager"].includes(user.role)) return;
    let alive = true;
    fetch("/api/ventures/assigned")
      .then((response) => response.json())
      .then((payload) => {
        if (alive) setVentureAssignCount((payload.assignments || []).length);
      })
      .catch(() => setVentureAssignCount(0));
    return () => {
      alive = false;
    };
  }, [user.cid, user.role]);

  const navItems = useMemo(() => {
    // The sidebar reflects the CONNECTED user: their role, and — via the
    // capability projection in buildAccessNav — everything their
    // responsibilities actually grant them. It never changes with the page
    // being viewed (see shellRole).
    const activeRole = shellRole(user.role, role);

    // Personal roles: sidebar is relationship-driven (Phase 1). A person with
    // no program and no venture sees only Dashboard; the learner door appears
    // from an actual course enrollment, programs/certificates only for program
    // participants, ventures only for venture members.
    if (PERSONAL_ROLES.includes(activeRole)) {
      const rel = relationships || {
        isProgramParticipant: false,
        isVentureMember: false,
        ventures: [],
      };
      // ONE dashboard per surface: the calendar page. "member" is the
      // baseline identity, not a destination — a member (and a founder, and a
      // participant) all land on /participant and get their contexts as
      // sidebar additions. Only the team surface has a different calendar page.
      const dashboardHref = activeRole === "team" ? "/team" : "/participant";
      const items = [
        { id: "dashboard", name: "DASHBOARD", icon: LayoutDashboard, href: dashboardHref },
      ];
      // The learner door. It opens from an actual enrollment — the LMS decides
      // access server-side — never from belonging to a program: someone who
      // subscribed to a course on the website holds no program and no venture.
      if (hasLmsEnrollments === true) {
        items.push({
          id: "learning",
          name: "MY LEARNING",
          icon: GraduationCap,
          href: "/participant/learning",
        });
      }
      if (rel.isProgramParticipant) {
        items.push({ id: "programs", name: "MY PROGRAMS", icon: Briefcase, href: "/participant/dashboard" });
        items.push({ id: "certificates", name: "MY CERTIFICATES", icon: FileText, href: "/participant/certificates" });
      }
      if (rel.isVentureMember) {
        // A founder's venture door sits with their program doors (the founder
        // nav contract reads Dashboard → Programs → Ventures → Timeline),
        // not buried after every participant item. Team members keep the
        // additive arrangement: their venture door comes last.
        const ventureDoor = { id: "ventures", name: "MY VENTURES", icon: Rocket, href: "/participant/ventures" };
        if (rel.isFounder) {
          const progIndex = items.findIndex((navItem) => navItem.id === "programs");
          items.splice(progIndex === -1 ? 1 : progIndex + 2, 0, ventureDoor);
        } else {
          items.push(ventureDoor);
        }
      }
      return items;
    }

    // SIDEBAR ADDITION — the ventures console appears only when this staff
    // member actually holds venture assignments. Navigation belongs in the
    // sidebar, not on the dashboard: clicking it opens ALL ventures.
    const withVentureConsole = (list) => {
      if (!["staff", "program_manager"].includes(activeRole)) return list;
      if (typeof ventureAssignCount !== "number" || ventureAssignCount <= 0) {
        return list;
      }
      if (list.some((navItem) => navItem.id === "ventures")) return list;
      const dashIndex = list.findIndex((navItem) => navItem.id === "dashboard");
      const insertAt = dashIndex === -1 ? 0 : dashIndex + 1;
      const next = list.slice();
      next.splice(insertAt, 0, {
        id: "ventures",
        name: "MY VENTURES",
        icon: Rocket,
        href: "/staff/ventures",
      });
      return next;
    };

    // The single source of sidebar truth: the role's doors plus every section
    // the user's effective capabilities grant, deduped and href-safe.
    const items = attachIcons(buildAccessNav(activeRole, effectiveCaps));

    if (
      (activeRole === "program_manager" || activeRole === "super_admin") &&
      pmPrograms.length > 0
    ) {
      const progIndex = items.findIndex((navItem) => navItem.id === "programs");
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

    // Staff-side surfaces keep their capability-projected doors; the learner
    // door is added inside the personal branch above.
    return withVentureConsole(items);
  }, [
    user.role,
    role,
    pmPrograms,
    hasLmsEnrollments,
    effectiveCaps,
    ventureAssignCount,
    relationships,
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

  // The accordion: on a new route only the sections containing the current page
  // stay open, and whatever the person toggled ON THAT ROUTE is laid over that.
  // Derived during render, so arriving somewhere costs no state write and cannot
  // cascade a render — and the first paint already has the route's section open.
  const openMenus = useMemo(() => {
    const next = {};
    for (const id of activePathKey.split("|").filter(Boolean)) next[id] = true;
    if (menuToggles.key === activePathKey) {
      for (const [id, open] of Object.entries(menuToggles.map)) next[id] = open;
    }
    return next;
  }, [activePathKey, menuToggles]);

  // Accordion toggle: opening one section closes the other click-opened ones,
  // except sections on the active path (they stay as context). Defined AFTER
  // activePathIds — referencing it in the dependency array before its
  // declaration would hit the const temporal dead zone (build crash).
  const toggleMenu = useCallback(
    (id) => {
      if (!id) return;
      setMenuToggles((prev) => {
        const map = prev.key === activePathKey ? { ...prev.map } : {};
        if (openMenus[id]) {
          map[id] = false;
          return { key: activePathKey, map };
        }
        // Opening one section closes the other hand-opened ones, except the
        // sections on the active path — they stay as context.
        for (const key of Object.keys(map)) {
          if (key !== id && !activePathIds.has(key)) delete map[key];
        }
        map[id] = true;
        return { key: activePathKey, map };
      });
    },
    [activePathKey, activePathIds, openMenus],
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.clear();
    setDashboardSession(null);
    router.replace("/login");
  };

  const activeRole = shellRole(user?.role, role);
  const commonProps = {
    collapsed,
    setCollapsed,
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
            <aside className="absolute inset-y-0 left-0 w-64 flex flex-col overflow-hidden bg-secondary p-6 border-r border-[var(--border-primary)]">
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
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setTheme(option.value);
                            setThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold transition-colors ${
                            theme === option.value
                              ? "text-[var(--brand-orange)] bg-[var(--brand-orange)]/10"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
                          }`}
                        >
                          <option.icon className="w-3.5 h-3.5" />
                          {option.label}
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
                  onClick={() => {
                    // The panel always opens as a SHORT glance, and always on
                    // current rows: opening it re-asks, so the list and the
                    // badge can never disagree with the server.
                    setShowAllNotifications(false);
                    if (!showNotifications) fetchNotifications();
                    setShowNotifications((previousValue) => !previousValue);
                  }}
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
                        (showAllNotifications
                          ? notifications
                          : notifications.slice(0, NOTIFICATIONS_PREVIEW)
                        ).map((notification) => (
                          <div
                            key={notification.id}
                            onClick={async () => {
                              // Mark as read
                              try {
                                await fetch("/api/notifications", {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    id: notification.id,
                                    action: "read",
                                  }),
                                });
                                fetchNotifications({ force: true });
                              } catch (_) {}

                              if (
                                notification.type === "verification" ||
                                notification.title.includes("ACCESS")
                              ) {
                                router.push("/admin/communications/contacts");
                                setShowNotifications(false);
                              }
                              if (notification.type === "message") {
                                const role = user?.role || "";
                                if (role === "super_admin")
                                  router.push("/admin/internal-comms");
                                else if (role === "staff")
                                  router.push("/staff/messages");
                                else if (role === "program_manager")
                                  router.push("/pm/messages");
                                else if (role === "participant")
                                  router.push("/participant/messages");
                                setShowNotifications(false);
                              }
                              if (
                                notification.type === "comment" ||
                                notification.type === "mention"
                              ) {
                                router.push("/staff/op-report");
                                setShowNotifications(false);
                              }
                              if (notification.type === "blocker_discussion") {
                                const role = user?.role || "";
                                if (role === "super_admin")
                                  router.push("/admin/blockers");
                                else router.push("/staff/op-report");
                                setShowNotifications(false);
                              }
                              if (notification.type === "investor" && notification.link) {
                                router.push(notification.link);
                                setShowNotifications(false);
                              }
                            }}
                            className={`p-3 rounded-xl hover:bg-primary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)] group ${!notification.is_read ? "bg-[var(--brand-orange)]/5" : ""}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-black text-[10px] uppercase tracking-tight text-[var(--text-primary)]">
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">
                              {notification.message}
                            </p>
                            {/* Accept/Decline buttons for project invitations */}
                            {notification.type === "project_invite" && (
                              <div
                                className="flex gap-2 mt-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  onClick={async () => {
                                    setPendingInvites([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const userCid = saved.cid || saved.id;
                                      const invRes = await fetch(
                                        `/api/projects/invitations?invitee_id=${userCid}&status=pending`,
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
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
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
                                      const userCid = saved.cid || saved.id;
                                      const invRes = await fetch(
                                        `/api/projects/invitations?invitee_id=${userCid}&status=pending`,
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
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
                                    } catch (_) {}
                                  }}
                                  className="flex-1 py-1 px-2 bg-slate-600 text-white rounded text-[10px] font-bold uppercase"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                            {/* Accept/Decline for task assignments */}
                            {notification.type === "task_assignment" && (
                              <div
                                className="flex gap-2 mt-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  onClick={async () => {
                                    setPendingAssignments([]);
                                    try {
                                      const saved = JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      );
                                      const userCid = saved.cid || saved.id;
                                      const assRes = await fetch(
                                        `/api/tasks/assignments?assignee_id=${userCid}&status=pending`,
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
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
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
                                      const userCid = saved.cid || saved.id;
                                      const assRes = await fetch(
                                        `/api/tasks/assignments?assignee_id=${userCid}&status=pending`,
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
                                          id: notification.id,
                                          action: "read",
                                        }),
                                      });
                                      fetchNotifications({ force: true });
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
                    {notifications.length > NOTIFICATIONS_PREVIEW && (
                      <button
                        onClick={() => setShowAllNotifications((previousValue) => !previousValue)}
                        className="mt-3 w-full text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors"
                      >
                        {t(showAllNotifications ? "common.showLess" : "common.showMore")}
                      </button>
                    )}
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
                {pinnedAnnouncements.map((announcement) => (
                  <div
                    key={announcement.id}
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
                            {announcement.title}
                          </span>
                          {" — "}
                          {announcement.body.length > 120
                            ? announcement.body.substring(0, 117) + "..."
                            : announcement.body}
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
                      You&apos;ve been invited to join{" "}
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
                      You&apos;ve been assigned:{" "}
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

/**
 * The shell mounts its own permission provider: ONE capability read for the
 * whole surface, shared by the sidebar (via usePermissions) and every gated
 * affordance rendered underneath. Consumers outside a DashboardLayout keep
 * working standalone (usePermissions falls back to its own read).
 */
export default function DashboardLayout(props) {
  return (
    <PermissionProvider>
      <DashboardLayoutInner {...props} />
    </PermissionProvider>
  );
}
