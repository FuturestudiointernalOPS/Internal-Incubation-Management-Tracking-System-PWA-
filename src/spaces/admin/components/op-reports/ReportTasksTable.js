"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";

/**
 * The week's task table shown inside the admin operational-report detail modal.
 *
 * Extracted verbatim from `ReportDetailModal.js` — see docs/LAYER_SPLIT.md. The
 * modal keeps the reads, the export handler and the surrounding layout; this
 * component only renders the table (its status badge and date helpers move with
 * it, since the table is their only caller).
 */
export default function ReportTasksTable({
  weekTasks,
  weekTasksLoading,
  projectMap,
  taskLogs,
  expandedTaskMeta,
}) {
  const { t, lang } = useI18n();

  const renderStatusBadge = (status) => {
    const config = {
      pending: {
        label: t("status.pending"),
        color: "text-slate-400",
        bg: "bg-slate-500/10",
      },
      in_progress: {
        label: t("reports.inProgress"),
        color: "text-blue-400",
        bg: "bg-blue-500/10",
      },
      blocked: {
        label: t("status.blocked"),
        color: "text-rose-400",
        bg: "bg-rose-500/10",
      },
      completed: {
        label: t("status.completed"),
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
      },
      carried_over: {
        label: t("reports.carriedOver"),
        color: "text-indigo-400",
        bg: "bg-indigo-500/10",
      },
    };
    const badge = config[status] || config.pending;
    return (
      <span
        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${badge.bg} ${badge.color}`}
      >
        {badge.label}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return "—";
    try {
      return formatLocaleDate(date, { month: "short", day: "numeric" }, lang);
    } catch {
      return date;
    }
  };

  return weekTasksLoading ? (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      <span className="ml-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        {t("reports.loadingTasks")}
      </span>
    </div>
  ) : weekTasks.length === 0 ? (
    <p className="text-[10px] text-gray-500 text-center py-8">
      {t("reports.noTasksWeek")}
    </p>
  ) : (
    <div className="overflow-x-auto border border-gray-200">
      <table className="w-full">
        <thead>
          <tr className="bg-tertiary border-b border-[var(--border-primary)]">
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.task")}
            </th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.project")}
            </th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.category")}
            </th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.status")}
            </th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.start")}
            </th>
            <th className="text-left px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.end")}
            </th>
            <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.blockers")}
            </th>
            <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.subtasks")}
            </th>
            <th className="text-center px-3 py-2 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("reports.table.carry")}
            </th>
          </tr>
        </thead>
        <tbody>
          {weekTasks.map((task) => {
            const activeBlockers = (task.blockers || []).filter(
              (blocker) => blocker.status === "active",
            ).length;
            return (
              <React.Fragment key={task.id}>
                <tr className="border-b border-gray-200">
                  <td className="px-3 py-2.5 text-[10px] font-bold text-black">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 text-[9px]">
                        ▸
                      </span>
                      {task.title}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[9px] text-gray-500">
                    {projectMap[task.project_id]?.name || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[9px] text-gray-500">
                    {task.category || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {renderStatusBadge(task.status)}
                  </td>
                  <td className="px-3 py-2.5 text-[9px] text-gray-500">
                    {formatDate(task.start_date)}
                  </td>
                  <td className="px-3 py-2.5 text-[9px] text-gray-500">
                    {formatDate(task.end_date)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {activeBlockers > 0 ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-[9px] font-bold text-red-500">
                          ! {activeBlockers}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {task.subtasks?.length > 0 ? (
                      <span className="text-[9px] font-bold text-indigo-500">
                        {task.subtasks.length}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {task.status === "carried_over" && (
                      <span className="text-[8px] font-bold text-indigo-500">
                        ✓
                      </span>
                    )}
                  </td>
                </tr>
                {/* Subtask rows */}
                {task.subtasks?.length > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan={9} className="px-6 py-1.5">
                      <div className="space-y-0.5">
                        {task.subtasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 text-[9px]"
                          >
                            <span className="text-gray-500">↳</span>
                            <span className="font-medium text-black">
                              {sub.title}
                            </span>
                            <span
                              className={`text-[7px] font-bold px-1 py-0.5 rounded ${sub.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                            >
                              {sub.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                {/* Expandable task metadata row */}
                {expandedTaskMeta === task.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={9} className="px-6 py-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[9px]">
                        <div>
                          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                            {t("time.created")}
                          </p>
                          <p className="font-medium text-black">
                            {formatDate(task.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[7px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                            {t("reports.table.owner")}
                          </p>
                          <p className="font-medium text-black">
                            {task.user_name || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                            {t("reports.table.project")}
                          </p>
                          <p className="font-medium text-[var(--text-primary)]">
                            {projectMap[task.project_id]?.name ||
                              task.category ||
                              "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                            {t("reports.table.carryCount")}
                          </p>
                          <p className="font-medium text-black">
                            {t("reports.nTimes", {
                              count: task.reschedule_count || 0,
                            })}
                          </p>
                        </div>
                      </div>
                      {taskLogs[task.id] &&
                        taskLogs[task.id].length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-[7px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              {t("reports.activityLog")}
                            </p>
                            <div className="space-y-0.5 max-h-24 overflow-y-auto">
                              {taskLogs[task.id]
                                .slice(0, 5)
                                .map((log, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-2 text-[8px]"
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        log.action_type ===
                                        "TASK_CREATED"
                                          ? "bg-emerald-500"
                                          : log.action_type ===
                                              "TASK_ASSIGNED"
                                            ? "bg-blue-500"
                                            : log.action_type ===
                                                "TASK_COMPLETED"
                                              ? "bg-emerald-500"
                                              : "bg-slate-500"
                                      }`}
                                    />
                                    <span className="text-slate-500">
                                      {log.action_type?.replace(
                                        /_/g,
                                        " ",
                                      )}
                                    </span>
                                    <span className="text-slate-600">
                                      {log.created_at
                                        ? formatLocaleDate(log.created_at, { month: "short", day: "numeric" }, lang)
                                        : ""}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
