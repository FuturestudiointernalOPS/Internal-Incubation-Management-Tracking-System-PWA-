"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListTodo,
  Shield,
  Target,
  Rocket,
  Briefcase,
  Users,
  Activity,
  FileText,
  TrendingUp,
  X,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ChevronDown,
  Eye,
  Sparkles,
  Zap,
  Plus,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
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

const EVENT_COLORS = {
  task: "bg-blue-500/10 text-blue-400",
  program: "bg-emerald-500/10 text-emerald-400",
  session: "bg-amber-500/10 text-amber-400",
  deliverable: "bg-purple-500/10 text-purple-400",
  event: "bg-sky-500/10 text-sky-400",
};

const EVENT_DOTS = {
  task: "bg-blue-400",
  program: "bg-emerald-400",
  session: "bg-amber-400",
  deliverable: "bg-purple-400",
  event: "bg-sky-400",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SEVERITY_SORT = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── HELPERS ───────────────────────────────────────────────────────────────

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  return days;
}

function isToday(d) {
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ─── ROLE HIERARCHY HELPERS ────────────────────────────────────────────────

const ROLE_HIERARCHY = {
  super_admin: 5,
  admin: 4,
  program_manager: 3,
  team_lead: 2,
  staff: 1,
  teacher: 1,
};

function hasMinRole(userRole, minRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export default function UnifiedDashboard({ role: propRole }) {
  const router = useRouter();
  const { t } = useI18n();

  // ── Auth / User ──
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Data ──
  const [data, setData] = useState(null);
  const [fetching, setFetching] = useState(true);

  // ── Calendar state ──
  const now = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calView, setCalView] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);

  // ── Detail drawers ──
  const [selectedTask, setSelectedTask] = useState(null);

  // ── Blocker resolve ──
  const [resolvingBlocker, setResolvingBlocker] = useState(null);

  // ── Assignment actions ──
  const [actionLoading, setActionLoading] = useState(null);

  // ── Quick Access collapse ──
  const [expandedPanels, setExpandedPanels] = useState({});

  // ── This Week date range (computed once on mount) ──
  const [weekDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.toDateString());
    const end = new Date(now);
    end.setDate(end.getDate() + (6 - now.getDay()));
    end.setHours(23, 59, 59, 999);
    return { start, end };
  });

  // ── Auth check ──
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        if (session.authenticated) {
          setUser(session.user);
          return;
        }
      } catch (_) {
        // Session API unavailable — fallback below
      }

      // Fallback to localStorage
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        if (stored.cid || stored.id) {
          setUser(stored);
          return;
        }
      } catch (_) {}

      router.replace("/login");
    }
    checkAuth();
  }, [router]);

  // Determine effective role
  const effectiveRole = user?.role || propRole || "staff";

  // Determine what sections to show based on role & data
  const visibility = useMemo(() => {
    const isMgmt = hasMinRole(effectiveRole, "program_manager");
    const hasPrograms = (data?.summary?.programs || 0) > 0;
    const hasProjects = (data?.summary?.projects || 0) > 0;
    const hasTasks = (data?.summary?.tasks?.open || 0) > 0;
    const hasBlockers = (data?.summary?.blockers?.active || 0) > 0;
    const hasOverdue = (data?.attention?.overdueTasks?.length || 0) > 0;
    const hasCritical = (data?.attention?.criticalBlockers?.length || 0) > 0;
    const hasDueToday = (data?.attention?.dueToday?.length || 0) > 0;
    const hasAssignments = (data?.assignments?.length || 0) > 0;
    const hasActivity = (data?.activity?.length || 0) > 0;

    return {
      // Summary cards
      showProgramsCard: isMgmt && hasPrograms,
      showProjectsCard: hasProjects,
      showTasksCard: hasTasks,
      showBlockersCard: hasBlockers,
      showOverdueCard: hasOverdue,
      showCriticalCard: hasCritical,
      // Attention section
      showAttention: hasOverdue || hasCritical || hasDueToday,
      // Activity
      showActivity: hasActivity,
      // Quick access panels
      showQuickPrograms: isMgmt && hasPrograms,
      showQuickProjects: hasProjects,
      showQuickTasks: hasTasks,
      showQuickBlockers: hasBlockers,
      // Assignments section
      showAssignments: hasAssignments,
    };
  }, [effectiveRole, data]);

  // ── Fetch data ──
  const fetchDashboardData = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    setFetching(true);
    try {
      const userId = user.cid || user.id;
      const role = effectiveRole;
      const res = await fetch(
        `/api/dashboard?user_id=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&year=${calYear}&month=${calMonth + 1}`,
      );
      const result = await res.json();
      if (result.success) setData(result);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
      setError("Failed to load dashboard data");
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }, [user, effectiveRole, calYear, calMonth]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user, fetchDashboardData]);

  // ── Calendar navigation ──
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
  const handleToday = () => {
    setCalMonth(now.getMonth());
    setCalYear(now.getFullYear());
  };

  // ── Assignment actions ──
  const handleAssignmentAction = async (taskId, action) => {
    setActionLoading(taskId);
    try {
      await fetch("/api/tasks/assignment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          user_id: user.cid || user.id,
          user_name: user.name,
          action,
        }),
      });
      fetchDashboardData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Blocker resolve ──
  const handleResolveBlocker = async (blockerId) => {
    setResolvingBlocker(blockerId);
    try {
      await fetch("/api/admin/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          resolved_by: user.cid || user.id,
        }),
      });
      fetchDashboardData();
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingBlocker(null);
    }
  };

  // ── Calendar computed ──
  const calendarDays = useMemo(
    () => getCalendarDays(calYear, calMonth),
    [calYear, calMonth],
  );

  // ── Loading state ──
  if (loading) {
    return (
      <DashboardLayout role={effectiveRole}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div
            className="w-10 h-10 border-4 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout role={effectiveRole}>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="card text-center space-y-3 p-8">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-400">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-6 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Derived data ──
  const summary = data?.summary || {};
  const attention = data?.attention || {};
  const events = data?.calendar?.events || [];
  const quickAccess = data?.quickAccess || {};
  const assignments = data?.assignments || [];
  const activity = data?.activity || [];

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role={effectiveRole}>
      <div className="space-y-8 pb-20 text-left">
        {/* ═══════ HEADER ═══════ */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-[var(--border-primary)] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Dashboard
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase">
              {user?.name || "Loading"}
              <span className="text-[var(--text-secondary)] opacity-30 text-2xl ml-2">
                · {effectiveRole?.replace(/_/g, " ") || ""}
              </span>
            </h1>
          </div>
        </header>

        {/* ═══════ SECTION 1: UNIFIED CALENDAR ═══════ */}
        <div className="card !p-3">
          {/* Calendar header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                {MONTHS[calMonth]} {calYear}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggles */}
              <div className="flex gap-0.5 mr-2 border-r border-[var(--border-primary)] pr-2">
                {["month", "week", "day"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setCalView(v)}
                    className={cn(
                      "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded transition-all",
                      calView === v
                        ? "bg-[var(--brand-orange)] text-black"
                        : "text-slate-500 hover:text-[var(--text-primary)]",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-tertiary transition-all"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={handleToday}
                className="px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-tertiary transition-all"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Month View */}
          {calView === "month" && (
            <div className="grid grid-cols-7 gap-px bg-[var(--border-primary)] rounded-lg overflow-hidden">
              {DAYS.map((d) => (
                <div key={d} className="bg-primary p-1 text-center">
                  <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    {d}
                  </span>
                </div>
              ))}
              {calendarDays.map((day, idx) => {
                if (day === null)
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="bg-primary p-1 min-h-[55px]"
                    />
                  );
                const dateStr = formatDate(calYear, calMonth, day);
                const dayEvents = events.filter((e) => e.date === dateStr);
                const current = isToday(new Date(calYear, calMonth, day));
                const past =
                  new Date(calYear, calMonth, day) <
                  new Date(new Date().toDateString());
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "bg-primary p-1 min-h-[55px] transition-all",
                      current && "ring-1 ring-[var(--brand-orange)]/40",
                      past && "opacity-50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "text-[8px] font-bold",
                          current
                            ? "text-[var(--brand-orange)]"
                            : "text-slate-500",
                        )}
                      >
                        {day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[7px] font-bold text-slate-500">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={cn(
                            "w-full text-left px-1 py-0.5 rounded text-[7px] font-bold truncate leading-tight hover:brightness-110 transition-all",
                            EVENT_COLORS[ev.source] ||
                              "bg-slate-500/10 text-slate-400",
                          )}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[6px] text-slate-500 pl-0.5">
                          +{dayEvents.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Week View */}
          {calView === "week" && (
            <div className="space-y-1.5">
              {(() => {
                const startOfWeek = new Date(calYear, calMonth, 1);
                startOfWeek.setDate(
                  startOfWeek.getDate() - startOfWeek.getDay(),
                );
                return Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(startOfWeek);
                  d.setDate(d.getDate() + i);
                  const dateStr = formatDate(
                    d.getFullYear(),
                    d.getMonth(),
                    d.getDate(),
                  );
                  const dayEvents = events.filter((e) => e.date === dateStr);
                  const current = isToday(d);
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-lg",
                        current
                          ? "bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20"
                          : "hover:bg-tertiary",
                      )}
                    >
                      <div className="w-8 text-center shrink-0">
                        <p
                          className={cn(
                            "text-[9px] font-black",
                            current
                              ? "text-[var(--brand-orange)]"
                              : "text-slate-500",
                          )}
                        >
                          {d.getDate()}
                        </p>
                        <p className="text-[6px] font-bold text-slate-600 uppercase">
                          {DAYS[d.getDay()]}
                        </p>
                      </div>
                      <div className="flex-1 space-y-1">
                        {dayEvents.length === 0 && (
                          <p className="text-[8px] text-slate-600 italic">
                            No events
                          </p>
                        )}
                        {dayEvents.map((ev) => (
                          <button
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className="block w-full text-left text-[9px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate"
                          >
                            • {ev.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Day View */}
          {calView === "day" && (
            <div className="space-y-1.5">
              {(() => {
                const today = new Date(calYear, calMonth, now.getDate());
                const dateStr = formatDate(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                );
                const dayEvents = events.filter((e) => e.date === dateStr);
                return (
                  <>
                    <p className="text-[9px] font-bold text-[var(--text-primary)] mb-2">
                      {today.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    {dayEvents.length === 0 && (
                      <p className="text-[8px] text-slate-600 italic">
                        No events scheduled for today
                      </p>
                    )}
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-tertiary transition-all cursor-pointer border border-[var(--border-primary)]"
                      >
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            EVENT_DOTS[ev.source] || "bg-slate-400",
                          )}
                        />
                        <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                          {ev.title}
                        </span>
                        <span className="text-[7px] font-black uppercase tracking-wider text-slate-500">
                          {ev.source}
                        </span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t border-[var(--border-primary)]">
            {Object.entries(EVENT_DOTS).map(([key, dotClass]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", dotClass)} />
                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider">
                  {key}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ ASSIGNED TO ME (always shown above sections if has assignments) ═══════ */}
        {visibility.showAssignments && (
          <div className="card border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-amber-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                Assigned To Me
              </span>
              <span className="text-[9px] font-bold text-slate-500 ml-auto">
                {assignments.filter((a) => a.status === "pending").length}{" "}
                awaiting action
              </span>
            </div>
            <div className="space-y-1.5">
              {assignments.slice(0, 5).map((task) => {
                const isPending = task.status === "pending";
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border",
                      isPending
                        ? "border-amber-500/20 bg-amber-500/[0.03]"
                        : "border-[var(--border-primary)] bg-secondary",
                    )}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[7px] font-black uppercase">
                      {(task.user_name || "?").charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold text-[var(--text-primary)] truncate block">
                        {task.title}
                      </span>
                      <p className="text-[8px] text-slate-500 mt-0.5">
                        Assigned by: {task.user_name || "System"}
                        {task.end_date
                          ? ` \u00B7 Due: ${new Date(task.end_date).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    {isPending ? (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() =>
                            handleAssignmentAction(task.id, "accepted")
                          }
                          disabled={actionLoading === task.id}
                          className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50"
                        >
                          {actionLoading === task.id ? "..." : "Accept"}
                        </button>
                        <button
                          onClick={() =>
                            handleAssignmentAction(task.id, "declined")
                          }
                          disabled={actionLoading === task.id}
                          className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50"
                        >
                          {actionLoading === task.id ? "..." : "Decline"}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          handleAssignmentAction(
                            task.id,
                            "completed_assignment",
                          )
                        }
                        disabled={actionLoading === task.id}
                        className="px-3 py-1.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-lg text-[8px] font-black uppercase tracking-widest hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0 disabled:opacity-50"
                      >
                        {actionLoading === task.id ? "..." : "Complete"}
                      </button>
                    )}
                  </div>
                );
              })}
              {assignments.length > 5 && (
                <button
                  onClick={() => router.push("/admin/tasks")}
                  className="w-full text-center py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
                >
                  View All ({assignments.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550 ATTENTION REQUIRED \u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        {visibility.showAttention && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-400">
                Attention Required
              </span>
            </div>

            {attention.overdueTasks?.length > 0 && (
              <div className="card border-l-4 border-l-rose-500">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">
                    Overdue Tasks ({attention.overdueTasks.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {attention.overdueTasks.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 cursor-pointer hover:brightness-110 transition-all"
                    >
                      <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                        {t.title}
                      </span>
                      {t.priority && (
                        <span
                          className={cn(
                            "text-[7px] font-black uppercase px-1.5 py-0.5 rounded",
                            t.priority === "high" || t.priority === "critical"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-slate-500/10 text-slate-500",
                          )}
                        >
                          {t.priority}
                        </span>
                      )}
                      <span className="text-[8px] text-slate-500 shrink-0">
                        {t.due_date
                          ? new Date(t.due_date).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attention.criticalBlockers?.length > 0 && (
              <div className="card border-l-4 border-l-rose-500">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-rose-500">
                    Critical Blockers ({attention.criticalBlockers.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {attention.criticalBlockers.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 p-2 rounded-xl bg-rose-500/[0.03] border border-rose-500/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[var(--text-primary)]">
                            {b.title}
                          </span>
                          <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">
                            {b.severity}
                          </span>
                        </div>
                        {b.project_id && (
                          <p className="text-[8px] text-slate-500 mt-0.5">
                            Project: #{b.project_id}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleResolveBlocker(b.id)}
                        disabled={resolvingBlocker === b.id}
                        className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                      >
                        {resolvingBlocker === b.id ? "..." : "Resolve"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attention.dueToday?.length > 0 && (
              <div className="card border-l-4 border-l-amber-500">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-400">
                    Due Today ({attention.dueToday.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {attention.dueToday.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 cursor-pointer hover:brightness-110 transition-all"
                    >
                      <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                        {t.title}
                      </span>
                      <span className="text-[7px] font-black text-slate-500 uppercase">
                        {t.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550 CONSOLIDATED WORKSPACE \u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== LEFT COLUMN (2/3) ===== */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Programs — Rich Cards */}
            {visibility.showQuickPrograms && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      My Programs
                    </span>
                    <span className="text-[9px] font-bold text-slate-500">
                      ({quickAccess.programs?.length || 0})
                    </span>
                  </div>
                  <button
                    onClick={() => router.push("/pm/programs")}
                    className="text-[8px] font-black text-[var(--brand-orange)] uppercase hover:underline"
                  >
                    View All
                  </button>
                </div>
                {fetching ? (
                  <div className="flex items-center justify-center py-8">
                    <div
                      className="w-5 h-5 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                      style={{
                        borderColor: "rgba(255,102,0,0.1)",
                        borderTopColor: "var(--brand-orange)",
                      }}
                    />
                  </div>
                ) : quickAccess.programs?.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic py-6 text-center">
                    No programs
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quickAccess.programs?.slice(0, 4).map((p) => {
                      const progress = p.completion_index || 0;
                      return (
                        <div
                          key={p.id}
                          onClick={() => router.push(`/pm/programs/${p.id}`)}
                          className="p-4 rounded-xl bg-primary border border-[var(--border-primary)] hover:border-emerald-500/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">
                              {p.status || "Active"}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate group-hover:text-emerald-400 transition-colors">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="text-[8px] text-slate-500 mt-1 line-clamp-2">
                              {p.description}
                            </p>
                          )}
                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between items-end">
                              <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">
                                Progress
                              </span>
                              <span className="text-[9px] font-black text-emerald-400">
                                {Number(progress).toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-primary)]">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* My Tasks — Compact List */}
            {visibility.showQuickTasks && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-blue-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      My Tasks
                    </span>
                    <span className="text-[9px] font-bold text-slate-500">
                      ({quickAccess.tasks?.length || 0})
                    </span>
                  </div>
                  <button
                    onClick={() => router.push("/staff/op-report")}
                    className="text-[8px] font-black text-[var(--brand-orange)] uppercase hover:underline"
                  >
                    Open Report
                  </button>
                </div>
                {fetching ? (
                  <div className="flex items-center justify-center py-8">
                    <div
                      className="w-5 h-5 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                      style={{
                        borderColor: "rgba(255,102,0,0.1)",
                        borderTopColor: "var(--brand-orange)",
                      }}
                    />
                  </div>
                ) : quickAccess.tasks?.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic py-6 text-center">
                    No active tasks
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {quickAccess.tasks?.slice(0, 6).map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTask(t)}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-tertiary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)]"
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            STATUS_CONFIG[t.status]?.dot || "bg-slate-400",
                          )}
                        />
                        <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 truncate">
                          {t.title}
                        </span>
                        {t.end_date && (
                          <span
                            className={cn(
                              "text-[8px] font-bold shrink-0",
                              new Date(t.end_date) < new Date() &&
                                t.status !== "completed"
                                ? "text-rose-500"
                                : "text-slate-500",
                            )}
                          >
                            {new Date(t.end_date).toLocaleDateString("en", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-[7px] font-black uppercase px-1.5 py-0.5 rounded shrink-0",
                            STATUS_CONFIG[t.status]?.bg || "bg-slate-500/10",
                            STATUS_CONFIG[t.status]?.color || "text-slate-500",
                          )}
                        >
                          {STATUS_CONFIG[t.status]?.label || t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent Activity */}
            {visibility.showActivity && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--brand-orange)]" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                      Recent Activity
                    </span>
                  </div>
                  <button
                    onClick={() => router.push("/admin/op-reports")}
                    className="text-[8px] font-black text-[var(--brand-orange)] uppercase hover:underline"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-1.5">
                  {activity.slice(0, 5).map((act, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-tertiary transition-all border border-transparent hover:border-[var(--border-primary)]"
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center shrink-0">
                        {act.action?.includes("completed") ||
                        act.action?.includes("resolved") ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : act.action?.includes("blocker") ? (
                          <Shield className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-[var(--text-primary)] capitalize truncate">
                          {act.action?.replace(/_/g, " ")}
                        </p>
                        <p className="text-[8px] text-slate-500 truncate">
                          {act.description}
                        </p>
                      </div>
                      <span className="text-[8px] text-slate-600 shrink-0">
                        {act.timestamp
                          ? new Date(act.timestamp).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===== RIGHT COLUMN (1/3) — SIDEBAR ===== */}
          <div className="space-y-6">
            {/* Quick Stats — Compact Inline Badges */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  Quick Stats
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-lg font-black text-emerald-400">
                    {summary.programs || 0}
                  </p>
                  <p className="text-[7px] font-black text-emerald-600/60 uppercase tracking-widest mt-0.5">
                    Programs
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-lg font-black text-blue-400">
                    {summary.tasks?.open || 0}
                  </p>
                  <p className="text-[7px] font-black text-blue-600/60 uppercase tracking-widest mt-0.5">
                    Open Tasks
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                  <p className="text-lg font-black text-rose-400">
                    {summary.blockers?.active || 0}
                  </p>
                  <p className="text-[7px] font-black text-rose-600/60 uppercase tracking-widest mt-0.5">
                    Active Blockers
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <p className="text-lg font-black text-amber-400">
                    {summary.overdueTasks || 0}
                  </p>
                  <p className="text-[7px] font-black text-amber-600/60 uppercase tracking-widest mt-0.5">
                    Overdue
                  </p>
                </div>
              </div>
            </div>

            {/* My Projects — With Role Status */}
            {visibility.showQuickProjects && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="w-4 h-4 text-[var(--brand-orange)]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    My Projects
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 ml-auto">
                    {quickAccess.projects?.length || 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {quickAccess.projects?.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => router.push(`/admin/projects/${p.id}`)}
                      className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-tertiary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)]"
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center shrink-0">
                        <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                            {p.status || "Active"}
                          </span>
                          <span className="text-[7px] font-black uppercase tracking-wider text-[var(--brand-orange)]">
                            {p.role === "owner" ? "Owner" : "Collaborator"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!quickAccess.projects ||
                    quickAccess.projects.length === 0) && (
                    <p className="text-[10px] text-slate-500 italic py-4 text-center">
                      No projects assigned
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Active Blockers — With Inline Resolve */}
            {visibility.showQuickBlockers && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-rose-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    Active Blockers
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 ml-auto">
                    {quickAccess.blockers?.length || 0}
                  </span>
                </div>
                {fetching ? (
                  <div className="flex justify-center py-6">
                    <div
                      className="w-4 h-4 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
                      style={{
                        borderColor: "rgba(255,102,0,0.1)",
                        borderTopColor: "var(--brand-orange)",
                      }}
                    />
                  </div>
                ) : quickAccess.blockers?.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic py-4 text-center">
                    No active blockers
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {quickAccess.blockers?.slice(0, 5).map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/[0.02] border border-rose-500/5"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                            {b.title}
                          </p>
                          {b.severity && (
                            <span className="text-[6px] font-black uppercase tracking-wider text-rose-500/60">
                              {b.severity}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleResolveBlocker(b.id)}
                          disabled={resolvingBlocker === b.id}
                          className="px-2 py-1 bg-emerald-500 text-black rounded-lg text-[7px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                        >
                          {resolvingBlocker === b.id ? "..." : "Resolve"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Events — From Calendar */}
            {events.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                    This Week
                  </span>
                </div>
                <div className="space-y-1.5">
                  {events
                    .filter((e) => {
                      const d = new Date(e.date);
                      return d >= weekDateRange.start && d <= weekDateRange.end;
                    })
                    .slice(0, 5)
                    .map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-tertiary transition-all border border-transparent hover:border-[var(--border-primary)] text-left"
                      >
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            EVENT_DOTS[ev.source] || "bg-slate-400",
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-[var(--text-primary)] truncate">
                            {ev.title}
                          </p>
                          <p className="text-[7px] text-slate-500">
                            {new Date(ev.date).toLocaleDateString("en", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* ═══════ EMPTY STATE (when nothing is visible) ═══════ */}
        {!visibility.showAssignments &&
          !visibility.showAttention &&
          !visibility.showActivity &&
          !visibility.showQuickPrograms &&
          !visibility.showQuickTasks &&
          !visibility.showQuickBlockers &&
          !fetching && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Activity className="w-16 h-16 text-slate-700" />
              <p className="text-base font-black text-slate-600 uppercase tracking-widest">
                Welcome to your dashboard
              </p>
              <p className="text-[10px] text-slate-700">
                Start by creating tasks or joining projects.
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => router.push("/admin/tasks")}
                  className="px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                >
                  <Plus className="w-4 h-4 inline mr-1" /> Create Task
                </button>
                <button
                  onClick={() => router.push("/admin/projects")}
                  className="px-6 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  View Projects
                </button>
              </div>
            </div>
          )}
      </div>

      {/* ═══════ EVENT DETAIL DRAWER ═══════ */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="card w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                  Event
                </h3>
              </div>
              <button onClick={() => setSelectedEvent(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {selectedEvent.title}
            </p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                  Date
                </p>
                <p className="font-bold">{selectedEvent.date}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                  Source
                </p>
                <p className="font-bold capitalize">{selectedEvent.source}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                  Type
                </p>
                <p className="font-bold capitalize">
                  {selectedEvent.type?.replace(/_/g, " ")}
                </p>
              </div>
              {selectedEvent.status && (
                <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                  <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">
                    Status
                  </p>
                  <p className="font-bold capitalize">{selectedEvent.status}</p>
                </div>
              )}
            </div>
            {selectedEvent.project_id && (
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  router.push(`/admin/projects/${selectedEvent.project_id}`);
                }}
                className="w-full py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
              >
                View Related Project
              </button>
            )}
          </div>
        </div>
      )}

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
                  {selectedTask.status && (
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                        (
                          STATUS_CONFIG[selectedTask.status] ||
                          STATUS_CONFIG.pending
                        ).bg,
                        (
                          STATUS_CONFIG[selectedTask.status] ||
                          STATUS_CONFIG.pending
                        ).color,
                      )}
                    >
                      {
                        (
                          STATUS_CONFIG[selectedTask.status] ||
                          STATUS_CONFIG.pending
                        ).label
                      }
                    </span>
                  )}
                  {selectedTask.due_date && (
                    <span className="text-[8px] font-black text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                      Overdue
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">
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
            {(selectedTask.due_date || selectedTask.start_date) && (
              <div className="grid grid-cols-2 gap-3">
                {selectedTask.start_date && (
                  <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Start
                    </p>
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {new Date(selectedTask.start_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Due
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {selectedTask.due_date
                      ? new Date(selectedTask.due_date).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
            )}
            {selectedTask.priority && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-slate-500 uppercase">
                  Priority:
                </span>
                <span
                  className={cn(
                    "text-[8px] font-black uppercase px-2 py-0.5 rounded",
                    selectedTask.priority === "critical" ||
                      selectedTask.priority === "high"
                      ? "bg-rose-500/10 text-rose-500"
                      : "bg-slate-500/10 text-slate-500",
                  )}
                >
                  {selectedTask.priority}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card !p-4 hover:bg-tertiary transition-all text-left group"
    >
      <Icon className={cn("w-5 h-5 mb-2", color)} />
      <p className="text-2xl font-black text-[var(--text-primary)]">
        {value ?? "—"}
      </p>
      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
        {label}
      </p>
    </button>
  );
}

function QuickAccessPanel({
  title,
  icon: Icon,
  color,
  count,
  viewAllHref,
  loading,
  emptyMessage,
  children,
}) {
  const router = useRouter();
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
          {title}
        </span>
        <span className="text-[9px] font-bold text-slate-500 ml-auto">
          {count}
        </span>
      </div>
      {loading ? (
        <div className="py-8 text-center">
          <div
            className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin mx-auto"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      ) : count === 0 ? (
        <p className="text-[10px] text-slate-500 italic py-6 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-1">
          {children}
          {viewAllHref && count > 0 && (
            <button
              onClick={() => router.push(viewAllHref)}
              className="w-full text-center py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mt-1"
            >
              View All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
