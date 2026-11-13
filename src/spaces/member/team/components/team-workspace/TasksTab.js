"use client";

import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import EmptyState from "./EmptyState";
import { useI18n } from "@/lib/i18n";
import { PRIORITY_COLORS } from "./constants";
import { Activity, AlertCircle, CheckCircle2, ChevronRight, ListTodo, Loader2, Plus, Trash2 } from "lucide-react";

/**
 * The team workspace tab: the task columns with their progress bar, and the
 * per-task buttons that advance or delete a task.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function TasksTab({
  tasks,
  tasksLoading,
  onCreate,
  onUpdateStatus,
  onDelete,
}) {
  const { t } = useI18n();
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
          {t("rootMisc.team.teamTasks")}
        </h3>
        <AppButton variant="primary" size="sm" icon={Plus} onClick={onCreate}>
          {t("rootMisc.team.addTask")}
        </AppButton>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <AppCard padding="md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
              {t("rootMisc.team.progress")} ({doneCount}/{tasks.length})
            </span>
            <span className="text-[10px] font-black text-[var(--brand-orange)]">
              {progress}%
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: "var(--brand-orange)",
              }}
            />
          </div>
        </AppCard>
      )}

      {/* Task columns */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="w-6 h-6 text-[var(--text-tertiary)]" />}
          title={t("rootMisc.team.noTasksYet")}
          description={t("rootMisc.team.noTasksDesc")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              status: "todo",
              label: t("rootMisc.team.taskToDo"),
              icon: AlertCircle,
              accent: "amber",
            },
            {
              status: "in_progress",
              label: t("rootMisc.team.taskInProgress"),
              icon: Activity,
              accent: "indigo",
            },
            {
              status: "done",
              label: t("rootMisc.team.taskDone"),
              icon: CheckCircle2,
              accent: "emerald",
            },
          ].map((col) => {
            const colTasks = tasks.filter((task) => task.status === col.status);
            return (
              <div key={col.status}>
                <div className="flex items-center gap-2 mb-3">
                  <col.icon className={`w-4 h-4 text-${col.accent}-500`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {col.label}
                  </span>
                  <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => {
                    const priorityStyle =
                      PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
                    return (
                      <AppCard key={task.id} padding="md" hover>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-[var(--text-primary)] flex-1">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-1">
                              {/* Status cycle button */}
                              {task.status !== "done" && (
                                <button
                                  onClick={() =>
                                    onUpdateStatus(
                                      task.id,
                                      task.status === "todo"
                                        ? "in_progress"
                                        : "done",
                                    )
                                  }
                                  className="p-1 rounded hover:bg-[var(--surface-3)] transition-colors text-[var(--text-tertiary)] hover:text-emerald-500"
                                  title={
                                    task.status === "todo"
                                      ? t("rootMisc.team.moveToInProgress")
                                      : t("rootMisc.team.markDone")
                                  }
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => onDelete(task.id)}
                                className="p-1 rounded hover:bg-rose-500/10 transition-colors text-[var(--text-tertiary)] hover:text-rose-500"
                                title={t("rootMisc.team.deleteTaskTitle")}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-[10px] text-[var(--text-tertiary)] line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}
                            >
                              {task.priority}
                            </span>
                            {task.assigned_name && (
                              <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                                {task.assigned_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </AppCard>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="p-4 rounded-xl border border-dashed border-[var(--border-primary)] text-center">
                      <p className="text-[10px] text-[var(--text-tertiary)] font-bold">
                        {t("rootMisc.team.noTasks")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}