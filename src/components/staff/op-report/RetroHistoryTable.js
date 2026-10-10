import { CheckCircle2, ChevronDown, Shield } from "lucide-react";
import React from "react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG, formatDate, statusLabelKey } from "./constants";

export default function RetroHistoryTable({
  history,
  assignedProjects,
  expandedTasks,
  expandedWeek,
  onAddBlocker,
  onChangeTaskStatus,
  onToggleRetroWeek,
  onToggleSubtask,
  onToggleSubtasks,
  onToggleTask,
  tasks,
  updatingTasks,
}) {
  const { t } = useI18n();

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-primary)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-tertiary border-b border-[var(--border-primary)]">
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("staff.table.week")}
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("staff.table.totalTasks")}
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("staff.table.completed")}
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("staff.table.status")}
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("staff.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {history
              .filter(
                (entry) =>
                  entry.report_type === "standup" ||
                  entry.report_type === "retro",
              )
              .reduce((unique, entry) => {
                if (
                  !unique.find(
                    (existingReport) =>
                      existingReport.week_number === entry.week_number &&
                      existingReport.year === entry.year,
                  )
                )
                  unique.push(entry);
                return unique;
              }, [])
              .map((report) => {
                const weekKey = report.week_number + "-" + report.year;
                const weekTasks = tasks.filter(
                  (task) =>
                    Number(task.created_week) === Number(report.week_number) &&
                    Number(task.created_year) === Number(report.year) &&
                    !task.parent_task_id, // exclude sub-tasks (rendered inside parent)
                );
                const totalTasks = weekTasks.reduce(
                  (sum, task) => sum + 1 + (task.subtasks?.length || 0),
                  0,
                );
                const completed = weekTasks.reduce(
                  (sum, task) =>
                    sum +
                    (task.status === "completed" ? 1 : 0) +
                    (task.subtasks?.filter(
                      (subtask) => subtask.status === "completed",
                    ).length || 0),
                  0,
                );
                const isExpanded = expandedWeek === weekKey;
                return (
                  <React.Fragment key={weekKey}>
                    <tr
                      key={weekKey}
                      className="border-b border-divider/50 hover:bg-tertiary/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {t("staff.table.week")} {report.week_number}
                        </span>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-2">
                          {report.year}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-[var(--text-secondary)]">
                        {totalTasks} {t("staff.table.tasks")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-medium text-emerald-400">
                          {completed}/{totalTasks}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${completed === totalTasks && totalTasks > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}
                        >
                          {completed === totalTasks && totalTasks > 0
                            ? t("staff.opReport.complete")
                            : t("staff.opReport.review")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onToggleRetroWeek(weekKey)}
                          className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto"
                        >
                          {isExpanded ? t("common.collapse") : t("common.view")}
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={"t-" + weekKey}>
                        <td colSpan={5} className="px-0 py-0">
                          <div className="bg-tertiary/50 border-t border-[var(--border-primary)] p-4">
                            {weekTasks.length === 0 ? (
                              <p className="text-[11px] text-[var(--text-secondary)] text-center py-4">
                                {t("reports.noTasksFound")}
                              </p>
                            ) : (
                              <div className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="bg-primary border-b border-[var(--border-primary)]">
                                        <th className="w-10 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                          {t("staff.opReport.done")}
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                          {t("staff.table.task")}
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                          {t("staff.table.project")}
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                          {t("staff.table.due")}
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                          {t("staff.table.blockers")}
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                          {t("staff.table.status")}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {weekTasks
                                        .sort((first, second) => {
                                          if (
                                            first.status === "completed" &&
                                            second.status !== "completed"
                                          )
                                            return 1;
                                          if (
                                            first.status !== "completed" &&
                                            second.status === "completed"
                                          )
                                            return -1;

                                          const firstCarryover =
                                            first.carried_over_from_task_id !==
                                              null ||
                                            first.status === "carried_over";
                                          const secondCarryover =
                                            second.carried_over_from_task_id !==
                                              null ||
                                            second.status === "carried_over";
                                          if (
                                            firstCarryover &&
                                            !secondCarryover
                                          )
                                            return -1;
                                          if (
                                            !firstCarryover &&
                                            secondCarryover
                                          )
                                            return 1;

                                          return (
                                            new Date(
                                              first.created_at,
                                            ).getTime() -
                                            new Date(
                                              second.created_at,
                                            ).getTime()
                                          );
                                        })
                                        .map((task) => {
                                          const activeBlockers = (
                                            task.blockers || []
                                          ).filter(
                                            (blocker) =>
                                              blocker.status === "active",
                                          );
                                          return (
                                            <tr
                                              key={task.id}
                                              className="border-b border-divider/40 hover:bg-primary/50 transition-colors"
                                            >
                                              <td className="px-3 py-2.5 text-center">
                                                <button
                                                  onClick={() =>
                                                    onToggleTask(task)
                                                  }
                                                  disabled={
                                                    updatingTasks[task.id]
                                                  }
                                                  className={`w-4 h-4 rounded-full border-2 mx-auto cursor-pointer transition-all hover:scale-110 ${task.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-emerald-400"} ${updatingTasks[task.id] ? "opacity-50 animate-pulse" : ""}`}
                                                >
                                                  {task.status ===
                                                    "completed" && (
                                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                                  )}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2.5">
                                                <div>
                                                  <button
                                                    onClick={() =>
                                                      onToggleSubtasks(task)
                                                    }
                                                    className={`flex items-center gap-1.5 text-left ${task.subtasks?.length > 0 ? "cursor-pointer hover:text-[var(--brand-orange)]" : ""}`}
                                                  >
                                                    <span
                                                      className={`text-[11px] font-medium ${task.status === "completed" ? "line-through text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
                                                    >
                                                      {task.title}
                                                    </span>
                                                    {task.priority &&
                                                      task.priority !==
                                                        "medium" && (
                                                        <span
                                                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                                            task.priority ===
                                                            "critical"
                                                              ? "bg-red-500/10 text-red-400"
                                                              : task.priority ===
                                                                  "high"
                                                                ? "bg-amber-500/10 text-amber-400"
                                                                : "bg-slate-500/10 text-slate-400"
                                                          }`}
                                                        >
                                                          {task.priority}
                                                        </span>
                                                      )}
                                                    {(task.carried_over_from_task_id !==
                                                      null ||
                                                      task.status ===
                                                        "carried_over") && (
                                                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-2">
                                                        <Shield className="w-2.5 h-2.5" />{" "}
                                                        {t("status.carryover")}
                                                      </span>
                                                    )}
                                                    {task.subtasks?.length >
                                                      0 && (
                                                      <span
                                                        className={`text-[8px] transition-transform ${expandedTasks[task.id] ? "rotate-180" : ""}`}
                                                      >
                                                        ▼
                                                      </span>
                                                    )}
                                                  </button>
                                                  {/* Expanded sub-tasks */}
                                                  {expandedTasks[task.id] &&
                                                    task.subtasks?.length >
                                                      0 && (
                                                      <div className="mt-2 ml-3 pl-3 border-l-2 border-indigo-500/30 space-y-1">
                                                        {task.subtasks.map(
                                                          (subtask) => (
                                                            <div
                                                              key={subtask.id}
                                                              className="flex items-center gap-2 py-0.5"
                                                            >
                                                              <button
                                                                onClick={() =>
                                                                  onToggleSubtask(
                                                                    subtask,
                                                                  )
                                                                }
                                                                className={`w-3 h-3 rounded-full border-2 shrink-0 ${subtask.status === "completed" ? "bg-emerald-500 border-emerald-500" : "border-slate-600"}`}
                                                              >
                                                                {subtask.status ===
                                                                  "completed" && (
                                                                  <CheckCircle2 className="w-2 h-2 text-white" />
                                                                )}
                                                              </button>
                                                              <span
                                                                className={`text-[10px] ${subtask.status === "completed" ? "line-through text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
                                                              >
                                                                {subtask.title}
                                                              </span>
                                                              <span
                                                                className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded-full ${STATUS_CONFIG[subtask.status]?.bg || "bg-slate-500/10"} ${STATUS_CONFIG[subtask.status]?.color || "text-slate-400"}`}
                                                              >
                                                                {t(
                                                                  statusLabelKey(
                                                                    subtask.status,
                                                                  ),
                                                                )}
                                                              </span>
                                                            </div>
                                                          ),
                                                        )}
                                                      </div>
                                                    )}
                                                </div>
                                              </td>
                                              <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                                {task.project_id
                                                  ? assignedProjects.find(
                                                      (project) =>
                                                        String(project.id) ===
                                                        String(task.project_id),
                                                    )?.name ||
                                                    t(
                                                      "staff.table.projectFallback",
                                                    )
                                                  : task.category || "—"}
                                              </td>
                                              <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                                                {formatDate(task.end_date)}
                                              </td>
                                              <td className="px-3 py-2.5">
                                                <button
                                                  onClick={() =>
                                                    onAddBlocker(task)
                                                  }
                                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-all text-[10px] font-bold"
                                                >
                                                  {activeBlockers.length > 0 ? (
                                                    <span className="text-rose-400 font-medium flex items-center gap-1">
                                                      <Shield className="w-3 h-3" />
                                                      {activeBlockers.length}{" "}
                                                      {activeBlockers.length > 1
                                                        ? t("staff.table.blockers")
                                                        : t("staff.table.blocker")}
                                                    </span>
                                                  ) : task.status === "blocked" ? (
                                                    <span className="text-rose-400 font-medium flex items-center gap-1">
                                                      <Shield className="w-3 h-3" />
                                                      1 {t("staff.table.blocker")}
                                                    </span>
                                                  ) : (
                                                    <span className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                                                      <Shield className="w-3 h-3" />
                                                      {t("staff.opReport.addBlockerButton")}
                                                    </span>
                                                  )}
                                                </button>
                                              </td>
                                              <td className="px-3 py-2.5">
                                                <select
                                                  value={
                                                    task.status || "pending"
                                                  }
                                                  onChange={(event) =>
                                                    onChangeTaskStatus(
                                                      task,
                                                      event,
                                                    )
                                                  }
                                                  className={`text-[10px] font-bold px-1 py-0.5 rounded-full border-0 outline-none cursor-pointer appearance-none ${STATUS_CONFIG[task.status]?.bg || "bg-slate-500/10"} ${STATUS_CONFIG[task.status]?.color || "text-slate-400"}`}
                                                >
                                                  <option
                                                    value="pending"
                                                    className="bg-primary text-slate-400"
                                                  >
                                                    {t("status.notStarted")}
                                                  </option>
                                                  <option
                                                    value="in_progress"
                                                    className="bg-primary text-blue-400"
                                                  >
                                                    {t("status.inProgress")}
                                                  </option>
                                                  <option
                                                    value="blocked"
                                                    className="bg-primary text-rose-400"
                                                  >
                                                    {t("status.blocked")}
                                                  </option>
                                                  <option
                                                    value="carried_over"
                                                    className="bg-primary text-amber-400"
                                                  >
                                                    {t("status.carriedOver")}
                                                  </option>
                                                  <option
                                                    value="completed"
                                                    className="bg-primary text-emerald-400"
                                                  >
                                                    {t("status.completed")}
                                                  </option>
                                                </select>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            {history.filter(
              (entry) =>
                entry.report_type === "standup" ||
                entry.report_type === "retro",
            ).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                  <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                    {t("staff.opReport.noWeeklyReports")}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {t("staff.opReport.retroRequiresStandup")}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
