"use client";

import { useState } from "react";
import {
  ListTodo,
  RefreshCw,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

// Module scope on purpose: the hook keys its internal callback on these functions,
// so inline arrows would give them a new identity on every render and refetch in
// a loop.
const pickAssignedTasks = (d) => (d?.success ? d.tasks || [] : []);
const pickPendingAssignments = (d) => (d?.success ? d.assignments || [] : []);

export default function AssignedTasks() {
  const { t } = useI18n();
  const [responding, setResponding] = useState(null);

  // The identity comes from the shell's session cache rather than from a session
  // request of this screen's own, and both lists follow it, so no effect sets
  // state. The screen keeps its spinner while that identity is still on its way.
  const { cid } = useSessionUser();
  const {
    data: tasks,
    loading: tasksLoading,
    refresh: refreshTasks,
  } = useApi(cid ? `/api/tasks?assigned_to=${cid}&sort=priority` : null, {
    defaultValue: [],
    transform: pickAssignedTasks,
    deps: [cid],
  });
  const {
    data: pendingAssignments,
    loading: pendingLoading,
    refresh: refreshAssignments,
  } = useApi(
    cid ? `/api/tasks/assignments?assignee_id=${cid}&status=pending` : null,
    { defaultValue: [], transform: pickPendingAssignments, deps: [cid] },
  );
  const loading = !cid || tasksLoading || pendingLoading;

  const handleResponse = async (assignmentId, action) => {
    setResponding(assignmentId);
    try {
      const res = await fetch("/api/tasks/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId, action }),
      });
      const data = await res.json();
      if (data.success) {
        refreshTasks();
        refreshAssignments();
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t(data.error || "Failed to respond") || data.error || "Failed to respond" } }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: "Network error" } }));
    } finally {
      setResponding(null);
    }
  };

  const criticalTasks = tasks.filter((t) => t.priority === "critical");
  const highTasks = tasks.filter((t) => t.priority === "high");
  const normalTasks = tasks.filter(
    (t) => t.priority !== "critical" && t.priority !== "high",
  );

  const TaskCard = ({ task }) => (
    <div
      className={`card p-4 ${task.priority === "critical" ? "border-rose-500/30 bg-rose-500/5" : task.priority === "high" ? "border-amber-500/30 bg-amber-500/5" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
              {task.title}
            </h3>
            {task.priority === "critical" && (
              <span className="text-[10px] font-bold uppercase text-rose-400 px-1.5 py-0.5 rounded-full bg-rose-500/10">
                {t("developer.critical")}
              </span>
            )}
            {task.priority === "high" && (
              <span className="text-[10px] font-bold uppercase text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10">
                {t("developer.high")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-secondary)]">
              <User className="w-3 h-3" />{" "}
              {task.user_name || t("developer.unknown")}
            </span>
            {task.end_date && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-secondary)]">
                <Calendar className="w-3 h-3" /> Due:{" "}
                {new Date(task.end_date).toLocaleDateString("en-GB")}
              </span>
            )}
            <span
              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${task.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : task.status === "blocked" ? "bg-rose-500/10 text-rose-400" : "bg-blue-500/10 text-blue-400"}`}
            >
              {task.status === "in_progress" ? "In Progress" : task.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="space-y-8 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("developer.assignedWork")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("developer.assignedTasks")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("developer.assignedSubtitle")}
            </p>
          </div>
          <button
            onClick={() => {
              refreshTasks();
              refreshAssignments();
            }}
            className="btn btn-secondary gap-2 !px-4 !py-2.5"
          >
            <RefreshCw className="w-4 h-4" /> {t("developer.refresh")}
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Assignments — Accept / Decline */}
            {pendingAssignments.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  {t("developer.pendingReview")} ({pendingAssignments.length})
                </h2>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {t("developer.pendingHint")}
                </p>
                <div className="space-y-3">
                  {pendingAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="card p-4 border-amber-500/20 bg-amber-500/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">
                            {a.task_title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-secondary)]">
                            <span className="flex items-center gap-1">
                              <Send className="w-3 h-3" />{" "}
                              {t("developer.assignedBy")}{" "}
                              {a.assigner_name || t("developer.unknown")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{" "}
                              {new Date(a.created_at).toLocaleDateString(
                                "en-GB",
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleResponse(a.id, "decline")}
                            disabled={responding === a.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40"
                          >
                            <XCircle className="w-3.5 h-3.5" />{" "}
                            {t("developer.decline")}
                          </button>
                          <button
                            onClick={() => handleResponse(a.id, "accept")}
                            disabled={responding === a.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                            {t("developer.accept")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Critical Priority Tasks */}
            {criticalTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  {t("developer.critical")} ({criticalTasks.length})
                </h2>
                <div className="space-y-2">
                  {criticalTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* High Priority Tasks */}
            {highTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {t("developer.highPriority")} ({highTasks.length})
                </h2>
                <div className="space-y-2">
                  {highTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {/* Normal Priority Tasks */}
            {normalTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
                  {t("developer.tasks")} ({normalTasks.length})
                </h2>
                <div className="space-y-2">
                  {normalTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            )}

            {criticalTasks.length === 0 &&
              highTasks.length === 0 &&
              normalTasks.length === 0 &&
              pendingAssignments.length === 0 && (
                <div className="text-center py-20">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">
                    {t("developer.noAssignedTasks")}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {t("developer.noAssignedTasksHint")}
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </>
  );
}
