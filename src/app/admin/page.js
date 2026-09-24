"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Layers,
  ListTodo,
  Users,
  Rocket,
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
  X,
  ChevronDown,
  ChevronUp,
  Eye,
  LayoutGrid,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/Skeleton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const days = [];
  for (let index = 0; index < startPad; index++) days.push(null);
  for (let dayOfMonth = 1; dayOfMonth <= lastDay.getDate(); dayOfMonth++) days.push(dayOfMonth);
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

function isToday(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
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

// Display rules for one calendar day:
//  1. Order = creation order. Task ids are serial, so a lower id was created
//     first.
//  2. The same task is shown ONCE. Two tasks with the same title on the same
//     day (a carried-over copy next to the original…) are the same work, shown
//     with the look of the most pressing copy (open work before finished).
//     Only a different time of day keeps them apart; tasks have no time today
//     (DATE columns), so the time only matters if one is ever provided.
const STATUS_RANK = {
  blocked: 0,
  in_progress: 1,
  pending: 2,
  carried_over: 3,
  completed: 4,
};

function groupSameTitle(tasks) {
  const groups = new Map();
  const ordered = [...tasks].sort(
    (first, second) => (Number(first.id) || 0) - (Number(second.id) || 0),
  );
  for (const task of ordered) {
    const key = `${String(task.title || "").trim().toLowerCase()}:${task.time || ""}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { primary: task, items: [task] });
      continue;
    }
    group.items.push(task);
    const rank = STATUS_RANK[task.status] ?? 2;
    if (rank < (STATUS_RANK[group.primary.status] ?? 2)) group.primary = task;
  }
  return [...groups.values()];
}

/**
 * Calendar colours for a task: `chip` for a labelled entry, `bar` for the
 * quiet in-between days of a multi-day task. The status decides first (a
 * finished task reads as finished whatever its priority), then the priority.
 */
function calendarTaskTone(task) {
  if (task.status === "completed")
    return {
      chip: "bg-[var(--surface-2)] text-[var(--text-tertiary)] line-through",
      bar: "bg-emerald-400",
    };
  if (task.status === "blocked")
    return { chip: "bg-rose-500/15 text-rose-400", bar: "bg-rose-400" };
  if (task.priority === "critical")
    return { chip: "bg-red-500/20 text-red-400", bar: "bg-red-400" };
  if (task.priority === "high")
    return { chip: "bg-amber-500/20 text-amber-400", bar: "bg-amber-400" };
  const config = STATUS_CONFIG[task.status];
  if (config) return { chip: `${config.bg} ${config.color}`, bar: config.dot };
  return {
    chip: "bg-secondary text-[var(--text-secondary)]",
    bar: "bg-slate-400",
  };
}

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
      <div className="h-8 w-16 bg-divider/20 animate-pulse rounded-lg" />
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
  const [processingId, setProcessingId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const router = useRouter();
  const { t, lang } = useI18n();

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

  const getMonthLabel = (monthIndex) => t(`time.months.` + MONTH_KEYS[monthIndex]);

  // Dashboard widgets state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading] = useState(false);
  const [activeBlockers, setActiveBlockers] = useState([]);
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
        const standups = reports.filter(
          (report) => report.report_type === "standup",
        );
        const retros = reports.filter(
          (report) => report.report_type === "retro",
        );
        const blockers = reports.filter((report) => report.has_blockers);
        const support = reports.filter((report) => report.needs_support);

        // Count active blockers from dedicated blockers table
        const activeBlockersCount = blockerData.success
          ? (blockerData.blockers || []).length
          : 0;

        setOpStats({
          standups: standups.length,
          retros: retros.length,
          blockers: blockers.length + activeBlockersCount,
          support: support.length,
          totalUsers: new Set(reports.map((report) => report.user_id)).size,
        });

        // Per-staff reporting stats
        const userMap = {};
        reports.forEach((report) => {
          if (!userMap[report.user_id]) {
            userMap[report.user_id] = {
              id: report.user_id,
              name: report.user_name,
              role: report.user_role,
              standups: 0,
              retros: 0,
              blockers: 0,
              latest: null,
              weeks: new Set(),
            };
          }
          if (report.report_type === "standup") userMap[report.user_id].standups++;
          else userMap[report.user_id].retros++;
          if (report.has_blockers) userMap[report.user_id].blockers++;
          if (
            !userMap[report.user_id].latest ||
            new Date(report.created_at) > new Date(userMap[report.user_id].latest)
          ) {
            userMap[report.user_id].latest = report.created_at;
          }
          userMap[report.user_id].weeks.add(
            `${report.year}-W${String(report.week_number).padStart(2, "0")}`,
          );
        });
        setStaffReports(Object.values(userMap));

        // Blocker type aggregation
        const blockerAgg = {};
        standups
          .filter((report) => report.has_blockers && report.blocker_description)
          .forEach((report) => {
            const desc = report.blocker_description || "Other";
            blockerAgg[desc] = (blockerAgg[desc] || 0) + 1;
          });
        retros
          .filter((report) => report.had_blockers && report.blocker_type)
          .forEach((report) => {
            const type = report.blocker_type || "Other";
            blockerAgg[formatLabel(type)] =
              (blockerAgg[formatLabel(type)] || 0) + 1;
          });
      }
      if (kpiData.success) {
        setKpiSummary(kpiData.programs || []);
      }
    };

    try {
      // Cache-first paint: if a fresh (≤30s) snapshot of all four endpoints is
      // available (e.g. returning to /admin), render it immediately instead of
      // showing skeletons, then let the network refresh below converge.
      const cached = urls.map((url) => cacheGet(url));
      if (cached.every((cachedItem) => cachedItem !== null)) {
        apply(cached[0], cached[1], cached[2], cached[3]);
        setLoading(false);
      }

      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const payloads = await Promise.all(
        responses.map((response) => response.json()),
      );
      urls.forEach((url, index) => cacheSet(url, payloads[index]));
      apply(payloads[0], payloads[1], payloads[2], payloads[3]);
    } catch (err) {
      console.error("Dashboard sync failure:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch tasks for calendar (super_admin sees all, others see own)
  const fetchWidgetData = useCallback(async () => {
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
      const cached = urls.map((url) => cacheGet(url));
      if (cached.every((cachedItem) => cachedItem !== null)) {
        apply(cached[0], cached[1], cached[2]);
      }

      const responses = await Promise.all(urls.map((url) => fetch(url)));
      const payloads = await Promise.all(
        responses.map((response) => response.json()),
      );
      urls.forEach((url, index) => cacheSet(url, payloads[index]));
      apply(payloads[0], payloads[1], payloads[2]);
    } catch (error) {
      console.error("Widget data fetch error:", error);
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
    } catch (error) {
      console.error(error);
    } finally {
      setResolvingBlocker(null);
    }
  };

  // Calendar computed
  const calendarDays = getCalendarDays(calYear, calMonth);

  // A task spanning several days is listed on each of them. `calendarSpans`
  // records where each day sits in that span ("middle" = neither first nor
  // last), so the grid can draw the in-between days as a quiet bar instead of
  // repeating the full title every day.
  const calendarSpans = React.useMemo(() => {
    const spans = {};
    const allTasks = [...(tasks || []), ...(assignments || [])];
    allTasks.forEach((task) => {
      if (!task.start_date || !task.end_date) return;
      const start = new Date(task.start_date);
      const end = new Date(task.end_date);
      const current = new Date(start);
      current.setDate(current.getDate() + 1);
      while (current < end) {
        const key = formatDate(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
        );
        spans[`${key}:${task.id}`] = "middle";
        current.setDate(current.getDate() + 1);
      }
    });
    return spans;
  }, [tasks, assignments]);

  const calendarTasks = React.useMemo(() => {
    const cal = {};
    const allTasks = [...(tasks || []), ...(assignments || [])];
    // Deduplicate by task id
    const seen = new Set();
    const unique = allTasks.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
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
  }, [tasks, assignments]);

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
        const storedUser = localStorage.getItem("user");
        if (storedUser && JSON.parse(storedUser).role === "super_admin") startData();
      } catch (_) {}

      try {
        const response = await fetch("/api/auth/session");
        const payload = await response.json();
        if (!active) return;
        if (
          !payload.authenticated ||
          !payload.user ||
          payload.user.role !== "super_admin"
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
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
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
                {DAY_KEYS.map((dayKey) => (
                  <div key={dayKey} className="bg-primary p-2 text-center">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      {t("time.days." + dayKey)}
                    </span>
                  </div>
                ))}
                {calendarDays.map((day, index) => {
                  if (day === null)
                    return (
                      <div
                        key={`empty-${index}`}
                        className="bg-primary p-2 min-h-[90px]"
                      />
                    );
                  const dateStr = formatDate(calYear, calMonth, day);
                  const dayTasks = groupSameTitle(calendarTasks[dateStr] || []);
                  const isCurrent = isToday(new Date(calYear, calMonth, day));
                  const isPast =
                    new Date(calYear, calMonth, day) <
                    new Date(new Date().toDateString());
                  const isWeekStart =
                    day === 1 || new Date(calYear, calMonth, day).getDay() === 0;
                  const expanded = expandedCalendarDays[dateStr];
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "p-1.5 min-h-[90px] transition-all",
                        isCurrent
                          ? "bg-[var(--surface-1)] ring-2 ring-inset ring-brand-orange/60"
                          : "bg-primary",
                        isPast && "opacity-60",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            isCurrent
                              ? "min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--brand-orange)] text-white flex items-center justify-center"
                              : "text-[var(--text-secondary)]",
                          )}
                        >
                          {day}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[10px] font-bold text-[var(--text-tertiary)]">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>
                      <div className={`space-y-0.5 ${expanded ? "max-h-[200px]" : ""} overflow-y-auto custom-scrollbar`}>
                        {dayTasks.slice(0, expanded ? undefined : 3).map(({ primary: task }) => {
                          const tone = calendarTaskTone(task);
                          // In-between days of a multi-day task: a thin bar, with
                          // the title repeated only at the start of each week row.
                          if (calendarSpans[`${dateStr}:${task.id}`] === "middle" && !isWeekStart) {
                            return (
                              <button
                                key={task.id}
                                onClick={() => setSelectedTask(task)}
                                title={task.title}
                                aria-label={task.title}
                                className={cn(
                                  "block w-full h-1.5 my-1 rounded-full hover:opacity-100 transition-all",
                                  tone.bar,
                                  task.status === "completed" ? "opacity-30" : "opacity-60",
                                )}
                              />
                            );
                          }
                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              title={task.title}
                              className={cn(
                                "w-full text-left px-1.5 py-0.5 rounded text-[10px] font-semibold truncate leading-tight hover:brightness-110 transition-all",
                                tone.chip,
                              )}
                            >
                              {task.title}
                            </button>
                          );
                        })}
                        {dayTasks.length > 3 && !expanded && (
                          <button
                            onClick={() => setExpandedCalendarDays(prev => ({ ...prev, [dateStr]: true }))}
                            className="w-full text-center py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary rounded transition-all"
                          >
                            +{dayTasks.length - 3} {t("common.more")}
                          </button>
                        )}
                        {expanded && dayTasks.length > 3 && (
                          <button
                            onClick={() => setExpandedCalendarDays(prev => ({ ...prev, [dateStr]: false }))}
                            className="w-full text-center py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary rounded transition-all"
                          >
                            {t("common.showLess")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[var(--border-primary)]">
                {Object.entries(STATUS_CONFIG).map(([key, statusConfig]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
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
                const firstOfEachTitle = (tasks) =>
                  groupSameTitle(tasks).map((group) => group.primary);
                const todayT = firstOfEachTitle(calendarTasks[ts] || []);
                const tomorrowT = firstOfEachTitle(calendarTasks[tms] || []);
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
                      (tasks || []).filter((task) => task.status === "in_progress")
                        .length
                    }
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("status.active")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black text-rose-400 tracking-tight">
                    {(tasks || []).filter((task) => task.status === "blocked").length}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("status.blocked")}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-400 tracking-tight">
                    {
                      (tasks || []).filter((task) => task.status === "completed")
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
                        (blocker) =>
                          blocker.severity === "high" ||
                          blocker.severity === "critical",
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
        {assignments.filter((assignment) => assignment.status !== "completed")
          .length > 0 &&
          !assignmentsLoading && (
            <div className="card border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
                  {t("admin.assignedToMe")}
                </span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] ml-auto">
                  {assignments.filter((assignment) => assignment.status === "pending")
                    .length}{" "}
                  {t("admin.awaitingAction")}
                </span>
              </div>
              <div className="space-y-1.5">
                {assignments
                  .filter((assignment) => assignment.status !== "completed")
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
                              ? ` · ${t("time.due")}: ${new Date(task.end_date).toLocaleDateString(lang)}`
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
              {assignments.filter((assignment) => assignment.status !== "completed")
                .length > ASSIGNMENTS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-primary)]">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {t("common.page")} {assignmentsPage} {t("common.of")} {
                      Math.ceil(
                        assignments.filter(
                          (assignment) => assignment.status !== "completed",
                        ).length / ASSIGNMENTS_PER_PAGE,
                      )
                    }
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAssignmentsPage((page) => Math.max(1, page - 1))}
                      disabled={assignmentsPage === 1}
                      className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setAssignmentsPage((page) =>
                          Math.min(
                            Math.ceil(
                              assignments.filter(
                                (assignment) =>
                                  assignment.status !== "completed",
                              ).length / ASSIGNMENTS_PER_PAGE,
                            ),
                            page + 1,
                          ),
                        )
                      }
                      disabled={
                        assignmentsPage ===
                        Math.ceil(
                          assignments.filter(
                            (assignment) => assignment.status !== "completed",
                          ).length / ASSIGNMENTS_PER_PAGE,
                        )
                      }
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
            color="bg-brand-orange/10 text-[var(--brand-orange)]"
            action={
              <button
                onClick={() => router.push("/admin/programs")}
                className="text-[10px] font-bold text-[var(--brand-orange)] uppercase hover:underline"
              >
                {t("admin.viewAllPrograms")}
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
              subtitle={t("admin.sectionSubtitles.adminsAndStaff")}
              onClick={() => router.push("/admin/communications/contacts")}
              loading={loading}
            />
            <StatCard
              title={t("admin.projects")}
              value={stats.projects ?? stats.totalProjects ?? 0}
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
                  activity.slice(0, 6).map((log, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-tertiary transition-colors group"
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
                          {new Date(log.timestamp).toLocaleTimeString(lang)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--border-primary)]" />
                    </div>
                  ))
                ) : (
                  <AppEmptyState
                    size="sm"
                    icon={Sparkles}
                    title={t("reports.noActivity")}
                  />
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
                  activePrograms.map((program, _i) => (
                    <div
                      key={program.id}
                      onClick={() => router.push(`/admin/programs/${program.id}`)}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-tertiary transition-all cursor-pointer group border border-transparent hover:border-[var(--border-primary)]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)] group-hover:scale-110 transition-transform">
                        <Rocket className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                          {program.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase px-1.5 py-0.5 bg-emerald-500/10 rounded">
                            {programStatusLabel(program.status)}
                          </span>
                          <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                            {new Date(program.created_at).toLocaleDateString(lang)}
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
              {kpiSummary.map((program) => (
                <div
                  key={program.id}
                  onClick={() => router.push(`/admin/programs/${program.id}`)}
                  className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-emerald-500/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">{program.name}</span>
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                      program.avg_kpi_rate >= 70 ? "bg-emerald-500/10 text-emerald-400" :
                      program.avg_kpi_rate >= 40 ? "bg-amber-500/10 text-amber-400" :
                      "bg-rose-500/10 text-rose-400"
                    )}>{program.avg_kpi_rate}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)] mb-2">
                    <Target className="w-3 h-3" /> {program.kpi_count} KPIs
                    <span className={cn("ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold",
                      program.status === 'Active' ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary text-[var(--text-secondary)]"
                    )}>{programStatusLabel(program.status)}</span>
                  </div>
                  <div className="h-2 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all",
                      program.avg_kpi_rate >= 70 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      program.avg_kpi_rate >= 40 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                      "bg-gradient-to-r from-rose-500 to-rose-400"
                    )} style={{width: `${Math.max(program.avg_kpi_rate, 5)}%`}} />
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
            className="card hover:border-brand-orange/30 transition-all text-left ring-1 ring-brand-orange/20"
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
            className="card hover:border-brand-orange/30 transition-all text-left"
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
            className="card hover:border-brand-orange/30 transition-all text-left"
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
            className="card hover:border-brand-orange/30 transition-all text-left"
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
                    staffReports.filter(
                      (staff) => staff.standups + staff.retros >= 4,
                    ).length
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
                      (staff) =>
                        staff.standups + staff.retros > 0 &&
                        staff.standups + staff.retros < 4,
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
                        (staffA, staffB) =>
                          staffB.standups +
                          staffB.retros -
                          (staffA.standups + staffA.retros),
                      )
                      .map((staff) => {
                        const total = staff.standups + staff.retros;
                        const status =
                          total >= 4
                            ? "active"
                            : total > 0
                              ? "at_risk"
                              : "inactive";
                        return (
                          <tr
                            key={staff.id}
                            className="border-b border-divider/50 hover:bg-tertiary transition-colors"
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                                  {staff.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                                    {staff.name}
                                  </p>
                                  <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                                    {staff.role}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="text-center p-4 text-sm font-bold">
                              {staff.standups}
                            </td>
                            <td className="text-center p-4 text-sm font-bold">
                              {staff.retros}
                            </td>
                            <td className="text-center p-4">
                              <span
                                className={`text-sm font-bold ${staff.blockers > 0 ? "text-rose-500" : "text-[var(--text-secondary)]"}`}
                              >
                                {staff.blockers}
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
                              {staff.latest
                                ? new Date(staff.latest).toLocaleDateString(lang)
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
                  {activeBlockers.slice(0, 5).map((blocker) => (
                    <div
                      key={blocker.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-rose-500/[0.03] border border-rose-500/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[var(--text-primary)]">
                            {blocker.title}
                          </span>
                          {blocker.severity && (
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${blocker.severity === "critical" || blocker.severity === "high" ? "bg-rose-500/10 text-rose-500" : "bg-secondary text-[var(--text-secondary)]"}`}
                            >
                              {levelLabel(blocker.severity)}
                            </span>
                          )}
                        </div>
                        {blocker.task_title && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {t("admin.taskLabel")}: {blocker.task_title}
                          </p>
                        )}
                        {blocker.task_owner && (
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {t("admin.ownerLabel")}: {blocker.task_owner}
                          </p>
                        )}
                      </div>
                      <button
                        disabled={resolvingBlocker !== null}
                        onClick={() => handleResolveBlocker(blocker.id)}
                        className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                      >
                        {resolvingBlocker === blocker.id ? (
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
            className="card w-full max-w-lg space-y-5 border-brand-orange/30 max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
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
                className="p-1 hover:bg-tertiary rounded-lg"
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
                    {new Date(selectedTask.start_date).toLocaleDateString(lang)}
                  </p>
                </div>
              )}
              {selectedTask.end_date && (
                <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                    {t("time.due")}
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {new Date(selectedTask.end_date).toLocaleDateString(lang)}
                  </p>
                </div>
              )}
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                  {t("time.created")}
                </p>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {selectedTask.created_at
                    ? new Date(selectedTask.created_at).toLocaleDateString(lang)
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
            {(selectedTask.blockers || []).filter(
              (blocker) => blocker.status === "active",
            ).length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                  {t("adminMisc.dashboard.blockers")}
                </p>
                {selectedTask.blockers
                  .filter((blocker) => blocker.status === "active")
                  .map((blocker) => (
                    <div
                      key={blocker.id}
                      className="p-2 rounded bg-rose-500/10 text-[10px] text-rose-400 font-bold"
                    >
                      {blocker.title}
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

function formatLabel(value) {
  if (!value || value === "—") return "—";
  if (typeof value !== "string") return String(value);
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
