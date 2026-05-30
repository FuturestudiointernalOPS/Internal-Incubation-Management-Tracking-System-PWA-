"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  Search,
  Filter,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  X,
  ListTodo,
  Eye,
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";

/**
 * SUPER ADMIN TASKS DASHBOARD
 *
 * Full visibility into all tasks across the organization.
 * View, filter, sort, and manage tasks.
 *
 * Columns: Task, Owner, Project, Status, Created, Updated, Carry-Over Count, Blockers
 * Filters: User, Status
 * Sorting: Newest, Oldest, Most Carried Over, Most Recently Updated
 *
 * Statuses: pending, in_progress, blocked, completed, carried_over
 */

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
  },
  in_progress: {
    label: "In Progress",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  blocked: {
    label: "Blocked",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  carried_over: {
    label: "Carried Over",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
};

function formatStatusLabel(status) {
  const config = STATUS_CONFIG[status];
  return config
    ? config.label
    : status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusColor(status) {
  const config = STATUS_CONFIG[status];
  return config ? config.color : "text-slate-400";
}

function getStatusBg(status) {
  const config = STATUS_CONFIG[status];
  return config ? config.bg : "bg-slate-500/10";
}

export default function AdminTasks() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("All Users");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("All Projects");
  const [sortBy, setSortBy] = useState("newest");
  const [viewingTask, setViewingTask] = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, projectRes] = await Promise.all([
        fetch(`/api/tasks?sort=${sortBy}`),
        fetch("/api/projects"),
      ]);
      const taskData = await taskRes.json();
      const projectData = await projectRes.json();
      if (taskData.success) setTasks(taskData.tasks || []);
      if (projectData.success) setProjects(projectData.projects || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Build user list from tasks
  const users = useMemo(() => {
    const userMap = {};
    tasks.forEach((t) => {
      if (t.user_id && !userMap[t.user_id]) {
        userMap[t.user_id] = { id: t.user_id, name: t.user_name };
      }
    });
    return Object.values(userMap);
  }, [tasks]);

  // Build project map
  const projectMap = useMemo(() => {
    const map = { "": null };
    projects.forEach((p) => {
      map[p.id] = p.name || p.title;
    });
    return map;
  }, [projects]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title?.toLowerCase().includes(search.toLowerCase()) ||
        t.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        String(t.created_week).includes(search) ||
        String(t.created_year).includes(search);
      const matchesUser =
        filterUser === "All Users" || t.user_id === filterUser;
      const matchesStatus = filterStatus === "all" || t.status === filterStatus;
      const matchesProject =
        filterProject === "All Projects" ||
        (filterProject === "Independent" && !t.project_id) ||
        t.project_id === filterProject;
      return matchesSearch && matchesUser && matchesStatus && matchesProject;
    });
  }, [tasks, search, filterUser, filterStatus, filterProject]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      carriedOver: tasks.filter((t) => t.status === "carried_over").length,
    };
  }, [tasks]);

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTasks();
      } else if (data.hasActiveBlockers) {
        // Attempt with force_complete
        const retryRes = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: taskId,
            status: newStatus,
            force_complete: true,
          }),
        });
        const retryData = await retryRes.json();
        if (retryData.success) fetchTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getCarryOverCount = (task) => {
    if (!task.carried_over_from_task_id) return 0;
    return 1; // Simple: linked to a prior task
  };

  const sortOptions = [
    { id: "newest", label: "Newest First" },
    { id: "oldest", label: "Oldest First" },
    { id: "most_carried", label: "Most Carried Over" },
    { id: "updated", label: "Recently Updated" },
  ];

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20 text-left">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              Dashboard
            </button>
            <div className="flex items-center gap-2 mt-2">
              <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Internal Operations
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Task Management
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-xs font-black">{tasks.length} Tasks</span>
            </div>
            <button
              onClick={fetchTasks}
              className="p-2 rounded-xl hover:bg-white/5 transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </header>

        {/* STATS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "Total",
              value: stats.total,
              color: "text-[var(--text-primary)]",
              bg: "bg-white/5",
            },
            {
              label: "Pending",
              value: stats.pending,
              color: "text-slate-400",
              bg: "bg-slate-500/10",
            },
            {
              label: "In Progress",
              value: stats.inProgress,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              label: "Blocked",
              value: stats.blocked,
              color: "text-rose-500",
              bg: "bg-rose-500/10",
            },
            {
              label: "Completed",
              value: stats.completed,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Carried Over",
              value: stats.carriedOver,
              color: "text-amber-500",
              bg: "bg-amber-500/10",
            },
          ].map((stat) => (
            <div key={stat.label} className="card flex items-center gap-3 p-3">
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {stat.label}
                </p>
                <p className={`text-base font-black ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* FILTERS + SORTING */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, users, weeks..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>

          <div className="relative">
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option>All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
              <option value="carried_over">Carried Over</option>
            </select>
          </div>

          <div className="relative">
            <ListTodo className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option>All Projects</option>
              <option value="Independent">Independent Tasks</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              {sortOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TASKS TABLE */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : filteredTasks.length === 0 ? (
          <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
            <ListTodo className="w-16 h-16 mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              No tasks found
            </p>
            <p className="text-[9px] text-slate-500 mt-2">
              Tasks will appear here once created during standups.
            </p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Task
                    </th>
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Owner
                    </th>
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Project
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Created
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Updated
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Carry-Over
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Blockers
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-4">
                        <button
                          onClick={() => setViewingTask(task)}
                          className="text-left group"
                        >
                          <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)] group-hover:text-[var(--brand-orange)] transition-colors">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[8px] font-black uppercase">
                            {task.user_name?.charAt(0) || "?"}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            {task.user_name || "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[9px] font-bold text-indigo-500">
                          {task.project_id
                            ? projectMap[task.project_id] ||
                              `Project #${task.project_id}`
                            : "Independent"}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${getStatusBg(task.status)} ${getStatusColor(task.status)}`}
                        >
                          {formatStatusLabel(task.status)}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-[9px] font-bold text-slate-500">
                          W{task.created_week}·{task.created_year}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-[9px] text-slate-500">
                          {new Date(
                            task.updated_at || task.created_at,
                          ).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span
                          className={`text-[10px] font-black ${task.carried_over_from_task_id ? "text-amber-500" : "text-slate-600"}`}
                        >
                          {getCarryOverCount(task)}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        {task.blockers && task.blockers.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <Shield className="w-3 h-3 text-rose-500" />
                            <span className="text-[10px] font-bold text-rose-500">
                              {task.blockers.length}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="text-center p-4">
                        <div className="flex items-center justify-center gap-1">
                          {task.status !== "completed" &&
                            task.status !== "carried_over" && (
                              <>
                                {task.status !== "in_progress" && (
                                  <button
                                    onClick={() =>
                                      handleStatusUpdate(task.id, "in_progress")
                                    }
                                    className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-all"
                                    title="Mark In Progress"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {task.status !== "blocked" && (
                                  <button
                                    onClick={() =>
                                      handleStatusUpdate(task.id, "blocked")
                                    }
                                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all"
                                    title="Mark Blocked"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(task.id, "completed")
                                  }
                                  className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-500 transition-all"
                                  title="Mark Completed"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          <button
                            onClick={() => setViewingTask(task)}
                            className="p-1.5 rounded-lg hover:bg-slate-500/10 text-slate-500 transition-all"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TASK DETAIL MODAL */}
        {viewingTask && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setViewingTask(null)}
            />
            <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-lg p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                  Task Details
                </h3>
                <button
                  onClick={() => setViewingTask(null)}
                  className="p-2 rounded-lg hover:bg-white/5 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Title
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {viewingTask.title}
                  </p>
                </div>

                {viewingTask.description && (
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Description
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {viewingTask.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Owner
                    </p>
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {viewingTask.user_name || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Project
                    </p>
                    <p className="text-xs font-bold text-indigo-500">
                      {viewingTask.project_id
                        ? projectMap[viewingTask.project_id] ||
                          `Project #${viewingTask.project_id}`
                        : "Independent Task"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Status
                    </p>
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${getStatusBg(viewingTask.status)} ${getStatusColor(viewingTask.status)}`}
                    >
                      {formatStatusLabel(viewingTask.status)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Carry-Over Count
                    </p>
                    <p className="text-xs font-bold text-amber-500">
                      {getCarryOverCount(viewingTask)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Created
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      Week {viewingTask.created_week} ·{" "}
                      {viewingTask.created_year}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Last Updated
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">
                      {new Date(
                        viewingTask.updated_at || viewingTask.created_at,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {viewingTask.completed_at && (
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Completed At
                    </p>
                    <p className="text-[10px] font-bold text-emerald-500">
                      {new Date(viewingTask.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {viewingTask.carried_over_from_task_id && (
                  <div className="bg-amber-500/5 p-3 rounded-xl">
                    <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">
                      Carry-Over Chain
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Originally created as Task #
                      {viewingTask.carried_over_from_task_id}
                    </p>
                  </div>
                )}

                {/* Linked Blockers */}
                {viewingTask.blockers && viewingTask.blockers.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-2">
                      Linked Blockers ({viewingTask.blockers.length})
                    </p>
                    <div className="space-y-1.5">
                      {viewingTask.blockers.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)]"
                        >
                          <span className="text-[10px] font-bold">
                            {b.title}
                          </span>
                          <span
                            className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${b.status === "active" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}
                          >
                            {b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Quick Status Update
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {["pending", "in_progress", "blocked", "completed"].map(
                      (s) => {
                        if (viewingTask.status === s) return null;
                        return (
                          <button
                            key={s}
                            onClick={() => {
                              handleStatusUpdate(viewingTask.id, s);
                              setViewingTask(null);
                            }}
                            className={`text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all ${STATUS_CONFIG[s]?.bg} ${STATUS_CONFIG[s]?.color} ${STATUS_CONFIG[s]?.border} hover:brightness-110`}
                          >
                            {STATUS_CONFIG[s]?.label}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
