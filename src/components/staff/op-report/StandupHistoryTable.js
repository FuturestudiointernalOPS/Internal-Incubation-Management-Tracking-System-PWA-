import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Plus,
  Shield,
  Target,
} from "lucide-react";
import React from "react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG, formatDate, statusLabelKey } from "./constants";
import { getCurrentWeek } from "./dates";

export default function StandupHistoryTable({
  history,
  assignedProjects,
  expandedWeek,
  onOpenHistoricalWeek,
  onOpenStandup,
  onOpenTask,
  onOpenTaskCreation,
  onToggleStandupWeek,
  tasks,
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
                {t("staff.table.status")}
              </th>
              <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("staff.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {history
              .filter((historyEntry) => historyEntry.report_type === "standup")
              .map((report) => {
                const weekTasks = tasks.filter(
                  (task) =>
                    task.created_week === report.week_number &&
                    task.created_year === report.year &&
                    !task.parent_task_id, // subtasks are counted via the parent
                );
                const taskCount = weekTasks.reduce(
                  (sum, task) => sum + 1 + (task.subtasks?.length || 0),
                  0,
                );
                return (
                  <React.Fragment key={report.id}>
                    <tr
                      key={report.id}
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
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                          {taskCount} {t("staff.table.tasks")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                            report.status === "submitted"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {report.status === "submitted"
                            ? t("status.submitted")
                            : t("status.draft")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onToggleStandupWeek(report)}
                          className="text-[11px] font-medium text-[var(--brand-orange)] hover:underline flex items-center gap-1 ml-auto"
                        >
                          {expandedWeek ===
                          `${report.week_number}-${report.year}`
                            ? t("common.collapse")
                            : t("common.view")}
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${
                              expandedWeek ===
                              `${report.week_number}-${report.year}`
                                ? "rotate-180"
                                : ""
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                    {expandedWeek ===
                      `${report.week_number}-${report.year}` && (
                      <tr key={`tasks-${report.id}`}>
                        <td colSpan={4} className="px-0 py-0">
                          <div className="bg-tertiary/50 border-t border-[var(--border-primary)]">
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                  {report.week_number > 0
                                    ? `Week ${report.week_number}, ${report.year}`
                                    : ""}
                                </span>
                                <button
                                  onClick={() => onOpenHistoricalWeek(report)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                                >
                                  <ChevronRight className="w-3 h-3" />{" "}
                                  {(() => {
                                    const currentWeek = getCurrentWeek();
                                    const isPastWeek =
                                      report.week_number !== currentWeek.week ||
                                      report.year !== currentWeek.year;
                                    return isPastWeek
                                      ? t("staff.opReport.view")
                                      : t("staff.opReport.editStandup");
                                  })()}
                                </button>
                              </div>
                              {tasks.filter(
                                (task) =>
                                  task.created_week === report.week_number &&
                                  task.created_year === report.year,
                              ).length === 0 ? (
                                <p className="text-[11px] text-[var(--text-secondary)] text-center py-4">
                                  {t("reports.noTasksFound")}
                                </p>
                              ) : (
                                <div className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
                                  <div className="overflow-x-auto">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="bg-primary border-b border-[var(--border-primary)]">
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
                                        {(() => {
                                          const weekTasks = tasks.filter(
                                            (task) =>
                                              task.created_week ===
                                                report.week_number &&
                                              task.created_year === report.year,
                                          );
                                          const mainTasks = weekTasks.filter(
                                            (task) => !task.parent_task_id,
                                          );
                                          const subTasks = weekTasks.filter(
                                            (task) => task.parent_task_id,
                                          );

                                          const rowsToRender = [];
                                          const renderedSubTaskIds = new Set();

                                          mainTasks.forEach((mainTask) => {
                                            rowsToRender.push({
                                              ...mainTask,
                                              isSubtask: false,
                                            });
                                            const children = subTasks.filter(
                                              (subtask) =>
                                                subtask.parent_task_id ===
                                                mainTask.id,
                                            );
                                            children.forEach((subtask) => {
                                              rowsToRender.push({
                                                ...subtask,
                                                isSubtask: true,
                                              });
                                              renderedSubTaskIds.add(
                                                subtask.id,
                                              );
                                            });
                                          });

                                          // Catch any orphaned subtasks (parent not in this week)
                                          subTasks.forEach((subtask) => {
                                            if (
                                              !renderedSubTaskIds.has(
                                                subtask.id,
                                              )
                                            ) {
                                              rowsToRender.push({
                                                ...subtask,
                                                isSubtask: true,
                                                isOrphan: true,
                                              });
                                            }
                                          });

                                          return rowsToRender.map((task) => {
                                            const statusConfig =
                                              STATUS_CONFIG[task.status] ||
                                              STATUS_CONFIG.pending;
                                            const activeBlockers = (
                                              task.blockers || []
                                            ).filter(
                                              (blocker) =>
                                                blocker.status === "active",
                                            );
                                            return (
                                              <tr
                                                key={task.id}
                                                className={`border-b border-divider/40 hover:bg-primary/50 transition-colors ${
                                                  task.isSubtask &&
                                                  !task.isOrphan
                                                    ? "bg-tertiary/20"
                                                    : ""
                                                }`}
                                              >
                                                <td
                                                  className={`px-3 py-2.5 ${task.isSubtask && !task.isOrphan ? "pl-8" : ""}`}
                                                >
                                                  <div className="flex items-center gap-2">
                                                    {task.isSubtask && (
                                                      <CornerDownRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                    )}
                                                    <div
                                                      className={`w-1.5 h-1.5 rounded-full ${statusConfig.color.replace("text-", "bg-")} shrink-0`}
                                                    />
                                                    <span
                                                      className="text-[12px] font-medium text-[var(--text-primary)] cursor-pointer hover:text-[var(--brand-orange)]"
                                                      onClick={() =>
                                                        onOpenTask(task)
                                                      }
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
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-[11px] text-[var(--text-secondary)]">
                                                  {task.project_id
                                                    ? assignedProjects.find(
                                                        (project) =>
                                                          String(project.id) ===
                                                          String(
                                                            task.project_id,
                                                          ),
                                                      )?.name ||
                                                      t(
                                                        "staff.table.projectFallback",
                                                      )
                                                    : task.category || "—"}
                                                </td>
                                                <td className="px-3 py-2.5 text-[11px] text-[var(--text-secondary)]">
                                                  {formatDate(task.end_date)}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                  {activeBlockers.length > 0 ? (
                                                    <span className="flex items-center gap-1 text-[10px] text-rose-400">
                                                      <Shield className="w-3 h-3" />
                                                      {activeBlockers.length}
                                                    </span>
                                                  ) : (
                                                    <span className="text-[10px] text-[var(--text-secondary)]">
                                                      —
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                  <span
                                                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                                                  >
                                                    {t(
                                                      statusLabelKey(
                                                        task.status,
                                                      ),
                                                    )}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          });
                                        })()}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              {(() => {
                                const currentWeek = getCurrentWeek();
                                const isPastWeek =
                                  report.week_number !== currentWeek.week ||
                                  report.year !== currentWeek.year;
                                if (isPastWeek) return null;
                                return (
                                  <div className="mt-3">
                                    <button
                                      onClick={() => onOpenTaskCreation(report)}
                                      className="w-full py-2 border border-dashed border-[var(--border-primary)] rounded-lg text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:border-brand-orange/30 transition-all flex items-center justify-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" />{" "}
                                      {t("reports.addTask")}
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            {history.filter((entry) => entry.report_type === "standup")
              .length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <Target className="w-8 h-8 mx-auto mb-3 text-slate-500 opacity-30" />
                  <p className="text-[12px] font-medium text-[var(--text-secondary)] mb-1">
                    {t("staff.opReport.noStandupReports")}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mb-4">
                    {tasks.length > 0
                      ? t("staff.opReport.hasTasksPrompt", {
                          count: tasks.length,
                        })
                      : t("staff.opReport.createFirstStandup")}
                  </p>
                  <button
                    onClick={onOpenStandup}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-semibold hover:brightness-110 transition-all"
                  >
                    <>
                      <Plus className="w-4 h-4" />{" "}
                      {t("staff.opReport.createNewStandup")}
                    </>
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
