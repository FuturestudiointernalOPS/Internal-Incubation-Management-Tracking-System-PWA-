"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, Clock, AlertTriangle, Plus,
  ChevronDown, ChevronRight, Target, Calendar,
  User, ArrowUpRight, Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * UNIFIED OPERATIONS VIEW (Phase 5)
 *
 * Renders the weekly operational dashboard for any context:
 * staff, venture, or participant.
 *
 * Props:
 *   user          — { cid, name, role }
 *   context       — { context_type: 'staff'|'venture'|'participant', context_id?: string }
 *   contextLabel  — display label (e.g., "Future Studio Staff", "Venture: AcmeCorp")
 *   contextId     — the ID of the context entity (venture_id, program_id, or null for staff)
 */
export default function UnifiedOperationsView({
  user,
  context = { context_type: "staff", context_id: null },
  contextLabel = "Internal Operations",
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [weekInfo] = useState(getCurrentWeek());
  const [expandTask, setExpandTask] = useState({});
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchStandup = useCallback(async () => {
    if (!user?.cid) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        user_id: user.cid,
        week: weekInfo.week,
        year: weekInfo.year,
        context_type: context.context_type,
      });
      if (context.context_id) {
        params.set("context_id", context.context_id);
      }

      const res = await fetch(`/api/standups/current?${params}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error("Failed to load standup", e);
    } finally {
      setLoading(false);
    }
  }, [user?.cid, weekInfo.week, weekInfo.year, context]);

  useEffect(() => {
    fetchStandup();
  }, [fetchStandup]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.cid,
          user_name: user.name,
          title: newTaskTitle.trim(),
          created_week: weekInfo.week,
          created_year: weekInfo.year,
          context_type: context.context_type,
          context_id: context.context_id || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewTaskTitle("");
        setShowCreateTask(false);
        fetchStandup();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (e) {
      setToast({ type: "error", message: "Failed to create task" });
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          status: newStatus,
          user_id: user.cid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchStandup();
      } else {
        setToast({ type: "error", message: t(data.error || "") || data.error });
      }
    } catch (e) {
      setToast({ type: "error", message: "Failed to update task" });
    }
  };

  const toggleExpand = (taskId) => {
    setExpandTask((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const blockedCount = tasks.filter((t) => t.status === "blocked").length;
  const activeCount = tasks.filter(
    (t) => !["completed", "archived"].includes(t.status),
  ).length;
  const progress =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Target className="w-5 h-5 text-[var(--brand-orange)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
              {context.context_type === "staff"
                ? "Staff Operations"
                : context.context_type === "venture"
                  ? "Venture Operations"
                  : "Program Operations"}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {contextLabel}
          </h2>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
            Week {weekInfo.week}, {weekInfo.year} —{" "}
            {activeCount} active tasks · {blockedCount} blocked ·{" "}
            {progress}% complete
          </p>
        </div>

        <button
          onClick={() => setShowCreateTask(!showCreateTask)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all"
          style={{
            backgroundColor: "var(--brand-orange)",
            color: "#000",
          }}
        >
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="text-[10px] font-bold px-4 py-2 rounded-lg"
          style={{
            backgroundColor:
              toast.type === "error"
                ? "rgb(239 68 68 / 0.15)"
                : "rgb(34 197 94 / 0.15)",
            color:
              toast.type === "error"
                ? "rgb(252 165 165)"
                : "rgb(134 239 172)",
          }}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}

      {/* Create task form */}
      {showCreateTask && (
        <form
          onSubmit={handleCreateTask}
          className="p-4 rounded-xl border space-y-3"
          style={{
            backgroundColor: "rgb(255 255 255 / 0.03)",
            borderColor: "var(--brand-orange)",
          }}
        >
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full bg-transparent text-[var(--text-primary)] text-sm font-bold outline-none placeholder:text-[var(--text-tertiary)]"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateTask(false)}
              className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newTaskTitle.trim()}
              className="px-4 py-1.5 text-[10px] font-black uppercase rounded-lg disabled:opacity-40"
              style={{ backgroundColor: "var(--brand-orange)", color: "#000" }}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgb(255 255 255 / 0.08)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor:
                progress === 100
                  ? "rgb(34 197 94)"
                  : "var(--brand-orange)",
            }}
          />
        </div>
        <span className="text-[10px] font-black text-[var(--text-secondary)]">
          {progress}%
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completedCount}
          color="rgb(34 197 94)"
        />
        <StatCard
          icon={Clock}
          label="Active"
          value={activeCount}
          color="var(--brand-orange)"
        />
        <StatCard
          icon={AlertTriangle}
          label="Blocked"
          value={blockedCount}
          color="rgb(239 68 68)"
        />
      </div>

      {/* Task list */}
      <div>
        <h3 className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Tasks ({tasks.length})
        </h3>

        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[10px] text-[var(--text-tertiary)]">
              No tasks yet. Create your first task above.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => {
              const isExpanded = expandTask[task.id];
              const isBlocked = task.status === "blocked";
              const isCompleted = task.status === "completed";
              const isCarryover = task.is_carryover;

              return (
                <div
                  key={task.id}
                  className="rounded-xl border transition-all group"
                  style={{
                    backgroundColor: isBlocked
                      ? "rgb(239 68 68 / 0.05)"
                      : "rgb(255 255 255 / 0.02)",
                    borderColor: isExpanded
                      ? "var(--brand-orange)"
                      : "rgb(255 255 255 / 0.06)",
                    opacity: isCompleted ? 0.5 : 1,
                  }}
                >
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => toggleExpand(task.id)}
                  >
                    {/* Status indicator */}
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: isCompleted
                          ? "rgb(34 197 94)"
                          : isBlocked
                            ? "rgb(239 68 68)"
                            : "var(--brand-orange)",
                      }}
                    />

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className="text-[11px] font-bold truncate"
                          style={{
                            color: "var(--text-primary)",
                            textDecoration: isCompleted
                              ? "line-through"
                              : "none",
                          }}
                        >
                          {task.title}
                        </p>
                        {isCarryover && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              backgroundColor: "rgb(168 85 247 / 0.2)",
                              color: "rgb(192 132 252)",
                            }}
                          >
                            W{task.created_week}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            color: isCompleted
                              ? "rgb(34 197 94)"
                              : isBlocked
                                ? "rgb(239 68 68)"
                                : "var(--text-secondary)",
                          }}
                        >
                          {task.status.replace(/_/g, " ")}
                        </span>
                        {task.priority && (
                          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                            · {task.priority}
                          </span>
                        )}
                        {task.blockers?.length > 0 && (
                          <span className="text-[10px] font-medium text-red-400">
                            · {task.blockers.length} blocker
                            {task.blockers.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <ChevronRight
                      className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 transition-transform"
                      style={{
                        transform: isExpanded
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                      }}
                    />
                  </div>

                  {/* Expanded task detail */}
                  {isExpanded && (
                    <div
                      className="px-3 pb-3 space-y-2 border-t"
                      style={{ borderColor: "rgb(255 255 255 / 0.04)" }}
                    >
                      {task.description && (
                        <p className="text-sm text-[var(--text-secondary)] pt-2">
                          {task.description}
                        </p>
                      )}

                      {/* Blockers */}
                      {task.blockers?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">
                            Blockers
                          </p>
                          {task.blockers.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center gap-2 py-1"
                            >
                              <AlertTriangle className="w-3 h-3 text-red-400" />
                              <span className="text-[11px] font-bold text-[var(--text-primary)]">
                                {b.title}
                              </span>
                              <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                                {b.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {!isCompleted && (
                        <div className="flex gap-2 pt-1">
                          {task.status !== "completed" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(task.id, "completed");
                              }}
                              className="flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                              style={{
                                backgroundColor: "rgb(34 197 94 / 0.15)",
                                color: "rgb(134 239 172)",
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" /> Complete
                            </button>
                          )}
                          {task.status !== "in_progress" &&
                            !isCompleted && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(task.id, "in_progress");
                                }}
                                className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                                style={{
                                  backgroundColor:
                                    "rgb(255 255 255 / 0.05)",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                Resume
                              </button>
                            )}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex flex-wrap gap-3 pt-1">
                        {task.start_date && (
                          <span className="text-[10px] font-medium text-[var(--text-tertiary)] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {task.start_date}
                          </span>
                        )}
                        {task.end_date && (
                          <span className="text-[10px] font-medium text-[var(--text-tertiary)] flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" />
                            Due: {task.end_date}
                          </span>
                        )}
                        {task.assigned_to && task.assigned_to !== user?.cid && (
                          <span className="text-[10px] font-medium text-[var(--text-tertiary)] flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Assigned
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Helper component: stat card */
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div
      className="p-3 rounded-xl border"
      style={{
        backgroundColor: "rgb(255 255 255 / 0.02)",
        borderColor: "rgb(255 255 255 / 0.06)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {label}
        </span>
      </div>
      <span className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

/** Helper: current ISO week */
function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 604800000;
  const week = Math.ceil((diff / oneWeek + start.getDay() + 1) / 7);
  return { week: Math.min(week, 52), year: now.getFullYear() };
}
