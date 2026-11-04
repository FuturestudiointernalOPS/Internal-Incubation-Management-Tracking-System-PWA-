import { ListTodo } from "lucide-react";
import React from "react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG, formatDate, statusLabelKey } from "./constants";

export default function SummaryTasksTable({ summaryProjects, summaryTasks }) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("staff.section.tasksWorkedOn")}
      </h3>
      {summaryTasks.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] text-center py-8">
          {t("reports.noTasksFound")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
          <table className="w-full">
            <thead>
              <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("staff.table.task")}
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("staff.table.project")}
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("staff.table.category")}
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("time.created")}
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("staff.table.due")}
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("staff.table.status")}
                </th>
                <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("staff.table.collaborators")}
                </th>
              </tr>
            </thead>
            <tbody>
              {summaryTasks.map((task) => {
                const statusConfig =
                  STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                const projectName = summaryProjects.find(
                  (project) => String(project.id) === String(task.project_id),
                )?.name;
                return (
                  <React.Fragment key={task.id}>
                    <tr className="border-b border-divider/40 hover:bg-tertiary/30 transition-colors">
                      <td className="px-3 py-2.5 text-[11px] font-bold text-[var(--text-primary)]">
                        {task.title}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                        {projectName || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                        {task.category || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                        {formatDate(task.created_at)}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                        {formatDate(task.end_date)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                        >
                          {t(statusLabelKey(task.status))}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-[var(--text-secondary)]">
                        —
                      </td>
                    </tr>
                    {/* Subtasks */}
                    {task.subtasks?.length > 0 && (
                      <tr className="bg-tertiary/30">
                        <td colSpan={7} className="px-6 py-2">
                          <div className="space-y-1">
                            {task.subtasks.map((subtask) => {
                              const subtaskStatusConfig =
                                STATUS_CONFIG[subtask.status] ||
                                STATUS_CONFIG.pending;
                              return (
                                <div
                                  key={subtask.id}
                                  className="flex items-center gap-2 text-[10px]"
                                >
                                  <span className="text-[var(--text-secondary)]">
                                    ↳
                                  </span>
                                  <span className="font-medium text-[var(--text-primary)]">
                                    {subtask.title}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${subtaskStatusConfig.bg} ${subtaskStatusConfig.color}`}
                                  >
                                    {t(statusLabelKey(subtask.status))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
