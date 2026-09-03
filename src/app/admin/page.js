"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Layers,
  ListTodo,
  Users,
  Rocket,
  Activity,
  Sparkles,
  Zap,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Loader2,
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  FileText,
  Calendar,
  Shield,
  TrendingUp,
  User,
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  LayoutGrid,
} from "lucide-react";
import { useRouter } from "next/navigation";
import TaskDetailModal from "@/components/ui/TaskDetailModal";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  return days;
}

const MONTH_KEYS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isToday(d) {
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-[var(--text-secondary)]",
    bg: "bg-secondary",
    dot: "bg-slate-400",
  },
  in_progress: {
    label: "Active",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    dot: "bg-blue-400",
  },
  blocked: {
    label: "Blocked",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    dot: "bg-rose-400",
  },
  completed: {
    label: "Done",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  carried_over: {
    label: "Carryover",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    dot: "bg-indigo-400",
  },
};

const ICONS = {
  Layers,
  Users,
  Rocket,
  Activity,
  Sparkles,
  Zap,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Loader2,
  Briefcase,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  FileText,
  Calendar,
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  color,
  badge,
  onClick,
  loading,
  subtitle,
}) => (
  <div
    onClick={onClick}
    className={`card group transition-all ${onClick ? "cursor-pointer hover:border-[var(--brand-orange)]" : ""}`}
  >
    <div className="flex justify-between items-start mb-4">
      <div
        className={`p-3 rounded-xl bg-primary border border-[var(--border-primary)] ${color} group-hover:scale-110 transition-transform`}
      >
        <Icon className="w-5 h-5" />
      </div>
      {badge && (
        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {badge}
        </span>
      )}
    </div>
    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
      {title}
    </p>
    {loading ? (
      <div className="h-8 w-16 bg-[var(--border-primary)]/20 animate-pulse rounded-lg" />
    ) : (
      <>
        <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
          {value}
        </h3>
        {subtitle && (
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{subtitle}</p>
        )}
      </>
    )}
  </div>
);

const SectionHeader = ({
  number,
  title,
  subtitle,
  icon: Icon,
  color,
  action,
}) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center text-sm font-bold border border-white/10`}
      >
        {number}
      </div>
      <div>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[var(--brand-orange)]" />}
          <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && action}
  </div>
);

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    programs: 0,
    participants: 0,
    totalStaff: 0,
  });
  const [activity, setActivity] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [opStats, setOpStats] = useState({
    standups: 0,
    retros: 0,
    blockers: 0,
    support: 0,
    totalUsers: 0,
  });
  const [staffReports, setStaffReports] = useState([]);
  const [blockerTypes, setBlockerTypes] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const router = useRouter();
  const { t } = useI18n();

  const statusLabel = (key) => {
    const map = {
      pending: "pending",
      in_progress: "active",
      blocked: "blocked",
      completed: "done",
      carried_over: "carryover",
    };
    return t(`status.${map[key] || "pending"}`);
  };

  const levelLabel = (key) => {
    const map = {
      critical: t("adminMisc.dashboard.critical"),
      high: t("adminMisc.dashboard.high"),
      medium: t("adminMisc.dashboard.medium"),
      low: t("adminMisc.dashboard.low"),
    };
    return map[key] || key || map.medium || "medium";
  };

  const programStatusLabel = (key) => {
    const map = {
      active: t("adminMisc.dashboard.statusActive"),
      planned: t("adminMisc.dashboard.statusPlanned"),
      completed: t("adminMisc.dashboard.statusCompleted"),
      pending: t("adminMisc.dashboard.statusPending"),
      archived: t("adminMisc.dashboard.statusArchived"),
      cancelled: t("adminMisc.dashboard.statusCancelled"),
      template: t("adminMisc.dashboard.statusTemplate"),
    };
    const normalized = typeof key === "string" ? key.toLowerCase() : "";
    return map[normalized] || key || "";
  };

  const getMonthLabel = (idx) => t(`time.months.` + MONTH_KEYS[idx]);

  // Dashboard widgets state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [activeBlockers, setActiveBlockers] = useState([]);
  const [blockersLoading, setBlockersLoading] = useState(false);
  const [resolvingBlocker, setResolvingBlocker] = useState(null);
  const [kpiSummary, setKpiSummary] = useState([]);
  
  // Pagination and UI state
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const ASSIGNMENTS_PER_PAGE = 5;
  const [expandedCalendarDays, setExpandedCalendarDays] = useState({});

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchDashboardData = useCallback(async () => {
    // Aggregate endpoints rendered by this dashboard. Kept in a single place so
    // the cache-first paint below can reuse them to fetch from the network.
    const urls = [
      "/api/superadmin/full-state",
      "/api/op-reports",
      "/api/blockers?status=active",
      "/api/dashboard?summary=true",
    ];

    // Pure apply: computes every widget state from the four payloads.
    const apply = (stateData, opData, blockerData, kpiData) => {
      if (stateData.success) {
        setStats(stateData.stats || {});
        setActivity(stateData.activity || []);
        setActivePrograms(stateData.activePrograms || []);
      }
      if (opData.success) {
        const reports = opData.reports || [];

        // Calculate op stats
        const standups = reports.filter((r) => r.report_type === "standup");
        const retros = reports.filter((r) => r.report_type === "retro");
        const blockers = reports.filter((r) => r.has_blockers);
        const support = reports.filter((r) => r.needs_support);

        // Count active blockers from dedicated blockers table
        const activeBlockersCount = blockerData.success
          ? (blockerData.blockers || []).length
          : 0;

        setOpStats({
          standups: standups.length,
          retros: retros.length,
          blockers: blockers.length + activeBlockersCount,
          support: support.length,
          totalUsers: new Set(reports.map((r) => r.user_id)).size,
        });

        // Per-staff reporting stats
        const userMap = {};
        reports.forEach((r) => {
          if (!userMap[r.user_id]) {
            userMap[r.user_id] = {
              id: r.user_id,
              name: r.user_name,
              role: r.user_role,
              standups: 0,
              retros: 0,
              blockers: 0,
              latest: null,
              weeks: new Set(),
            };
          }
          if (r.report_type === "standup") userMap[r.user_id].standups++;
          else userMap[r.user_id].retros++;
          if (r.has_blockers) userMap[r.user_id].blockers++;
          if (
            !userMap[r.user_id].latest ||
            new Date(r.created_at) > new Date(userMap[r.user_id].latest)
          ) {
            userMap[r.user_id].latest = r.created_at;
          }
          userMap[r.user_id].weeks.add(
            `${r.year}-W${String(r.week_number).padStart(2, "0")}`,
          );
        });
        setStaffReports(Object.values(userMap));

        // Blocker type aggregation
        const blockerAgg = {};
        standups
          .filter((r) => r.has_blockers && r.blocker_description)
          .forEach((r) => {
            const desc = r.blocker_description || "Other";
            blockerAgg[desc] = (blockerAgg[desc] || 0) + 1;
          });
        retros
          .filter((r) => r.had_blockers && r.blocker_type)
          .forEach((r) => {
            const type = r.blocker_type || "Other";
            blockerAgg[formatLabel(type)] =
              (blockerAgg[formatLabel(type)] || 0) + 1;
          });
        setBlockerTypes(
          Object.entries(blockerAgg)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6),
        );
      }
      if (kpiData.success) {
        setKpiSummary(kpiData.programs || []);
      }
    };

    try {
      // Cache-first paint: if a fresh (≤30s) snapshot of all four endpoints is
      // available (e.g. returning to /admin), render it immediately instead of
      // showing skeletons, then let the network refresh below converge.
      const cached = urls.map((u) => cacheGet(u));
      if (cached.every((c) => c !== null)) {
        apply(cached[0], cached[1], cached[2], cached[3]);
        setLoading(false);
      }

      const responses = await Promise.all(urls.map((u) => fetch(u)));
      const jsons = await Promise.all(responses.map((r) => r.json()));
      urls.forEach((u, i) => cacheSet(u, jsons[i]));
      apply(jsons[0], jsons[1], jsons[2], jsons[3]);
    } catch (err) {
      console.error("Dashboard sync failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tasks for calendar (super_admin sees all, others see own)
  const fetchWidgetData = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.cid || user.id;
      const isSA = user.role === "super_admin";

      const urls = [
        isSA
          ? "/api/tasks?brief=true"
          : `/api/tasks?user_id=${userId}&brief=true`,
        isSA
          ? "/api/blockers?status=active"
          : `/api/blockers?user_id=${userId}&status=active`,
      ];
      // Fetch assigned tasks if user has a user ID
      if (userId) urls.push(`/api/tasks?assigned_to=${userId}&brief=true`);

      const apply = (taskData, blockerData, assignData) => {
        if (taskData && taskData.success) setTasks(taskData.tasks || []);
        if (blockerData && blockerData.success)
          setActiveBlockers(blockerData.blockers || []);
        if (assignData && assignData.success)
          setAssignments(assignData.tasks || []);
      };

      // Cache-first paint (same 30s SWR window as fetchDashboardData): render
      // the widgets instantly from a fresh snapshot when returning to /admin,
      // then the network refresh below converges to current values.
      const cached = urls.map((u) => cacheGet(u));
      if (cached.every((c) => c !== null)) {
        apply(cached[0], cached[1], cached[2]);
        setDashboardLoading(false);
      }

      const responses = await Promise.all(urls.map((u) => fetch(u)));
      const jsons = await Promise.all(responses.map((r) => r.json()));
      urls.forEach((u, i) => cacheSet(u, jsons[i]));
      apply(jsons[0], jsons[1], jsons[2]);
    } catch (e) {
      console.error("Widget data fetch error:", e);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  // Ticket 1.6: expose refresh callback for auto calendar sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__refreshAdminDashboard = fetchWidgetData;
    }
    return () => {
      if (typeof window !== "undefined") delete window.__refreshAdminDashboard;
    };
  }, [fetchWidgetData]);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(calYear - 1);
    } else setCalMonth(calMonth - 1);
  };
  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(calYear + 1);
    } else setCalMonth(calMonth + 1);
  };

  const handleResolveBlocker = async (blockerId) => {
    setResolvingBlocker(blockerId);
    try {
      await fetch("/api/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          status: "resolved",
          resolved_by: "sa",
        }),
      });
      fetchWidgetData();
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingBlocker(null);
    }
  };

  // Calendar computed
  const calendarDays = getCalendarDays(calYear, calMonth);

  const calendarTasks = React.useMemo(() => {
    const cal = {};
    const allTasks = [...(tasks || []), ...(assignments || [])];
    // Deduplicate by task id
    const seen = new Set();
    const unique = allTasks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    unique.forEach((task) => {
      if (task.start_date || task.end_date) {
        const start = task.start_date ? new Date(task.start_date) : null;
        const end = task.end_date ? new Date(task.end_date) : null;
        if (start && end) {
          const current = new Date(start);
          while (current <= end) {
            const key = formatDate(
              current.getFullYear(),
              current.getMonth(),
              current.getDate(),
            );
            if (!cal[key]) cal[key] = [];
            cal[key].push(task);
            current.setDate(current.getDate() + 1);
          }
        } else if (start) {
          const key = formatDate(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        } else if (end) {
          const key = formatDate(
            end.getFullYear(),
            end.getMonth(),
            end.getDate(),
          );
          if (!cal[key]) cal[key] = [];
          cal[key].push(task);
        }
      }
    });
    return cal;
  }, [tasks]);

  useEffect(() => {
    fetchWidgetData();
  }, [fetchWidgetData]);

  // Ticket 1.6: refetch calendar when tab becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchWidgetData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchWidgetData]);

  useEffect(() => {
    let active = true;
    let started = false;
    const startData = () => {
      if (!started) {
        started = true;
        fetchDashboardData();
      }
    };

    async function checkAuth() {
      // Fast path: on client-side navigation the section layout has already
      // authenticated an admin session (localStorage/cache). Start loading the
      // dashboard data immediately instead of waiting for a duplicate
      // /api/auth/session round-trip; the revalidation below still redirects if
      // the session is no longer valid.
      try {
        const saved = localStorage.getItem("user");
        if (saved && JSON.parse(saved).role === "super_admin") startData();
      } catch (_) {}

      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (!active) return;
        if (
          !data.authenticated ||
          !data.user ||
          data.user.role !== "super_admin"
        ) {
          router.replace("/login");
          return;
        }
        startData();
      } catch {
        if (active) router.replace("/login");
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, [router, fetchDashboardData]);

  return (
    <>
      <div className="space-y-10 pb-20 text-left">
        {/* ──────── GLOBAL HEADER ──────── */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("reports.operationalReports")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("admin.command")}
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/programs/new")}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> {t("admin.newProgram")}
            </button>
          </div>
        </header>

        {/* ═══════ DASHBOARD WIDGETS ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── LEFT: CALENDAR ─── */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                    {getMonthLabel(calMonth)} {calYear}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setCalMonth(now.getMonth());
                      setCalYear(now.getFullYear());
                    }}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
                  >
                    {t("time.today")}
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-px bg-[var(--border-primary)] rounded-lg overflow-hidden">
                {DAY_KEYS.map((k) => (
                  <div key={k} className="bg-primary p-2 text-center">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      {t("time.days." + k)}
                    </span>
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  if (day === null)
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="bg-primary p-2 min-h-[90px]"
                      />
                    );
                  const dateStr = formatDate(calYear, calMonth, day);
                  const dayTasks = calendarTasks[dateStr] || [];
                  const isCurrent = isToday(new Date(calYear, calMonth, day));
                  const isPast =
                    new Date(calYear, calMonth, day) <
                    new Date(new Date().toDateString());
                  return (
                    <div
                      key={dateStr}
                      className={`bg-primary p-1.5 min-h-[90px] transition-all ${isCurrent ? "ring-1 ring-[var(--brand-orange)]/40" : ""} ${isPast ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] font-bold ${isCurrent ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                        >
                          {day}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>
                      <div className={`space-y-0.5 ${expandedCalendarDays[dateStr] ? "max-h-[200px]" : ""} overflow-y-auto custom-scrollbar`}>
                        {dayTasks.slice(0, expandedCalendarDays[dateStr] ? undefined : 3).map((task) => {
                          const priorityColor =
                            task.priority === "critical"
                              ? "bg-red-500/20 text-red-400"
                              : task.priority === "high"
                                ? "bg-amber-500/20 text-amber-400"
                                : task.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400/70 line-through"
                                  : task.status === "blocked"
                                    ? "bg-rose-500/15 text-rose-400"
                                    : STATUS_CONFIG[task.status]?.bg +
                                        " " +
                                        STATUS_CONFIG[task.status]?.color ||
                                      "bg-secondary text-[var(--text-secondary)]";
                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-bold truncate leading-tight ${priorityColor} hover:brightness-110 transition-all`}
                            >
                              {task.title}
                            </button>
                          );
                        })}
                        {dayTasks.length > 3 && !expandedCalendarDays[dateStr] && (
                          <button
                            onClick={() => setExpandedCalendarDays(prev => ({ ...prev, [dateStr]: true }))}
                            className="w-full text-center py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary rounded transition-all"
                          >
                            +{dayTasks.length - 3} more
                          </button>
                        )}
                        {expandedCalendarDays[dateStr] && dayTasks.length > 3 && (
                          <button
                            onClick={() => setExpandedCalendarDays(prev => ({ ...prev, [dateStr]: false }))}
                            className="w-full text-center py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary rounded transition-all"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[var(--border-primary)]">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      {statusLabel(key)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── RIGHT: SUMMARY WIDGETS ─── */}
          <div className="space-y-3">
            {/* Upcoming */}
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
                  {t("time.upcoming")}
                </span>
              </div>
              {(() => {
                const now = new Date();
                const ts = formatDate(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                );
                const tom = new Date(now);
                tom.setDate(tom.getDate() + 1);
                const tms = formatDate(
                  tom.getFullYear(),
                  tom.getMonth(),
                  tom.getDate(),
                );
                const todayT = calendarTasks[ts] || [];
                const tomorrowT = calendarTasks[tms] || [];
                if (todayT.length === 0 && tomorrowT.length === 0)
                  return (
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t("time.noUpcoming")}
                    </p>
                  );
                return (
                  <>
                    {todayT.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                          {t("time.today")}
                        </p>
                        {todayT.slice(0, 2).map((task) => (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className="block w-full text-left text-[11px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate py-0.5"
                          >
                            • {task.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {tomorrowT.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                          {t("time.tomorrow")}
                        </p>
                        {tomorrowT.slice(0, 2).map((task) => (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className="block w-full text-left text-[11px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate py-0.5"
                          >
                            • {task.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Tasks Summary */}
            <div
              onClick={() => router.push("/admin/tasks")}
              className="card cursor-pointer hover:bg-tertiary transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <ListTodo className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                  {t("reports.tasks")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-black text-blue-400 tracking-tight">
                    {
                      (tasks || []).filter((t) => t.status === "in_progress")
                        .length
                    }
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("status.active")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black text-rose-400 tracking-tight">
                    {(tasks || []).filter((t) => t.status === "blocked").length}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("status.blocked")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-400 tracking-tight">
                    {
                      (tasks || []).filter((t) => t.status === "completed")
                        .length
                    }
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("status.done")}
                  </p>
                </div>
              </div>
            </div>

            {/* Blockers Summary */}
            <div
              onClick={() => router.push("/admin/blockers")}
              className="card cursor-pointer hover:bg-tertiary transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-rose-400">
                  {t("reports.blockers")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-2xl font-black text-rose-400 tracking-tight">
                    {activeBlockers.length}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("status.active")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black text-rose-500 tracking-tight">
                    {
                      activeBlockers.filter(
                        (b) =>
                          b.severity === "high" || b.severity === "critical",
                      ).length
                    }
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("status.high")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ ASSIGNED TO ME ═══════ */}
        {assignments.filter((a) => a.status !== "completed").length > 0 &&
          !assignmentsLoading && (
            <div className="card border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
                  {t("admin.assignedToMe")}
                </span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] ml-auto">
                  {assignments.filter((a) => a.status === "pending").length}{" "}
                  {t("admin.awaitingAction")}
                </span>
              </div>
              <div className="space-y-1.5">
                {assignments
                  .filter((a) => a.status !== "completed")
                  .slice((assignmentsPage - 1) * ASSIGNMENTS_PER_PAGE, assignmentsPage * ASSIGNMENTS_PER_PAGE)
                  .map((task) => {
                    const isPending = task.status === "pending";
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${isPending ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-[var(--border-primary)] bg-secondary"}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                          {(task.user_name || task.assigned_to || "?").charAt(
                            0,
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-[var(--text-primary)] truncate block">
                            {task.title}
                          </span>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {t("admin.assignedBy")}:{" "}
                            {task.user_name || t("adminMisc.dashboard.system")}
                            {task.end_date
                              ? ` · ${t("time.due")}: ${new Date(task.end_date).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        {isPending ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              disabled={processingId !== null}
                              onClick={async () => {
                                setProcessingId(task.id);
                                try {
                                  await fetch("/api/tasks/assignment-action", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      task_id: task.id,
                                      user_id:
                                        JSON.parse(
                                          localStorage.getItem("user") || "{}",
                                        ).cid || "sa",
                                      action: "accepted",
                                    }),
                                  });
                                  fetchWidgetData();
                                } finally {
                                  setProcessingId(null);
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            >
                              {processingId === task.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : null}
                              {t("common.accept")}
                            </button>
                            <button
                              disabled={processingId !== null}
                              onClick={async () => {
                                setProcessingId(task.id);
                                try {
                                  await fetch("/api/tasks/assignment-action", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      task_id: task.id,
                                      user_id:
                                        JSON.parse(
                                          localStorage.getItem("user") || "{}",
                                        ).cid || "sa",
                                      action: "declined",
                                    }),
                                  });
                                  fetchWidgetData();
                                } finally {
                                  setProcessingId(null);
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            >
                              {processingId === task.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : null}
                              {t("common.decline")}
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={processingId !== null}
                            onClick={async () => {
                              setProcessingId(task.id);
                              try {
                                await fetch("/api/tasks/assignment-action", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    task_id: task.id,
                                    user_id:
                                      JSON.parse(
                                        localStorage.getItem("user") || "{}",
                                      ).cid || "sa",
                                    action: "completed_assignment",
                                  }),
                                });
                                fetchWidgetData();
                              } finally {
                                setProcessingId(null);
                              }
                            }}
                            className="px-3 py-1.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-lg text-[10px] font-bold uppercase tracking-widest hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                          >
                            {processingId === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            {t("common.complete")}
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
              
              {/* Pagination Controls */}
              {assignments.filter((a) => a.status !== "completed").length > ASSIGNMENTS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-primary)]">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("common.page")} {assignmentsPage} {t("common.of")} {Math.ceil(assignments.filter((a) => a.status !== "completed").length / ASSIGNMENTS_PER_PAGE)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAssignmentsPage(p => Math.max(1, p - 1))}
                      disabled={assignmentsPage === 1}
                      className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAssignmentsPage(p => Math.min(Math.ceil(assignments.filter((a) => a.status !== "completed").length / ASSIGNMENTS_PER_PAGE), p + 1))}
                      disabled={assignmentsPage === Math.ceil(assignments.filter((a) => a.status !== "completed").length / ASSIGNMENTS_PER_PAGE)}
                      className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION A — PROGRAM OPERATIONS                 */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6">
          <SectionHeader
            number="A"
            title={t("admin.programOperations")}
            subtitle={t("admin.sectionSubtitles.educationalPerformance")}
            icon={Briefcase}
            color="bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
            action={
              <button
                onClick={() => router.push("/admin/programs")}
                className="text-[10px] font-bold text-[var(--brand-orange)] uppercase hover:underline"
              >
                {t("admin.viewAllPrograms")}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title={t("admin.activePrograms")}
              value={stats.programs}
              icon={Layers}
              color="text-[var(--brand-orange)]"
              badge={t("status.live")}
              onClick={() => router.push("/admin/programs")}
              loading={loading}
            />
            <StatCard
              title={t("admin.totalParticipants")}
              value={stats.participants}
              icon={Users}
              color="text-blue-500"
              onClick={() => router.push("/admin/communications/contacts")}
              loading={loading}
            />
            <StatCard
              title={t("admin.operationalStaff")}
              value={stats.totalStaff}
              icon={Rocket}
              color="text-emerald-500"
              subtitle={t("admin.sectionSubtitles.teachersAndStaff")}
              onClick={() => router.push("/admin/communications/contacts")}
              loading={loading}
            />
            <StatCard
              title={t("admin.projects")}
              value={stats.projects || stats.totalProjects || "—"}
              icon={Briefcase}
              color="text-purple-500"
              subtitle={t("admin.sectionSubtitles.activeInternalProjects")}
              onClick={() => router.push("/admin/projects")}
              loading={loading}
            />
          </div>

          {/* Activity Feed + Active Programs (existing content) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--brand-orange)]" />{" "}
                  {t("reports.recentReports")}
                </h4>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <TableSkeleton rows={4} />
                ) : activity.length > 0 ? (
                  activity.slice(0, 6).map((log, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:border-[var(--brand-orange)]">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                          {log.action}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">
                          {log.user || t("adminMisc.dashboard.system")} ·{" "}
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--border-primary)]" />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                    {t("common.noResults")}
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-500" />{" "}
                  {t("admin.activePrograms")}
                </h4>
                <button
                  onClick={() => router.push("/admin/programs")}
                  className="text-[10px] font-bold text-[var(--brand-orange)] uppercase hover:underline"
                >
                  {t("common.viewAll")}
                </button>
              </div>
              <div className="space-y-3">
                {loading ? (
                  <TableSkeleton rows={3} />
                ) : activePrograms.length > 0 ? (
                  activePrograms.map((prog, i) => (
                    <div
                      key={prog.id}
                      onClick={() => router.push(`/admin/programs/${prog.id}`)}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer group border border-transparent hover:border-[var(--border-primary)]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                          {prog.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase px-1.5 py-0.5 bg-emerald-500/10 rounded">
                            {programStatusLabel(prog.status)}
                          </span>
                          <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                            {new Date(prog.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-[var(--border-primary)]" />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                    {t("common.noResults")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* KPI PROGRESS OVERVIEW                               */}
        {/* ═══════════════════════════════════════════════ */}
        {kpiSummary.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-[var(--border-primary)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                    {t("adminMisc.dashboard.kpiProgress")}
                  </h3>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("adminMisc.dashboard.weightedAverageCompletion")}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpiSummary.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/admin/programs/${p.id}`)}
                  className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-emerald-500/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">{p.name}</span>
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                      p.avg_kpi_rate >= 70 ? "bg-emerald-500/10 text-emerald-400" :
                      p.avg_kpi_rate >= 40 ? "bg-amber-500/10 text-amber-400" :
                      "bg-rose-500/10 text-rose-400"
                    )}>{p.avg_kpi_rate}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)] mb-2">
                    <Target className="w-3 h-3" /> {p.kpi_count} KPIs
                    <span className={cn("ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold",
                      p.status === 'Active' ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary text-[var(--text-secondary)]"
                    )}>{programStatusLabel(p.status)}</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      p.avg_kpi_rate >= 70 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      p.avg_kpi_rate >= 40 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                      "bg-gradient-to-r from-rose-500 to-rose-400"
                    )} style={{width: `${Math.max(p.avg_kpi_rate, 5)}%`}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION B — INTERNAL OPERATIONS                */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="B"
            title={t("admin.internalOperations")}
            subtitle={t("admin.sectionSubtitles.staffReporting")}
            icon={BarChart3}
            color="bg-indigo-500/10 text-indigo-500"
            action={
              <button
                onClick={() => router.push("/admin/op-reports")}
                className="text-[10px] font-bold text-indigo-400 uppercase hover:underline"
              >
                {t("admin.viewAllReports")}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title={t("admin.mondayStandups")}
              value={opStats.standups}
              icon={Calendar}
              color="text-[var(--brand-orange)]"
              subtitle={`${opStats.totalUsers} ${t("admin.activeReporters")}`}
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.fridayRetros")}
              value={opStats.retros}
              icon={CheckCircle2}
              color="text-emerald-500"
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
            <StatCard
              title={t("admin.blockersReported")}
              value={opStats.blockers}
              icon={AlertTriangle}
              color="text-rose-500"
              badge={opStats.blockers > 0 ? t("status.action") : ""}
              loading={loading}
              onClick={() => router.push("/admin/op-reports")}
            />
          </div>

          {/* Quick insights row */}
          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <div
              className="card flex items-center gap-4 p-5 cursor-pointer hover:border-[var(--brand-orange)] transition-all"
              onClick={() => router.push("/admin/op-reports")}
            >
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("admin.blockerRate")}
                </p>
                <p className="text-2xl font-black tracking-tight">
                  {opStats.standups + opStats.retros > 0
                    ? Math.round(
                        (opStats.blockers /
                          (opStats.standups + opStats.retros)) *
                          100,
                      )
                    : 0}
                  %
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("admin.ofAllReports")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section B — Internal Operations nav cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => router.push("/admin/work")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left ring-1 ring-[var(--brand-orange)]/20"
          >
            <div className="flex items-center gap-3 mb-3">
              <LayoutGrid className="w-5 h-5 text-[var(--brand-orange)]" />
              <span className="text-[11px] font-bold text-[var(--brand-orange)] uppercase tracking-wide">
                {t("admin.workManagement")}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t("admin.descriptions.workHub")}
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/tasks")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <ListTodo className="w-5 h-5 text-blue-500" />
              <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
                {t("reports.tasks")}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t("admin.descriptions.trackTasks")}
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/blockers")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <Shield className="w-5 h-5 text-rose-500" />
              <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wide">
                {t("reports.blockers")}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t("admin.descriptions.monitorBlockers")}
            </p>
          </button>
          <button
            onClick={() => router.push("/admin/projects")}
            className="card hover:border-[var(--brand-orange)]/30 transition-all text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <Briefcase className="w-5 h-5 text-emerald-500" />
              <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wide">
                {t("reports.companyReports")}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t("admin.descriptions.viewProjects")}
            </p>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION C — TEAM ACCOUNTABILITY                */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="C"
            title={t("admin.teamAccountability")}
            subtitle={t("admin.sectionSubtitles.reportingReliability")}
            icon={Users}
            color="bg-emerald-500/10 text-emerald-500"
            action={
              <button
                onClick={() =>
                  setExpandedSections((prev) => ({
                    ...prev,
                    teamTable: !prev.teamTable,
                  }))
                }
                className="text-[10px] font-bold text-[var(--text-secondary)] uppercase hover:text-[var(--text-primary)] transition-all flex items-center gap-1"
              >
                {expandedSections.teamTable
                  ? t("common.collapse")
                  : t("common.expand")}{" "}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${expandedSections.teamTable ? "rotate-180" : ""}`}
                />
              </button>
            }
          />

          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="card flex items-center gap-3 p-4 border-l-4 border-emerald-500">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("admin.consistent")}
                </p>
                <p className="text-2xl font-black tracking-tight">
                  {
                    staffReports.filter((s) => s.standups + s.retros >= 4)
                      .length
                  }
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4 border-l-4 border-amber-500">
              <Clock className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("admin.atRisk")}
                </p>
                <p className="text-2xl font-black tracking-tight">
                  {
                    staffReports.filter(
                      (s) =>
                        s.standups + s.retros > 0 && s.standups + s.retros < 4,
                    ).length
                  }
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-4 border-l-4 border-rose-500">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {t("admin.inactive")}
                </p>
                <p className="text-2xl font-black tracking-tight">
                  {stats.totalStaff - staffReports.length > 0
                    ? stats.totalStaff - staffReports.length
                    : 0}
                </p>
              </div>
            </div>
          </div>

          {/* Staff table (expandable) */}
          {(expandedSections.teamTable || staffReports.length <= 6) && (
            <div className="card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      <th className="text-left p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("reports.teamMembers")}
                      </th>
                      <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("reports.mondayStandup")}
                      </th>
                      <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("reports.fridayRetro")}
                      </th>
                      <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("reports.blockers")}
                      </th>
                      <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("common.filter")}
                      </th>
                      <th className="text-right p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                        {t("time.updated")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffReports
                      .sort(
                        (a, b) =>
                          b.standups + b.retros - (a.standups + a.retros),
                      )
                      .map((s) => {
                        const total = s.standups + s.retros;
                        const status =
                          total >= 4
                            ? "active"
                            : total > 0
                              ? "at_risk"
                              : "inactive";
                        return (
                          <tr
                            key={s.id}
                            className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                                  {s.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                                    {s.name}
                                  </p>
                                  <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                                    {s.role}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center p-4 text-sm font-bold">
                              {s.standups}
                            </td>
                            <td className="text-center p-4 text-sm font-bold">
                              {s.retros}
                            </td>
                            <td className="text-center p-4">
                              <span
                                className={`text-sm font-bold ${s.blockers > 0 ? "text-rose-500" : "text-[var(--text-secondary)]"}`}
                              >
                                {s.blockers}
                              </span>
                            </td>
                            <td className="text-center p-4">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                                  status === "active"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : status === "at_risk"
                                      ? "bg-amber-500/10 text-amber-500"
                                      : "bg-rose-500/10 text-rose-500"
                                }`}
                              >
                                {status === "active"
                                  ? t("status.active")
                                  : status === "at_risk"
                                    ? t("admin.atRisk")
                                    : t("admin.inactive")}
                              </span>
                            </td>
                            <td className="text-right p-4 text-[10px] font-medium text-[var(--text-secondary)]">
                              {s.latest
                                ? new Date(s.latest).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    {staffReports.length === 0 && !loading && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-sm text-[var(--text-secondary)]"
                        >
                          {t("reports.noReportsFound")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {expandedSections.teamTable && staffReports.length > 6 && (
            <button
              onClick={() => toggleSection("teamTable")}
              className="w-full text-center py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase hover:text-[var(--text-primary)] transition-all"
            >
              <ChevronUp className="w-3 h-3 mx-auto" /> {t("common.showLess")}
            </button>
          )}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION D — RISKS & BLOCKERS                   */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="D"
            title={t("admin.risksAndBlockers")}
            subtitle={t("admin.sectionSubtitles.recurringProblems")}
            icon={AlertTriangle}
            color="bg-rose-500/10 text-rose-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Latest active blockers */}
            <div className="card">
              <h4 className="text-[11px] font-bold text-rose-500 uppercase tracking-wide mb-4">
                {t("admin.latestBlockers")}
              </h4>
              {activeBlockers.length > 0 ? (
                <div className="space-y-2">
                  {activeBlockers.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-rose-500/[0.03] border border-rose-500/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[var(--text-primary)]">
                            {b.title}
                          </span>
                          {b.severity && (
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${b.severity === "critical" || b.severity === "high" ? "bg-rose-500/10 text-rose-500" : "bg-secondary text-[var(--text-secondary)]"}`}
                            >
                              {levelLabel(b.severity)}
                            </span>
                          )}
                        </div>
                        {b.task_title && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {t("admin.taskLabel")}: {b.task_title}
                          </p>
                        )}
                        {b.task_owner && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {t("admin.ownerLabel")}: {b.task_owner}
                          </p>
                        )}
                      </div>
                      <button
                        disabled={resolvingBlocker !== null}
                        onClick={() => handleResolveBlocker(b.id)}
                        className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {resolvingBlocker === b.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        {t("common.resolve")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t("admin.noActiveBlockers")}
                  </p>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="space-y-4">
              <div className="card">
                <h4 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">
                  {t("admin.quickActions")}
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={() => router.push("/admin/blockers")}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)] hover:border-rose-500/30 transition-all"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide">
                      {t("admin.viewAllBlockers")}
                    </span>
                    <Eye className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                  <button
                    onClick={() => router.push("/admin/op-reports")}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)] hover:border-amber-500/30 transition-all"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide">
                      {t("admin.blockerReports")}
                    </span>
                    <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION E — HISTORICAL INTELLIGENCE            */}
        {/* ═══════════════════════════════════════════════ */}
        <div className="space-y-6 pt-6 border-t border-[var(--border-primary)]">
          <SectionHeader
            number="E"
            title={t("admin.historicalIntelligence")}
            subtitle={t("admin.sectionSubtitles.longTermVisibility")}
            icon={Clock}
            color="bg-blue-500/10 text-blue-500"
            action={
              <button
                onClick={() => router.push("/admin/op-reports")}
                className="text-[10px] font-bold text-blue-400 uppercase hover:underline"
              >
                {t("admin.fullArchive")}
              </button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push("/admin/op-reports")}
              className="card hover:border-blue-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
                  {t("admin.reportArchive")}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("admin.descriptions.browseArchive")}
              </p>
            </button>
            <button
              onClick={() => router.push("/admin/reports")}
              className="card hover:border-blue-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
                  {t("admin.reportsHub")}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("admin.descriptions.historicalReports")}
              </p>
            </button>
            <button
              onClick={() => router.push("/admin/reports/responses")}
              className="card hover:border-blue-500/30 transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">
                  {t("admin.reportResponses")}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t("admin.descriptions.pmReportResponses")}
              </p>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* SIDEBAR — BOTTOM SECTION CLEANED               */}
        {/* ═══════════════════════════════════════════════ */}
      </div>

      {/* ═══════ TASK DETAIL DRAWER ═══════ */}
      {selectedTask && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="card w-full max-w-lg space-y-5 border-[var(--brand-orange)]/30 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.pending).bg} ${(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.pending).color}`}
                  >
                    {statusLabel(selectedTask.status || "pending")}
                  </span>
                  {selectedTask.end_date &&
                    !["completed", "pending"].includes(selectedTask.status) &&
                    new Date(selectedTask.end_date) <
                      new Date(new Date().toDateString()) && (
                      <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                        {t("status.overdue")}
                      </span>
                    )}
                </div>
                <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
                  {selectedTask.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-1 hover:bg-white/5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {selectedTask.start_date && (
                <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                    {t("time.start")}
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {new Date(selectedTask.start_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              {selectedTask.end_date && (
                <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                    {t("time.due")}
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {new Date(selectedTask.end_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {t("time.created")}
                </p>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {selectedTask.created_at
                    ? new Date(selectedTask.created_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {t("adminMisc.dashboard.priority")}
                </p>
                <p
                  className={`text-sm font-bold ${selectedTask.priority === "critical" ? "text-red-400" : selectedTask.priority === "high" ? "text-amber-400" : "text-[var(--text-secondary)]"}`}
                >
                  {levelLabel(selectedTask.priority)}
                </p>
              </div>
            </div>
            {selectedTask.description && (
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {t("adminMisc.dashboard.description")}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {selectedTask.description}
                </p>
              </div>
            )}
            {(selectedTask.blockers || []).filter((b) => b.status === "active")
              .length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                  {t("adminMisc.dashboard.blockers")}
                </p>
                {selectedTask.blockers
                  .filter((b) => b.status === "active")
                  .map((b) => (
                    <div
                      key={b.id}
                      className="p-2 rounded bg-rose-500/10 text-[10px] text-rose-400 font-bold"
                    >
                      {b.title}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function formatLabel(val) {
  if (!val || val === "—") return "—";
  if (typeof val !== "string") return String(val);
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
