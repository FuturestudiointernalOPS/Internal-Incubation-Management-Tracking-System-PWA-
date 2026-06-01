"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutGrid,
  Table2,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Shield,
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  Briefcase,
  User,
  Calendar,
  Plus,
  X,
  ChevronDown,
  Eye,
  Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

/**
 * OPERATIONS COMMAND CENTER
 *
 * Centralized work management hub for Super Admin.
 * Unifies tasks, projects, categories, and blockers in one view.
 *
 * Views:
 *   - Table: default operational view with all fields
 *   - Board: Kanban-style by status
 *
 * Filters:
 *   - Status, Project, Category (from Phase 1), Search (title/owner)
 *   - Date range (this week, last week, this month, custom)
 */

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    boardBg: "bg-slate-500/5",
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    boardBg: "bg-blue-500/5",
  },
  blocked: {
    label: "Blocked",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    boardBg: "bg-rose-500/5",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    boardBg: "bg-emerald-500/5",
  },
  carried_over: {
    label: "Carried Over",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    boardBg: "bg-indigo-500/5",
  },
};

const DATE_PRESETS = [
  { id: "all", label: "All Time" },
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
];

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export default function WorkManagementHub() {
  const router = useRouter();
  const { t } = useI18n();

  // Data
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // View
  const [viewMode, setViewMode] = useState("table"); // "table" | "board"

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [filterDate, setFilterDate] = useState("all");

  // Detail modal
  const [viewingTask, setViewingTask] = useState(null);

  // Derived user list
  const users = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (t.user_id && !map[t.user_id]) {
        map[t.user_id] = { id: t.user_id, name: t.user_name || t.user_id };
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Project lookup
  const projectMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, projectRes, catRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/projects?include_archived=true"),
        fetch("/api/categories"),
      ]);
      const taskData = await taskRes.json();
      const projectData = await projectRes.json();
      const catData = await catRes.json();
      if (taskData.success) setTasks(taskData.tasks || []);
      if (projectData.success) setProjects(projectData.projects || []);
      if (catData.success) setCategories(catData.categories || []);
    } catch (e) {
      console.error("Work hub fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── FILTERING ───
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          (t.title || "").toLowerCase().includes(q) ||
          (t.user_name || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Status
      if (filterStatus !== "all" && t.status !== filterStatus) return false;

      // Project
      if (filterProject === "independent" && t.project_id) return false;
      if (
        filterProject !== "all" &&
        filterProject !== "independent" &&
        String(t.project_id) !== filterProject
      )
        return false;

      // Category
      if (filterCategory !== "all" && t.category !== filterCategory)
        return false;

      // User
      if (filterUser !== "all" && t.user_id !== filterUser) return false;

      // Date
      if (filterDate !== "all") {
        const now = new Date();
        const currentWeek = getWeekNumber(now);
        const currentYear = now.getFullYear();
        const taskWeek = t.created_week || currentWeek;
        const taskYear = t.created_year || currentYear;

        if (filterDate === "this_week") {
          if (taskWeek !== currentWeek || taskYear !== currentYear)
            return false;
        } else if (filterDate === "last_week") {
          const lastWeek = currentWeek === 1 ? 52 : currentWeek - 1;
          const lastYear = currentWeek === 1 ? currentYear - 1 : currentYear;
          if (taskWeek !== lastWeek || taskYear !== lastYear) return false;
        } else if (filterDate === "this_month") {
          const taskDate = t.created_at ? new Date(t.created_at) : now;
          if (
            taskDate.getMonth() !== now.getMonth() ||
            taskDate.getFullYear() !== now.getFullYear()
          )
            return false;
        }
      }

      return true;
    });
  }, [
    tasks,
    search,
    filterStatus,
    filterProject,
    filterCategory,
    filterUser,
    filterDate,
  ]);

  // ─── STATS ───
  const stats = useMemo(
    () => ({
      total: filteredTasks.length,
      pending: filteredTasks.filter((t) => t.status === "pending").length,
      inProgress: filteredTasks.filter((t) => t.status === "in_progress")
        .length,
      blocked: filteredTasks.filter((t) => t.status === "blocked").length,
      completed: filteredTasks.filter((t) => t.status === "completed").length,
      carriedOver: filteredTasks.filter((t) => t.status === "carried_over")
        .length,
      activeBlockers: filteredTasks.reduce(
        (sum, t) =>
          sum + (t.blockers || []).filter((b) => b.status === "active").length,
        0,
      ),
    }),
    [filteredTasks],
  );

  // ─── RENDERERS ───
  const renderTaskRow = (task) => {
    const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
    const activeBlockers = (task.blockers || []).filter(
      (b) => b.status === "active",
    );
    const projectName = task.project_id ? projectMap[task.project_id] : null;

    return (
      <tr
        key={task.id}
        className="border-b border-[var(--border-primary)]/40 hover:bg-[var(--bg-tertiary)]/50 transition-colors cursor-pointer"
        onClick={() => setViewingTask(task)}
      >
        <td className="p-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${config.color.replace("text-", "bg-")}`}
            />
            <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[220px]">
              {task.title}
            </span>
          </div>
        </td>
        <td className="p-3">
          {projectName ? (
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">
              {projectName}
            </span>
          ) : task.category ? (
            <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider">
              {task.category.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="text-[9px] text-slate-500 italic">—</span>
          )}
        </td>
        <td className="p-3">
          <span className="text-[10px] font-bold text-slate-400">
            {task.user_name || "—"}
          </span>
        </td>
        <td className="p-3">
          <span
            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${config.bg} ${config.color}`}
          >
            {config.label}
          </span>
        </td>
        <td className="p-3">
          {activeBlockers.length > 0 ? (
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-rose-400" />
              <span className="text-[10px] font-bold text-rose-400">
                {activeBlockers.length}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-slate-600">—</span>
          )}
        </td>
        <td className="p-3 text-right">
          <span className="text-[9px] text-slate-500">
            {task.created_week ? `W${task.created_week}` : "—"}
          </span>
        </td>
      </tr>
    );
  };

  const renderBoardColumn = (statusKey) => {
    const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
    const columnTasks = filteredTasks.filter((t) => t.status === statusKey);

    return (
      <div key={statusKey} className="flex-shrink-0 w-72">
        <div
          className={`rounded-xl border ${config.border} ${config.boardBg} p-3`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${config.color.replace("text-", "bg-")}`}
              />
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${config.color}`}
              >
                {config.label}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-primary px-2 py-0.5 rounded-full">
              {columnTasks.length}
            </span>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto custom-scrollbar pr-1">
            {columnTasks.length === 0 ? (
              <p className="text-[9px] text-slate-600 italic text-center py-6">
                No tasks
              </p>
            ) : (
              columnTasks.map((task) => {
                const projectName = task.project_id
                  ? projectMap[task.project_id]
                  : null;
                const activeBlockers = (task.blockers || []).filter(
                  (b) => b.status === "active",
                );

                return (
                  <div
                    key={task.id}
                    onClick={() => setViewingTask(task)}
                    className="bg-primary rounded-xl border border-[var(--border-primary)] p-3 cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all space-y-2"
                  >
                    <p className="text-[11px] font-bold text-[var(--text-primary)] leading-tight line-clamp-2">
                      {task.title}
                    </p>
                    <div className="flex items-center justify-between">
                      {projectName ? (
                        <span className="text-[8px] font-bold text-blue-400 uppercase tracking-wider">
                          {projectName}
                        </span>
                      ) : task.category ? (
                        <span className="text-[8px] font-bold text-purple-400 uppercase tracking-wider">
                          {task.category.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span />
                      )}
                      {activeBlockers.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5 text-rose-400" />
                          <span className="text-[8px] font-bold text-rose-400">
                            {activeBlockers.length}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-slate-500">
                        {task.user_name || "—"}
                      </span>
                      <span className="text-[8px] text-slate-500">
                        W{task.created_week || "—"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const BOARD_STATUSES = [
    "pending",
    "in_progress",
    "blocked",
    "carried_over",
    "completed",
  ];

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-6 pb-20 text-left">
        {/* ─── HEADER ─── */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-[var(--border-primary)] pb-6">
          <div className="space-y-1">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              Dashboard
            </button>
            <div className="flex items-center gap-2 mt-1">
              <LayoutGrid className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Operations Command Center
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Work Management
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAll}
              className="p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        </header>

        {/* ─── EXECUTIVE METRICS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <div className="card !p-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-500/10">
              <ListTodo className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Total
              </p>
              <p className="text-base font-black">{stats.total}</p>
            </div>
          </div>
          <div className="card !p-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Target className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Active
              </p>
              <p className="text-base font-black text-blue-400">
                {stats.inProgress}
              </p>
            </div>
          </div>
          <div className="card !p-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Completed
              </p>
              <p className="text-base font-black text-emerald-400">
                {stats.completed}
              </p>
            </div>
          </div>
          <div className="card !p-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Carried
              </p>
              <p className="text-base font-black text-indigo-400">
                {stats.carriedOver}
              </p>
            </div>
          </div>
          <div className="card !p-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10">
              <Shield className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Blockers
              </p>
              <p className="text-base font-black text-rose-400">
                {stats.activeBlockers}
              </p>
            </div>
          </div>
          <div className="card !p-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Pending
              </p>
              <p className="text-base font-black text-amber-400">
                {stats.pending}
              </p>
            </div>
          </div>
          <div className="card !p-3 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-slate-500/10">
              <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div>
              <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                Blocked
              </p>
              <p className="text-base font-black">{stats.blocked}</p>
            </div>
          </div>
        </div>

        {/* ─── FILTERS BAR ─── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, owners..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg py-2.5 pl-9 pr-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>

          {/* Project filter */}
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="all">All Projects</option>
            <option value="independent">Independent Work</option>
            {projects
              .filter((p) => p.status !== "Archived")
              .map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
          </select>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.label}
              </option>
            ))}
          </select>

          {/* User filter */}
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            <option value="all">All Staff</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Date filter */}
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
          >
            {DATE_PRESETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-md transition-all ${viewMode === "table" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              title="Table View"
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`p-2 rounded-md transition-all ${viewMode === "board" ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
              title="Board View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Result count */}
          <span className="text-[10px] font-bold text-slate-500 ml-auto">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ─── CONTENT ─── */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : filteredTasks.length === 0 && search ? (
          <div className="card py-20 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
            <Search className="w-10 h-10 mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              No matching tasks
            </p>
            <p className="text-[9px] text-slate-500 mt-1">
              Try adjusting your filters.
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* ─── TABLE VIEW ─── */
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Task
                    </th>
                    <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Project / Category
                    </th>
                    <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Owner
                    </th>
                    <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="text-left p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Blockers
                    </th>
                    <th className="text-right p-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Week
                    </th>
                  </tr>
                </thead>
                <tbody>{filteredTasks.map(renderTaskRow)}</tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ─── BOARD VIEW (Kanban) ─── */
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {BOARD_STATUSES.map(renderBoardColumn)}
          </div>
        )}

        {/* ─── TASK DETAIL MODAL ─── */}
        {viewingTask && (
          <div
            className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setViewingTask(null)}
          >
            <div
              className="card w-full max-w-lg space-y-5 border-[var(--brand-orange)]/30 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {(viewingTask.blockers || []).filter(
                      (b) => b.status === "active",
                    ).length > 0 && (
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${(STATUS_CONFIG[viewingTask.status] || STATUS_CONFIG.pending).bg} ${(STATUS_CONFIG[viewingTask.status] || STATUS_CONFIG.pending).color}`}
                    >
                      {
                        (
                          STATUS_CONFIG[viewingTask.status] ||
                          STATUS_CONFIG.pending
                        ).label
                      }
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-[var(--text-primary)]">
                    {viewingTask.title}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingTask(null)}
                  className="p-1 hover:bg-white/5 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Owner
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {viewingTask.user_name || "—"}
                  </p>
                </div>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Project
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {viewingTask.project_id
                      ? projectMap[viewingTask.project_id] || "—"
                      : viewingTask.category
                        ? viewingTask.category.replace(/_/g, " ")
                        : "Independent"}
                  </p>
                </div>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Created
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {viewingTask.created_at
                      ? new Date(viewingTask.created_at).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Week
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    W{viewingTask.created_week || "—"} ·{" "}
                    {viewingTask.created_year || "—"}
                  </p>
                </div>
              </div>

              {/* Schedule Drift (Phase 11) — visible to Super Admin */}
              {(viewingTask.first_scheduled_start_date ||
                viewingTask.first_scheduled_end_date ||
                viewingTask.reschedule_count > 0) && (
                <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                  <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Schedule Drift
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    {viewingTask.reschedule_count > 0 && (
                      <div>
                        <p className="text-[8px] text-slate-500">Rescheduled</p>
                        <p className="font-bold text-amber-400">
                          {viewingTask.reschedule_count}x
                        </p>
                      </div>
                    )}
                    {viewingTask.first_scheduled_start_date && (
                      <div>
                        <p className="text-[8px] text-slate-500">First Start</p>
                        <p className="font-bold text-[var(--text-primary)]">
                          {viewingTask.first_scheduled_start_date}
                        </p>
                      </div>
                    )}
                    {viewingTask.first_scheduled_end_date && (
                      <div>
                        <p className="text-[8px] text-slate-500">First End</p>
                        <p className="font-bold text-[var(--text-primary)]">
                          {viewingTask.first_scheduled_end_date}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Description */}
              {viewingTask.description && (
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Description
                  </p>
                  <p className="text-xs font-bold text-[var(--text-primary)] whitespace-pre-wrap">
                    {viewingTask.description}
                  </p>
                </div>
              )}

              {/* Dates */}
              {(viewingTask.start_date || viewingTask.end_date) && (
                <div className="grid grid-cols-2 gap-3">
                  {viewingTask.start_date && (
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Start
                      </p>
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {viewingTask.start_date}
                      </p>
                    </div>
                  )}
                  {viewingTask.end_date && (
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Due
                      </p>
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {viewingTask.end_date}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Blockers */}
              {viewingTask.blockers && viewingTask.blockers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Blockers
                  </p>
                  {viewingTask.blockers.map((b) => (
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
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
