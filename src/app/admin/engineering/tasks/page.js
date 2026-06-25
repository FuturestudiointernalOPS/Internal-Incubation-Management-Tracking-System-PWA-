"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ListTodo,
  RefreshCw,
  Search,
  Wrench,
  ChevronRight,
  Loader2,
  X,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function EngineeringTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [formAssignee, setFormAssignee] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formCreating, setFormCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [developers, setDevelopers] = useState([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      // Get all tasks assigned to someone (development tasks)
      const res = await fetch("/api/engineering/dashboard");
      const data = await res.json();
      if (data.success) {
        setTasks(data.activeTasks || []);
      }
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDevelopers = async () => {
    try {
      const res = await fetch("/api/engineering/developers");
      const data = await res.json();
      if (data.success) {
        setDevelopers(data.developers || []);
      }
    } catch (e) {
      console.error("Failed to fetch developers", e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchDevelopers();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    const matchesSearch =
      !search ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.assignee_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || t.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setFormCreating(true);
    setFormError("");

    try {
      const weekNumber = getWeekNumber(new Date());
      const year = new Date().getFullYear();

      // Get current user info
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      const userId = sessionData.authenticated ? sessionData.user.cid : "system";
      const userName = sessionData.authenticated ? sessionData.user.name : "Engineering Ops";

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          title: formTitle,
          description: formDesc || null,
          priority: formPriority,
          assigned_to: formAssignee || null,
          end_date: formDueDate || null,
          status: "pending",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowCreateModal(false);
        setFormTitle("");
        setFormDesc("");
        setFormPriority("medium");
        setFormAssignee("");
        setFormDueDate("");
        fetchTasks();
      } else {
        setFormError(data.error || "Failed to create task");
      }
    } catch (e) {
      setFormError("Network error");
    } finally {
      setFormCreating(false);
    }
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setFormTitle("");
    setFormDesc("");
    setFormPriority("medium");
    setFormAssignee("");
    setFormDueDate("");
    setFormError("");
  };

  return (
    <DashboardLayout role="super_admin" activeTab="engineering">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Engineering Operations
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Development Tasks
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {tasks.length} active tasks — Assign and manage developer work
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <Wrench className="w-3.5 h-3.5" /> New Task
            </button>
            <button
              onClick={fetchTasks}
              className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{
                borderColor: "rgba(255,102,0,0.1)",
                borderTopColor: "var(--brand-orange)",
              }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {search || statusFilter !== "all" || priorityFilter !== "all"
                ? "No matches"
                : "No active development tasks"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {search || statusFilter !== "all" || priorityFilter !== "all"
                ? "Try different filters"
                : "Create a task or convert an error log to a task"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((task) => (
              <div
                key={task.id}
                className="ios-card !p-4 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          task.priority === "critical"
                            ? "bg-red-500/10 text-red-400"
                            : task.priority === "high"
                              ? "bg-amber-500/10 text-amber-400"
                              : task.priority === "medium"
                                ? "bg-blue-500/10 text-blue-400"
                                : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {task.priority || "medium"}
                      </span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 uppercase tracking-wider">
                        {task.status?.replace("_", " ") || "pending"}
                      </span>
                      {task.end_date && new Date(task.end_date) < new Date() && task.status !== "completed" && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                      #{task.id} — {task.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {task.assignee_name && (
                        <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {task.assignee_name}
                        </span>
                      )}
                      {task.end_date && (
                        <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{" "}
                          {new Date(task.end_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Task Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wrench className="w-5 h-5 text-[var(--brand-orange)]" />
                  <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                    Create Development Task
                  </h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-tertiary rounded-lg transition-all"
                >
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">
                    Title
                  </label>
                  <input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    placeholder="What needs to be done?"
                    className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    rows={3}
                    placeholder="Details about the task..."
                    className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">
                      Priority
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                      className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">
                      Assignee
                    </label>
                    <select
                      value={formAssignee}
                      onChange={(e) => setFormAssignee(e.target.value)}
                      className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none"
                    >
                      <option value="">Unassigned</option>
                      {developers.map((dev) => (
                        <option key={dev.cid} value={dev.cid}>
                          {dev.name} ({dev.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  />
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] font-bold text-red-400">{formError}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={formCreating}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {formCreating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3.5 h-3.5" /> Create Task
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:bg-tertiary transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}
