"use client";

import React from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  Shield,
  ListTodo,
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/Skeleton";
import {
  formatStatusLabel,
  getStatusBg,
  getStatusColor,
  getCarryOverCount,
} from "@/components/tasks/admin-tasks/constants";

/**
 * The tasks that survived the filters — or why there are none.
 *
 * A row opens its task and moves it between statuses from the last column; the
 * status buttons a task should not show (setting it to what it already is) are
 * simply not rendered, which is why the button list is conditional rather than
 * disabled.
 */
export default function TasksTable({
  loading,
  tasks,
  projectMap,
  statusUpdating,
  onStatusUpdate,
  onOpenTask,
  t,
}) {
  if (loading) return <TableSkeleton rows={8} />;

  if (tasks.length === 0) {
    return (
      <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
        <ListTodo className="w-16 h-16 mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">
          {t("reports.noTasksFound")}
        </p>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {t("adminMisc.tasks.emptyStateDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.tasks.task")}
              </th>
              <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.tasks.owner")}
              </th>
              <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.tasks.project")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.tasks.status")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("time.created")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("time.updated")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("reports.carryOver")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.tasks.blockers")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("adminMisc.tasks.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="border-b border-divider/50 hover:bg-white/5 transition-colors"
              >
                <td className="p-4">
                  <button
                    onClick={() => onOpenTask(task)}
                    className="text-left group"
                  >
                    <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)] group-hover:text-[var(--brand-orange)] transition-colors">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                      {task.user_name?.charAt(0) || "?"}
                    </div>
                    <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                      {task.user_name || t("adminMisc.tasks.unknown")}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-sm font-bold text-indigo-500">
                    {task.project_id
                      ? projectMap[task.project_id] || "—"
                      : t("adminMisc.tasks.independent")}
                  </span>
                </td>
                <td className="text-center p-4">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getStatusBg(task.status)} ${getStatusColor(task.status)}`}
                  >
                    {formatStatusLabel(task.status, t)}
                  </span>
                </td>
                <td className="text-center p-4">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                    W{task.created_week}·{task.created_year}
                  </span>
                </td>
                <td className="text-center p-4">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {new Date(
                      task.updated_at || task.created_at,
                    ).toLocaleDateString()}
                  </span>
                </td>
                <td className="text-center p-4">
                  <span
                    className={`text-sm font-bold ${task.carried_over_from_task_id ? "text-amber-500" : "text-[var(--text-secondary)]"}`}
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
                    <span className="text-sm font-bold text-[var(--text-secondary)]">—</span>
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
                                onStatusUpdate(task.id, "in_progress")
                              }
                              disabled={statusUpdating !== null}
                              className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-500 transition-all disabled:opacity-40 disabled:cursor-wait"
                              title={t("adminMisc.tasks.markInProgress")}
                            >
                              {statusUpdating === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {task.status !== "blocked" && (
                            <button
                              onClick={() =>
                                onStatusUpdate(task.id, "blocked")
                              }
                              disabled={statusUpdating !== null}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-all disabled:opacity-40 disabled:cursor-wait"
                              title={t("adminMisc.tasks.markBlocked")}
                            >
                              {statusUpdating === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              onStatusUpdate(task.id, "completed")
                            }
                            disabled={statusUpdating !== null}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-500 transition-all disabled:opacity-40 disabled:cursor-wait"
                            title={t("adminMisc.tasks.markCompleted")}
                          >
                            {statusUpdating === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    <button
                      onClick={() => onOpenTask(task)}
                      className="p-1.5 rounded-lg hover:bg-slate-500/10 text-slate-500 transition-all"
                      title={t("adminMisc.tasks.viewDetails")}
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
  );
}