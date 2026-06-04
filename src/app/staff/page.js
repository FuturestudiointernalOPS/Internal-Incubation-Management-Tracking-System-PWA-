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
        </header>

        {/* ═══════ MAIN GRID: Calendar + Side Panel ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── LEFT: CALENDAR (PRIMARY WIDGET) ─── */}
          <div className="lg:col-span-2">
            <div className="card">
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
              <div className="grid grid-cols-7 gap-px bg-[var(--border-primary)] rounded-lg overflow-hidden">
                {DAYS.map((d) => (
                  <div key={d} className="bg-primary p-2 text-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {d}
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
          </div>

          {/* ─── RIGHT: SUMMARY PANEL ─── */}
          <div className="space-y-3">
            {/* Upcoming Work */}
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                  Upcoming
                </span>
              </div>
              {(() => {
                const today = new Date();
                const todayStr = formatDate(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                );
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = formatDate(
                  tomorrow.getFullYear(),
                  tomorrow.getMonth(),
                  tomorrow.getDate(),
                );
                const todayTasks = calendarTasks[todayStr] || [];
                const tomorrowTasks = calendarTasks[tomorrowStr] || [];
                if (todayTasks.length === 0 && tomorrowTasks.length === 0) {
                  return (
                    <p className="text-[9px] text-slate-500 italic">
                      No upcoming items
                    </p>
                  );
                }
                return (
                  <>
                    {todayTasks.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Today
                        </p>
                        {todayTasks.slice(0, 2).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTask(t)}
                            className="block w-full text-left text-[10px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate py-0.5"
                          >
                            • {t.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {tomorrowTasks.length > 0 && (
                      <div>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Tomorrow
                        </p>
                        {tomorrowTasks.slice(0, 2).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTask(t)}
                            className="block w-full text-left text-[10px] font-bold text-[var(--text-primary)] hover:text-[var(--brand-orange)] truncate py-0.5"
                          >
                            • {t.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* My Tasks Summary */}
            <div
              onClick={() => router.push("/staff/op-report")}
              className="card cursor-pointer hover:bg-tertiary transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <ListTodo className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  My Tasks
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-black text-blue-400">
                    {stats.active}
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    Active
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-rose-400">
                    {stats.overdue}
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    Overdue
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-400">
                    {stats.completed}
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    Done
                  </p>
                </div>
              </div>
            </div>

            {/* My Projects Summary */}
            <div
              onClick={() => router.push("/admin/projects")}
              className="card cursor-pointer hover:bg-tertiary transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  My Projects
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-lg font-black text-[var(--brand-orange)]">
                    {ownedProjects.length}
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    Owned
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-blue-400">
                    {collabProjects.length}
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    Collab
                  </p>
                </div>
              </div>
            </div>

            {/* Active Blockers Summary */}
            <div
              onClick={() => router.push("/admin/blockers")}
              className="card cursor-pointer hover:bg-tertiary transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  Blockers
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-lg font-black text-rose-400">
                    {activeBlockers.length}
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    Active
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black text-rose-500">
                    {
                      activeBlockers.filter(
                        (b) =>
                          b.severity === "high" || b.severity === "critical",
                      ).length
                    }
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                    High
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ ASSIGNED TO ME ═══════ */}
        {assignments.filter((a) => a.status !== "completed").length > 0 &&
          !assignmentsLoading && (
            <div
              className="card border-l-4 border-l-amber-500"
              id="assignments-section"
            >
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
                {assignments
                  .filter((a) => a.status !== "completed")
                  .map((task) => {
                    const isPending = task.status === "pending";
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${isPending ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-[var(--border-primary)] bg-secondary"}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[7px] font-black uppercase">
                          {(task.user_name || task.assigned_to || "?").charAt(
                            0,
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-[var(--text-primary)] truncate block">
                            {task.title}
                          </span>
                          <p className="text-[8px] text-slate-500 mt-0.5">
                            Assigned by: {task.user_name || "System"}
                            {task.end_date
                              ? ` · Due: ${new Date(task.end_date).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        {isPending ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() =>
                                handleAssignmentAction(task.id, "accepted")
                              }
                              className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() =>
                                handleAssignmentAction(task.id, "declined")
                              }
                              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[8px] font-black uppercase tracking-widest hover:brightness-110"
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

        {/* ═══════ QUICK ACTIONS ═══════ */}
        <div className="flex flex-wrap gap-3" id="quick-actions">
          <button
            onClick={() => router.push("/staff/op-report")}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <FileText className="w-4 h-4" /> Standup
          </button>
          <button
            onClick={() => router.push("/staff/op-report")}
            className="flex items-center gap-2 px-5 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <TrendingUp className="w-4 h-4" /> Retro
          </button>
          <button
            onClick={() => router.push("/admin/projects")}
            className="flex items-center gap-2 px-5 py-3 bg-tertiary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <Rocket className="w-4 h-4" /> Projects
          </button>
        </div>
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
                    className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${selectedTask.status === s ? `${(STATUS_CONFIG[s] || STATUS_CONFIG.pending).bg} ${(STATUS_CONFIG[s] || STATUS_CONFIG.pending).color} border-transparent` : "bg-primary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}
                  >
                    {(STATUS_CONFIG[s] || STATUS_CONFIG.pending).label}
                  </button>
                ))}
              </div>
            </div>
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
                    setUpdateForm((f) => ({ ...f, blockers: e.target.value }))
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
                    setUpdateForm((f) => ({ ...f, next_steps: e.target.value }))
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
                        headers: { "Content-Type": "application/json" },
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
