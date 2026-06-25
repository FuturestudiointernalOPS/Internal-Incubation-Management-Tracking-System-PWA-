"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Sun,
  Moon,
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
  Wrench,
  CheckSquare,
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
  internal_ops: "navigation.internalOps",
  internal_ops_board: "navigation.internalOpsBoard",
  messages: "navigation.messages",
  communication: "navigation.communication",
  campaigns: "navigation.campaigns",
  forms: "navigation.forms",
  all_contacts: "navigation.contacts",
  knowledge: "navigation.knowledgeBase",
  reports: "navigation.reports",
  report_responses: "navigation.reportResponses",
  internal_reports: "navigation.internalReports",
  settings: "navigation.settings",
  profile: "navigation.profile",
  logout: "navigation.logout",
  projects: "navigation.projects",
  sessions: "navigation.sessions",
  reviews: "navigation.reviews",
  assignments: "navigation.assignments",
  rituals: "navigation.rituals",
  tasks: "reports.tasks",
  blockers: "reports.blockers",
  no_new_intel: "navigation.noNewIntel",
  intel_feed: "navigation.intelFeed",
};

function tnav(key) {
  const mapped = NAV_KEY_MAP[key];
  if (mapped) return mapped;
  return key;
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
}) => {
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
            Main Operations
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
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
                    <item.icon
                      className={`w-4 h-4 flex-shrink-0 ${isChildActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                    />
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
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-bold text-[12px] uppercase tracking-wider ${isActive ? "bg-[var(--brand-orange)] text-white border border-orange-600/20 italic" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-black" : "text-[var(--text-secondary)]"}`}
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
            User Protocol
          </p>
        )}
        <Link
          href={`/${role === "super_admin" ? "admin" : role === "program_manager" ? "pm" : role === "teacher" ? "teacher" : role === "developer" || role === "intern" ? "developer" : "participant"}/profile`}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] ${pathname?.includes("profile") ? "bg-tertiary text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
        >
          <User className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>{t(tnav("profile"))}</span>}
        </Link>
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
      id: "internal_ops",
      name: "Internal Ops",
      icon: ListTodo,
      subItems: [
        { id: "internal_ops_board", name: "WORKSPACE", href: "/admin/work" },
        {
          id: "all_projects",
          name: "PROJECTS",
          href: "/admin/projects",
        },
        {
          id: "create_project",
          name: "CREATE PROJECT",
          href: "/admin/projects?action=create",
        },
        {
          id: "internal_reports",
          name: "REPORTS",
          href: "/admin/op-reports",
        },
      ],
    },

    {
      id: "communication",
      name: "COMMUNICATIONS",
      icon: Send,
      subItems: [
        { id: "messages", name: "MESSAGES", href: "/admin/internal-comms" },
        {
          id: "campaigns",
          name: "CAMPAIGNS",
          href: "/admin/communications/campaigns",
        },
        { id: "forms", name: "FORMS", href: "/admin/communications/forms" },
        {
          id: "all_contacts",
          name: "CONTACTS",
          href: "/admin/communications/contacts",
        },
        {
          id: "pending_users",
          name: "PENDING USERS",
          href: "/admin/pending-users",
        },
        { id: "bulk_upload", name: "BULK UPLOAD", href: "/admin/bulk-upload" },
      ],
    },

    {
      id: "knowledge",
      name: "KNOWLEDGE BASE",
      icon: Library,
      href: "/admin/knowledge",
    },

    {
      id: "intelligence",
      name: "INTELLIGENCE",
      icon: TrendingUp,
      href: "/admin/intelligence",
    },
    {
      id: "finance",
      name: "FINANCE",
      icon: BarChart3,
      href: "/admin/finance",
    },
    {
      id: "metrics",
      name: "HEALTH",
      icon: Activity,
      href: "/admin/metrics",
    },
    {
      id: "engineering",
      name: "ENGINEERING",
      icon: Wrench,
      href: "/admin/engineering",
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
      id: "communication",
      name: "COMMUNICATION",
      icon: MessageSquare,
      href: "/staff/messages",
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
        { id: "standup", name: "STANDUP", href: "/developer/standup" },
        { id: "retro", name: "RETRO", href: "/developer/retro" },
      ],
    },
    {
      id: "projects",
      name: "PROJECTS",
      icon: Briefcase,
      href: "/developer/projects",
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
      href: "/developer/messages",
    },
  ],
  intern: [
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
        { id: "standup", name: "STANDUP", href: "/developer/standup" },
        { id: "retro", name: "RETRO", href: "/developer/retro" },
      ],
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
      href: "/developer/messages",
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
      id: "assignments",
      name: "ASSIGNMENTS",
      icon: FileText,
      href: "/participant/assignments",
    },
    // rituals — removed from sidebar per product decision
    // Page still exists at /participant/rituals if needed
    {
      id: "progress_hub",
      name: "MY PROGRESS",
      icon: TrendingUp,
      href: "/participant/progress",
    },
    {
      id: "communication",
      name: "COMMUNICATION",
      icon: MessageSquare,
      href: "/participant/messages",
    },
  ],
};

export default function DashboardLayout({ children, role = "admin", modals }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openMenus, setOpenMenus] = useState({});
  const { lang, t, switchLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

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
          (data.notifications || []).filter((n) => !n.read).length,
        );
      }
    } catch (e) {}
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

  useEffect(() => {
    fetchNotifications();
    fetchSubmissionCount();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchSubmissionCount();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchSubmissionCount]);

  const { toggleTheme, theme } = useTheme();
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

  const navItems = useMemo(() => {
    // Priority: user.role (from session) > role (from prop) > fallback 'admin'
    const activeRole = user.role || role || "admin";
    const matrix = NAVIGATION_MATRIX[activeRole] || NAVIGATION_MATRIX.admin;
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
    return items;
  }, [user.role, role, pmPrograms]);

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
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-primary" />;
  }

  return (
    <AppErrorBoundary>
      <div className="flex h-screen w-full overflow-hidden bg-primary text-[var(--text-primary)]">
        <aside
          style={{ width: collapsed ? 64 : 260 }}
          className="hidden md:flex flex-col h-screen sticky top-0 bg-secondary border-r border-[var(--border-primary)] p-4 overflow-hidden z-[100] transition-[width] duration-150"
        >
          <SidebarContent {...commonProps} />
        </aside>

        {/* MOBILE TRIGGER */}
        <div className="md:hidden fixed top-3 left-3 z-[200]">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 bg-[var(--brand-orange)] rounded-md"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
        </div>

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
          <header className="h-20 flex items-center px-6 border-b border-[var(--border-primary)] relative bg-secondary/80 backdrop-blur-xl sticky top-0 z-[100]">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-orange)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] uppercase relative z-10">
              <span>ImpactOS</span>
              <ChevronRight className="w-3 h-3 opacity-30" />
              <span className="text-[var(--text-primary)]">
                {pathname
                  ? pathname
                      .split("/")
                      .pop()
                      .replace(/-/g, " ")
                      .replace(/\bteacher\b/gi, "Instructor")
                  : "Dashboard"}
              </span>
            </div>

            <div className="flex items-center gap-4 ml-auto relative z-10">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md"
                style={{ color: "var(--text-secondary)" }}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
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
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--brand-orange)] rounded-full" />
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
                                else if (role === "staff")
                                  router.push("/staff/messages");
                                else if (role === "teacher")
                                  router.push("/teacher/messages");
                                else if (role === "program_manager")
                                  router.push("/pm/messages");
                                else if (role === "participant")
                                  router.push("/participant/messages");
                                setShowNotifications(false);
                              }
                            }}
                            className={`p-3 rounded-xl hover:bg-primary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)] group ${!n.read ? "bg-[var(--brand-orange)]/5" : ""}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-black text-[10px] uppercase tracking-tight text-[var(--text-primary)]">
                                {n.title}
                              </p>
                              {!n.read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">
                              {n.message}
                            </p>
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
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-10 overflow-y-auto bg-primary">
            <div className="max-w-[1400px] mx-auto animate-in">{children}</div>
          </main>
          {modals}
          <GlobalToast />
        </div>
      </div>
    </AppErrorBoundary>
  );
}
