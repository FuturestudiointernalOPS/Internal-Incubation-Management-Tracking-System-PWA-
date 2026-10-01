"use client";

import { ListTodo } from "lucide-react";
import { formatLocaleDate } from "@/lib/constants";
import { STATUS_CONFIG, cn } from "./constants";

/**
 * MY TASKS — the compact list: a status dot, the title, the due date (red once
 * it has passed) and the status chip.
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function MyTasksCard({
  t,
  lang,
  tasks,
  fetching,
  onOpenReport,
  onViewAll,
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-blue-400" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("dashboard.myTasks", "Mes Tâches")}
          </span>
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            ({tasks?.length || 0})
          </span>
        </div>
        <button
          onClick={onViewAll}
          className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline"
        >
          {t("dashboard.openReport", "Ouvrir le rapport")}
        </button>
      </div>
      {fetching ? (
        <div className="flex items-center justify-center py-8">
          <div
            className="w-5 h-5 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
            style={{
              borderColor: "rgba(255,102,0,0.1)",
              borderTopColor: "var(--brand-orange)",
            }}
          />
        </div>
      ) : tasks?.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] py-6 text-center">
          {t("dashboard.noActiveTasks", "Aucune tâche active")}
        </p>
      ) : (
        <div className="space-y-1.5">
          {tasks?.slice(0, 6).map((task) => (
            <div
              key={task.id}
              onClick={onOpenReport}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-tertiary transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)]"
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  STATUS_CONFIG[task.status]?.dot || "bg-slate-400",
                )}
              />
              <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 truncate">
                {task.title}
              </span>
              {task.end_date && (
                <span
                  className={cn(
                    "text-[10px] font-bold shrink-0",
                    new Date(task.end_date) < new Date() &&
                      task.status !== "completed"
                      ? "text-rose-500"
                      : "text-[var(--text-secondary)]",
                  )}
                >
                  {formatLocaleDate(
                    task.end_date,
                    { month: "short", day: "numeric" },
                    lang,
                  )}
                </span>
              )}
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0",
                  STATUS_CONFIG[task.status]?.bg || "bg-secondary",
                  STATUS_CONFIG[task.status]?.color ||
                    "text-[var(--text-secondary)]",
                )}
              >
                {STATUS_CONFIG[task.status]?.label || task.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
