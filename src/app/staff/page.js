"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  Shield,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowRight,
  FileText,
  Activity,
  Zap,
  X,
  ChevronDown,
  MoreHorizontal,
  TrendingUp,
  Briefcase,
  Users,
  Rocket,
  Search,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * STAFF DASHBOARD — WORK EXECUTION SYSTEM
 *
 * Calendar-based task visualization + Linear task prioritization list.
 * Integrates with existing Internal Reports (Standup + Retro).
 *
 * Views:
 *   - Month Calendar: tasks mapped to start_date / end_date
 *   - Task Priority List: all tasks sorted by status
 *   - Unscheduled / Backlog: tasks without dates
 *
 * Data source: /api/tasks (reused, no new backend)
 */

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

const STATUS_SORT_ORDER = {
  in_progress: 0,
  blocked: 1,
  carried_over: 2,
  pending: 3,
  completed: 4,
};

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
  return days;
}

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

function isToday(d) {
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function StaffDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // Detail drawer
  const [selectedTask, setSelectedTask] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [ownedProjects, setOwnedProjects] = useState([]);
  const [collabProjects, setCollabProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [updateModal, setUpdateModal] = useState(null); // project object or null
  const [updateForm, setUpdateForm] = useState({
    accomplishments: "",
    current_focus: "",
    blockers: "",
    next_steps: "",
    overall_status: "on_track",
  });
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [activeBlockers, setActiveBlockers] = useState([]);
  const [blockersLoading, setBlockersLoading] = useState(false);
  const [resolvingBlocker, setResolvingBlocker] = useState(null);

  // Auth
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (
          !data.authenticated ||
          !["staff", "super_admin", "teacher", "program_manager"].includes(
            data.user.role,
          )
        ) {
          router.replace("/login");
          return;
        }
        setUser(data.user);
      } catch {
        router.replace("/login");
      }
    }
    checkAuth();
  }, [router]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    setLoading(true);
    try {
      const userId = user.cid || user.id;
      const res = await fetch(`/api/tasks?user_id=${userId}`);
      const data = await res.json();
      if (data.success) setTasks(data.tasks || []);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch assignments (tasks assigned TO the user by someone else)
  const fetchAssignments = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    setAssignmentsLoading(true);
    try {
      const userId = user.cid || user.id;
      const res = await fetch(`/api/tasks?assigned_to=${userId}&brief=true`);
      const data = await res.json();
      if (data.success) setAssignments(data.tasks || []);
    } catch (e) {
      console.error("Failed to fetch assignments:", e);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [user]);

  // Fetch projects where user is owner or collaborator
  const fetchProjects = useCallback(async () => {
    if (!user?.cid && !user?.id) return;
    setProjectsLoading(true);
    try {
      const userId = user.cid || user.id;

      // Fetch all projects with stats (for owned projects)
      const [allRes, collabRes] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch(`/api/projects?user_cid=${userId}`),
      ]);

      const allData = await allRes.json();
      const collabData = await collabRes.json();

      if (allData.success) {
        const allProjects = allData.projects || [];
        // Owned: owner_id matches user, OR assigned_pm_id in meta matches
        const owned = allProjects.filter((p) => {
          // Check owner_id column
          if (p.owner_id && String(p.owner_id) === String(userId)) return true;
          // Check meta.assigned_pm_id (legacy)
          if (p.meta) {
            const meta =
              typeof p.meta === "string" ? JSON.parse(p.meta) : p.meta;
            if (
              meta.assigned_pm_id &&
              String(meta.assigned_pm_id) === String(userId)
            )
              return true;
          }
          return false;
        });
        setOwnedProjects(owned);
      }

      if (collabData.success) {
        const joinedProjects = collabData.projects || [];
        // Collaborating: user is in project_members but not owner
        const collab = joinedProjects.filter((p) => {
          return !(p.owner_id && String(p.owner_id) === String(userId));
        });
        setCollabProjects(collab);
      }
    } catch (e) {
      console.error("Failed to fetch projects:", e);
    } finally {
      setProjectsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch active blockers for resolve-able view
  const fetchBlockers = useCallback(async () => {
    setBlockersLoading(true);
    try {
      const res = await fetch("/api/admin/blockers?status=active");
      const data = await res.json();
      if (data.success) setActiveBlockers(data.blockers || []);
    } catch (e) {
      console.error("Failed to fetch blockers:", e);
    } finally {
      setBlockersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlockers();
  }, [fetchBlockers]);

  const handleResolveBlocker = async (blockerId) => {
    setResolvingBlocker(blockerId);
    try {
      const res = await fetch("/api/admin/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blockerId,
          resolved_by: user.cid || user.id,
        }),
      });
      const data = await res.json();
      if (data.success) fetchBlockers();
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingBlocker(null);
    }
  };

  // ─── TASK GROUPING ───
  const { calendarTasks, unscheduledTasks, sortedTasks, stats } =
    useMemo(() => {
      const cal = {};
      const unscheduled = [];
      const s = {
        total: tasks.length,
        pending: 0,
        active: 0,
        blocked: 0,
        completed: 0,
        carried: 0,
        overdue: 0,
      };

      tasks.forEach((task) => {
        if (STATUS_CONFIG[task.status])
          s[
            task.status === "in_progress"
              ? "active"
              : task.status === "carried_over"
                ? "carried"
                : task.status
          ]++;
        const key = task.status === "completed" ? "completed" : "other";

        // Check overdue: active/blocked/carried tasks past end_date
        if (task.end_date && !["completed", "pending"].includes(task.status)) {
          const end = new Date(task.end_date);
          if (
            end < new Date() &&
            end.toDateString() !== new Date().toDateString()
          )
            s.overdue++;
        }

        // Calendar: tasks with dates
        if (task.start_date || task.end_date) {
          const start = task.start_date ? new Date(task.start_date) : null;
          const end = task.end_date ? new Date(task.end_date) : null;

          // Spread across range
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
        } else {
          unscheduled.push(task);
        }
      });

      const sorted = [...tasks].sort((a, b) => {
        const orderA = STATUS_SORT_ORDER[a.status] ?? 99;
        const orderB = STATUS_SORT_ORDER[b.status] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      return {
        calendarTasks: cal,
        unscheduledTasks: unscheduled,
        sortedTasks: sorted,
        stats: s,
      };
    }, [tasks]);

  // ─── CALENDAR ───
  const calendarDays = getCalendarDays(calYear, calMonth);
  const todayStr = formatDate(now.getFullYear(), now.getMonth(), now.getDate());

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

  // ─── ASSIGNMENT RESPONSE (Accept / Decline) ───
  const handleAssignmentAction = async (taskId, action) => {
    try {
      const res = await fetch("/api/tasks/assignment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          user_id: user.cid || user.id,
          user_name: user.name,
          action,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAssignments();
        fetchTasks();
      }
    } catch (e) {
      console.error("Assignment action error:", e);
    }
  };

  // ─── TASK STATUS UPDATE ───
  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          user_id: user.cid || user.id,
          user_name: user.name,
        }),
      });
      const data = await res.json();
      if (data.success) fetchTasks();
      else if (data.hasActiveBlockers && newStatus === "completed") {
        if (confirm("This task has active blockers. Force complete anyway?")) {
          await fetch("/api/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: taskId,
              status: "completed",
              force_complete: true,
              user_id: user.cid || user.id,
            }),
          });
          fetchTasks();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── RENDER ───
  return (
    <DashboardLayout role={user?.role || "staff"}>
      <div className="space-y-8 pb-20 text-left">
        {/* ═══════ HEADER ═══════ */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-[var(--border-primary)] pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                My Work
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase">
              {user?.name || "Loading"}{" "}
              <span className="text-[var(--text-secondary)] opacity-30 text-2xl">
                · {user?.role?.replace(/_/g, " ") || ""}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              {stats.total} Tasks ·{" "}
              {stats.overdue > 0 && (
                <span className="text-rose-400">{stats.overdue} Overdue</span>
              )}
            </span>
          </div>
        </header>

        {/* ═══════ STATS ROW ═══════ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            {
              label: "Active",
              value: stats.active,
              icon: Target,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Pending",
              value: stats.pending,
              icon: Clock,
              color: "text-slate-400",
              bg: "bg-slate-500/10",
            },
            {
              label: "Blocked",
              value: stats.blocked,
              icon: Shield,
              color: "text-rose-400",
              bg: "bg-rose-500/10",
            },
            {
              label: "Carried",
              value: stats.carried,
              icon: TrendingUp,
              color: "text-indigo-400",
              bg: "bg-indigo-500/10",
            },
            {
              label: "Completed",
              value: stats.completed,
              icon: CheckCircle2,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
            },
          ].map((item) => (
            <div key={item.label} className="card !p-3 flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${item.bg}`}>
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {item.label}
                </p>
                <p className={`text-base font-black ${item.color}`}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════ QUICK ACTIONS ═══════ */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/staff/op-report")}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <FileText className="w-4 h-4" /> Open Report
          </button>
          <button
            onClick={() => router.push("/staff/op-report")}
            className="flex items-center gap-2 px-5 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <CheckCircle2 className="w-4 h-4" /> Standup
          </button>
          <button
            onClick={() => router.push("/staff/op-report")}
            className="flex items-center gap-2 px-5 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <TrendingUp className="w-4 h-4" /> Retro
          </button>
        </div>

        {/* ═══════ ASSIGNMENTS INBOX ═══════ */}
        {assignments.filter((a) => a.status !== "completed").length > 0 &&
          !assignmentsLoading && (
            <div className="card border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                  My Assignments
                </span>
                <span className="text-[9px] font-bold text-slate-500 ml-auto">
                  {assignments.filter((a) => a.status === "pending").length}{" "}
                  pending ·{" "}
                  {assignments.filter((a) => a.status !== "completed").length}{" "}
                  total
                </span>
              </div>
              <div className="space-y-1.5">
                {assignments
                  .filter((a) => a.status !== "completed")
                  .map((task) => {
                    const isPending = task.status === "pending";
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          isPending
                            ? "border-amber-500/20 bg-amber-500/[0.03]"
                            : "border-[var(--border-primary)] bg-secondary"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[7px] font-black uppercase">
                          {(task.user_name || task.assigned_to || "?").charAt(
                            0,
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                              {task.title}
                            </span>
                            <span
                              className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                (
                                  STATUS_CONFIG[task.status] ||
                                  STATUS_CONFIG.pending
                                ).bg
                              } ${
                                (
                                  STATUS_CONFIG[task.status] ||
                                  STATUS_CONFIG.pending
                                ).color
                              }`}
                            >
                              {
                                (
                                  STATUS_CONFIG[task.status] ||
                                  STATUS_CONFIG.pending
                                ).label
                              }
                            </span>
                          </div>
                          <p className="text-[8px] text-slate-500 mt-0.5">
                            Assigned by: {task.user_name || "System"}
                            {task.project_id &&
                              ` · Project: #${task.project_id}`}
                            {task.end_date &&
                              ` · Due: ${new Date(task.end_date).toLocaleDateString()}`}
                          </p>
                        </div>
                        {isPending ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() =>
                                handleAssignmentAction(task.id, "accepted")
                              }
                              className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                handleAssignmentAction(task.id, "declined")
                              }
                              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                            >
                              Decline
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
                            className="px-3 py-1.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-lg text-[8px] font-black uppercase tracking-widest hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        {/* ═══════ MAIN GRID: Calendar + Task List ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── LEFT: CALENDAR ─── */}
          <div className="lg:col-span-2">
            <div className="card">
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
                    {MONTHS[calMonth]} {calYear}
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
                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
                  >
                    Today
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg hover:bg-tertiary transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px bg-[var(--border-primary)] rounded-lg overflow-hidden">
                {/* Day headers */}
                {DAYS.map((d) => (
                  <div key={d} className="bg-primary p-2 text-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {d}
                    </span>
                  </div>
                ))}

                {/* Day cells */}
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
                          className={`text-[9px] font-bold ${isCurrent ? "text-[var(--brand-orange)]" : "text-slate-500"}`}
                        >
                          {day}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[8px] font-bold text-slate-600">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 3).map((task) => (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[8px] font-bold truncate leading-tight ${STATUS_CONFIG[task.status]?.bg || "bg-slate-500/10"} ${STATUS_CONFIG[task.status]?.color || "text-slate-400"} hover:brightness-110 transition-all`}
                          >
                            {task.title}
                          </button>
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-[7px] text-slate-600 pl-1">
                            +{dayTasks.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-[var(--border-primary)]">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                      {cfg.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── UNSCHEDULED / BACKLOG ─── */}
            {unscheduledTasks.length > 0 && (
              <div className="card mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                    Unscheduled / Backlog
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 ml-auto">
                    {unscheduledTasks.length} items
                  </span>
                </div>
                <div className="space-y-1">
                  {unscheduledTasks.slice(0, 5).map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-tertiary transition-all text-left"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[task.status]?.dot || "bg-slate-400"}`}
                      />
                      <span className="flex-1 text-[11px] font-bold text-[var(--text-primary)] truncate">
                        {task.title}
                      </span>
                      <span
                        className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${STATUS_CONFIG[task.status]?.bg || "bg-slate-500/10"} ${STATUS_CONFIG[task.status]?.color || "text-slate-400"}`}
                      >
                        {STATUS_CONFIG[task.status]?.label || task.status}
                      </span>
                    </button>
                  ))}
                  {unscheduledTasks.length > 5 && (
                    <p className="text-[9px] text-slate-500 text-center pt-1">
                      +{unscheduledTasks.length - 5} more unscheduled
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT: TASK PRIORITY LIST ─── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  Task List
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-500">
                {sortedTasks.length} tasks
              </span>
            </div>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {loading ? (
                <div className="text-center py-8 text-[10px] text-slate-500 italic">
                  Loading...
                </div>
              ) : sortedTasks.length === 0 ? (
                <div className="card py-12 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
                  <Zap className="w-10 h-10 mb-2" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">
                    No tasks yet
                  </p>
                  <p className="text-[8px] text-slate-500 mt-1">
                    Create one in your next standup.
                  </p>
                </div>
              ) : (
                sortedTasks.map((task) => {
                  const cfg =
                    STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                  const isOverdue =
                    task.end_date &&
                    !["completed", "pending"].includes(task.status) &&
                    new Date(task.end_date) <
                      new Date(new Date().toDateString());

                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left hover:border-[var(--brand-orange)]/30 ${
                        isOverdue
                          ? "border-rose-500/20 bg-rose-500/[0.03]"
                          : "border-[var(--border-primary)] bg-secondary"
                      }`}
                    >
                      {/* Quick status toggle */}
                      <div className="flex flex-col gap-1 pt-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextStatus =
                              task.status === "in_progress"
                                ? "completed"
                                : task.status === "pending"
                                  ? "in_progress"
                                  : "in_progress";
                            if (task.status !== "completed")
                              updateTaskStatus(task.id, nextStatus);
                          }}
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            task.status === "completed"
                              ? "bg-emerald-500 border-emerald-500"
                              : task.status === "in_progress"
                                ? "border-blue-400"
                                : task.status === "blocked"
                                  ? "border-rose-400"
                                  : "border-slate-600"
                          }`}
                        >
                          {task.status === "completed" && (
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          )}
                        </button>
                      </div>

                      {/* Task info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold text-[var(--text-primary)] truncate ${task.status === "completed" ? "line-through opacity-50" : ""}`}
                          >
                            {task.title}
                          </span>
                          {isOverdue && (
                            <span className="text-[7px] font-black text-rose-400 uppercase tracking-wider bg-rose-500/10 px-1 py-0.5 rounded shrink-0">
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                          {task.blockers?.length > 0 &&
                            task.status !== "completed" && (
                              <span className="flex items-center gap-1 text-[8px] text-rose-400">
                                <Shield className="w-2.5 h-2.5" />{" "}
                                {
                                  task.blockers.filter(
                                    (b) => b.status === "active",
                                  ).length
                                }
                              </span>
                            )}
                          {task.end_date && (
                            <span className="text-[8px] text-slate-500">
                              {new Date(task.end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-1" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ PROJECTS TABLE ═══════ */}
      {(ownedProjects.length > 0 || collabProjects.length > 0) &&
        !projectsLoading && (
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Project
                    </th>
                    <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Role
                    </th>
                    <th className="text-center p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="text-center p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Tasks
                    </th>
                    <th className="text-center p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Blockers
                    </th>
                    <th className="text-right p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Update
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ownedProjects.map((project) => (
                    <tr
                      key={project.id}
                      onClick={() =>
                        router.push(`/admin/projects/${project.id}`)
                      }
                      className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center shrink-0">
                            <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                          </div>
                          <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {project.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-[8px] font-black uppercase tracking-wider text-[var(--brand-orange)]">
                          Owner
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                            project.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : project.status === "Paused"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-slate-500/10 text-slate-500"
                          }`}
                        >
                          {project.status || "Active"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[11px] font-bold">
                          {project.taskStats?.total || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {(project.blockerStats?.active || 0) > 0 ? (
                          <span className="text-[11px] font-bold text-rose-500">
                            {project.blockerStats.active}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpdateModal(project);
                            setUpdateForm({
                              accomplishments: "",
                              current_focus: "",
                              blockers: "",
                              next_steps: "",
                              overall_status: "on_track",
                            });
                          }}
                          className="text-[7px] font-black uppercase tracking-widest text-[var(--brand-orange)] hover:brightness-110 px-2 py-1 rounded-lg hover:bg-[var(--brand-orange)]/10 transition-all"
                        >
                          Post Update
                        </button>
                      </td>
                    </tr>
                  ))}
                  {collabProjects.map((project) => (
                    <tr
                      key={`collab-${project.id}`}
                      onClick={() =>
                        router.push(`/admin/projects/${project.id}`)
                      }
                      className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center shrink-0">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                          </div>
                          <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {project.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-[8px] font-black uppercase tracking-wider text-blue-500">
                          Collaborator
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                            project.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : project.status === "Paused"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-slate-500/10 text-slate-500"
                          }`}
                        >
                          {project.status || "Active"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[11px] font-bold">
                          {project.taskStats?.total || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {(project.blockerStats?.active || 0) > 0 ? (
                          <span className="text-[11px] font-bold text-rose-500">
                            {project.blockerStats.active}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-[7px] text-slate-600">—</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* ═══════ ACTIVE BLOCKERS ═══════ */}
      {activeBlockers.length > 0 && !blockersLoading && (
        <div className="card border-l-4 border-l-rose-500">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-rose-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">
              Active Blockers
            </span>
            <span className="text-[9px] font-bold text-slate-500 ml-auto">
              {activeBlockers.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {activeBlockers.map((blocker) => (
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
                        className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                          blocker.severity === "critical" ||
                          blocker.severity === "high"
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-slate-500/10 text-slate-500"
                        }`}
                      >
                        {blocker.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-[8px] text-slate-500 mt-0.5">
                    Task: {blocker.task_title || `#${blocker.task_id}`}
                    {blocker.task_owner && <> · Owner: {blocker.task_owner}</>}
                  </p>
                </div>
                <button
                  onClick={() => handleResolveBlocker(blocker.id)}
                  disabled={resolvingBlocker === blocker.id}
                  className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                >
                  {resolvingBlocker === blocker.id ? "..." : "Resolve"}
                </button>
              </div>
            ))}
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
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.pending).bg} ${(STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.pending).color}`}
                  >
                    {
                      (
                        STATUS_CONFIG[selectedTask.status] ||
                        STATUS_CONFIG.pending
                      ).label
                    }
                  </span>
                  {selectedTask.end_date &&
                    !["completed", "pending"].includes(selectedTask.status) &&
                    new Date(selectedTask.end_date) <
                      new Date(new Date().toDateString()) && (
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

            {/* Meta */}
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
              {selectedTask.end_date && (
                <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Due
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {new Date(selectedTask.end_date).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Created
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {selectedTask.created_at
                    ? new Date(selectedTask.created_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              {selectedTask.reschedule_count > 0 && (
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-1">
                    Rescheduled
                  </p>
                  <p className="text-xs font-bold text-amber-400">
                    {selectedTask.reschedule_count}x
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            {selectedTask.description && (
              <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Description
                </p>
                <p className="text-xs font-bold text-[var(--text-primary)] whitespace-pre-wrap">
                  {selectedTask.description}
                </p>
              </div>
            )}

            {/* Quick status controls */}
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Update Status
              </p>
              <div className="flex gap-2">
                {["pending", "in_progress", "completed"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      updateTaskStatus(selectedTask.id, s);
                      setSelectedTask(null);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                      selectedTask.status === s
                        ? `${(STATUS_CONFIG[s] || STATUS_CONFIG.pending).bg} ${(STATUS_CONFIG[s] || STATUS_CONFIG.pending).color} border-transparent`
                        : "bg-primary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {(STATUS_CONFIG[s] || STATUS_CONFIG.pending).label}
                  </button>
                ))}
              </div>
            </div>

            {/* Blockers */}
            {selectedTask.blockers && selectedTask.blockers.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Blockers
                </p>
                <div className="space-y-1.5">
                  {selectedTask.blockers.map((b) => (
                    <div
                      key={b.id}
                      className={`flex items-center justify-between p-2 rounded-lg border ${b.status === "active" ? "border-rose-500/20 bg-rose-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}
                    >
                      <div className="flex items-center gap-2">
                        <Shield
                          className={`w-3 h-3 ${b.status === "active" ? "text-rose-400" : "text-emerald-400"}`}
                        />
                        <span className="text-[11px] font-bold text-[var(--text-primary)]">
                          {b.title}
                        </span>
                      </div>
                      <span
                        className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${b.status === "active" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}
                      >
                        {b.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ WEEKLY UPDATE MODAL ═══════ */}
      {updateModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setUpdateModal(null)}
        >
          <div
            className="card w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                  Weekly Update
                </h2>
              </div>
              <button onClick={() => setUpdateModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[10px] text-slate-500 font-bold">
              {updateModal.name}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Overall Status
                </label>
                <select
                  value={updateForm.overall_status}
                  onChange={(e) =>
                    setUpdateForm((f) => ({
                      ...f,
                      overall_status: e.target.value,
                    }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer"
                >
                  <option value="on_track">On Track</option>
                  <option value="at_risk">At Risk</option>
                  <option value="behind">Behind</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Accomplishments
                </label>
                <textarea
                  value={updateForm.accomplishments}
                  onChange={(e) =>
                    setUpdateForm((f) => ({
                      ...f,
                      accomplishments: e.target.value,
                    }))
                  }
                  placeholder="What got done?"
                  rows={2}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Current Focus
                </label>
                <textarea
                  value={updateForm.current_focus}
                  onChange={(e) =>
                    setUpdateForm((f) => ({
                      ...f,
                      current_focus: e.target.value,
                    }))
                  }
                  placeholder="What are you working on?"
                  rows={2}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Blockers
                </label>
                <textarea
                  value={updateForm.blockers}
                  onChange={(e) =>
                    setUpdateForm((f) => ({
                      ...f,
                      blockers: e.target.value,
                    }))
                  }
                  placeholder="Any blockers?"
                  rows={1}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Next Steps
                </label>
                <textarea
                  value={updateForm.next_steps}
                  onChange={(e) =>
                    setUpdateForm((f) => ({
                      ...f,
                      next_steps: e.target.value,
                    }))
                  }
                  placeholder="What's next?"
                  rows={1}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  setSavingUpdate(true);
                  try {
                    await fetch(
                      `/api/admin/projects/${updateModal.id}/updates`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          ...updateForm,
                          user_id: user.cid || user.id,
                          user_name: user.name || "",
                          status: "submitted",
                        }),
                      },
                    );
                    setUpdateModal(null);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setSavingUpdate(false);
                  }
                }}
                disabled={
                  savingUpdate ||
                  (!updateForm.accomplishments && !updateForm.current_focus)
                }
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50"
              >
                {savingUpdate ? "Saving..." : "Submit Update"}
              </button>
              <button
                onClick={() => setUpdateModal(null)}
                className="flex-1 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-[var(--text-primary)] transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
