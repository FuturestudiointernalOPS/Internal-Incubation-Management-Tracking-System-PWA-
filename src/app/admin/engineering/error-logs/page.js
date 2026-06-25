"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
  Wrench,
  ArrowRight,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

function SeverityBadge({ severity }) {
  const config = {
    critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    fatal: { color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
    error: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    warning: { color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
    info: { color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  };
  const c = config[severity] || config.error;
  return (
    <span
      className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
      style={{ color: c.color, background: c.bg }}
    >
      {severity}
    </span>
  );
}

function ResolvedBadge({ resolved, taskId }) {
  if (resolved) {
    return (
      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
        <CheckCircle2 className="w-2.5 h-2.5" /> Resolved
      </span>
    );
  }
  if (taskId) {
    return (
      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 flex items-center gap-1">
        <Wrench className="w-2.5 h-2.5" /> Task #{taskId}
      </span>
    );
  }
  return (
    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 flex items-center gap-1">
      <AlertCircle className="w-2.5 h-2.5" /> New
    </span>
  );
}

export default function EngineeringErrorLogs() {
  const router = useRouter();
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterResolved, setFilterResolved] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  // Create task modal state
  const [showCreateTask, setShowCreateTask] = useState(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("critical");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskCreating, setTaskCreating] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskSuccess, setTaskSuccess] = useState("");

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      if (filterResolved === "resolved") params.set("resolved", "true");
      else if (filterResolved === "unresolved") params.set("resolved", "false");
      if (search) params.set("search", search);

      const res = await fetch(`/api/errors?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setErrors(data.errors || []);
      }
    } catch (e) {
      console.error("Failed to fetch errors", e);
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterResolved, search]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setTaskCreating(true);
    setTaskError("");
    setTaskSuccess("");

    try {
      const res = await fetch("/api/engineering/errors/create-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error_id: showCreateTask.id,
          title: taskTitle,
          description: `Auto-created from Error Log #${showCreateTask.id}: ${showCreateTask.message}`,
          priority: taskPriority,
          assignee: taskAssignee || null,
          due_date: taskDueDate || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTaskSuccess(`Development task #${data.task_id} created successfully!`);
        setShowCreateTask(null);
        setTaskTitle("");
        setTaskPriority("critical");
        setTaskAssignee("");
        setTaskDueDate("");
        fetchErrors();
      } else {
        setTaskError(data.error || "Failed to create task");
      }
    } catch (e) {
      setTaskError("Network error. Please try again.");
    } finally {
      setTaskCreating(false);
    }
  };

  const openCreateTask = (error) => {
    setShowCreateTask(error);
    setTaskTitle(`Fix: ${error.message?.substring(0, 80) || "Error"}`);
    setTaskPriority(error.severity === "critical" || error.severity === "fatal" ? "critical" : "high");
    setTaskAssignee("");
    setTaskDueDate("");
    setTaskError("");
    setTaskSuccess("");
  };

  const handleToggleResolved = async (id, currentlyResolved) => {
    try {
      await fetch("/api/errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resolved: !currentlyResolved,
        }),
      });
      fetchErrors();
    } catch (e) {
      console.error("Failed to update error", e);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="engineering">
      <div className="space-y-8 pb-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Engineering Operations
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Error Logs
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {errors.length} total errors — Convert errors to development tasks
            </p>
          </div>
          <button
            onClick={fetchErrors}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search error messages..."
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 font-bold text-xs transition-all"
            />
          </div>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={filterResolved}
            onChange={(e) => setFilterResolved(e.target.value)}
            className="px-3 py-3 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="all">All Status</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </div>

        {/* Errors List */}
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
        ) : errors.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">
              {search || filterSeverity !== "all" || filterResolved !== "all"
                ? "No matches"
                : "No errors captured"}
            </p>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {search || filterSeverity !== "all" || filterResolved !== "all"
                ? "Try different filters"
                : "Errors will appear here when something goes wrong."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((error) => (
              <div
                key={error.id}
                className={`ios-card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all ${
                  !error.resolved && !error.task_id
                    ? "border-l-4 border-l-amber-500"
                    : ""
                }`}
              >
                {/* Summary Row */}
                <button
                  onClick={() => toggleExpand(error.id)}
                  className="w-full flex flex-col lg:flex-row items-stretch text-left"
                >
                  <div className="flex-1 p-4 flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {expandedId === error.id ? (
                        <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={error.severity} />
                        <ResolvedBadge
                          resolved={error.resolved}
                          taskId={error.task_id}
                        />
                      </div>
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {error.message || "No message"}
                      </p>
                    </div>
                    <div className="hidden lg:flex items-center gap-4 flex-shrink-0">
                      {error.page && (
                        <span className="text-[8px] font-bold text-slate-500 max-w-[120px] truncate">
                          {error.page}
                        </span>
                      )}
                      {error.user_id && (
                        <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {error.user_name || error.user_id}
                        </span>
                      )}
                      <span className="text-[8px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />{" "}
                        {error.created_at
                          ? new Date(error.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Detail */}
                {expandedId === error.id && (
                  <div className="border-t border-[var(--border-primary)] bg-tertiary/50">
                    <div className="p-4 space-y-4">
                      {/* Error Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {error.page && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Page</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{error.page}</p>
                          </div>
                        )}
                        {error.action_attempted && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Action Attempted</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{error.action_attempted}</p>
                          </div>
                        )}
                        {error.method && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Method</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{error.method}</p>
                          </div>
                        )}
                        {error.endpoint && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Endpoint</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)] truncate">{error.endpoint}</p>
                          </div>
                        )}
                        {error.status_code && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status Code</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{error.status_code}</p>
                          </div>
                        )}
                        {error.user_name && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">User</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">{error.user_name}</p>
                          </div>
                        )}
                        {error.created_at && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)]">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Date & Time</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)]">
                              {new Date(error.created_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {error.url && (
                          <div className="p-3 rounded-xl bg-primary border border-[var(--border-primary)] md:col-span-2">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">URL</p>
                            <p className="text-xs font-bold mt-0.5 text-[var(--text-primary)] truncate">{error.url}</p>
                          </div>
                        )}
                      </div>

                      {/* Stack Trace */}
                      {error.stack && (
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Stack Trace</p>
                          <pre className="text-[9px] font-mono text-[var(--text-secondary)] bg-primary rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto border border-[var(--border-primary)]">
                            {error.stack}
                          </pre>
                        </div>
                      )}

                      {/* Linked Task Info */}
                      {error.task_id && (
                        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">
                            Linked Development Task
                          </p>
                          <p className="text-xs font-bold text-[var(--text-primary)]">
                            Development Task #{error.task_id} has been created for this error.
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {!error.task_id && !error.resolved && (
                          <button
                            onClick={() => openCreateTask(error)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-[var(--brand-orange)] text-black hover:opacity-90 transition-all"
                          >
                            <Wrench className="w-3.5 h-3.5" /> Create Development Task
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleResolved(error.id, !!error.resolved)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                          style={{
                            background: error.resolved
                              ? "rgba(239,68,68,0.15)"
                              : "rgba(100,100,100,0.1)",
                            color: error.resolved
                              ? "var(--chart-danger, #ef4444)"
                              : "var(--text-secondary)",
                          }}
                        >
                          {error.resolved ? (
                            <>
                              <AlertCircle className="w-3.5 h-3.5" /> Mark Unresolved
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Task Modal */}
        {showCreateTask && (
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
                  onClick={() => setShowCreateTask(null)}
                  className="p-2 hover:bg-tertiary rounded-lg transition-all"
                >
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">
                  From Error Log #{showCreateTask.id}
                </p>
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">
                  {showCreateTask.message}
                </p>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">
                    Task Title
                  </label>
                  <input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                    className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest block mb-1.5">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
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
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/50 transition-all"
                    />
                  </div>
                </div>

                {taskError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] font-bold text-red-400">{taskError}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={taskCreating}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {taskCreating ? (
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
                    onClick={() => setShowCreateTask(null)}
                    className="px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:bg-tertiary transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {taskSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-400">{taskSuccess}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
