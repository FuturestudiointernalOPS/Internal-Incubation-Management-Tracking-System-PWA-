"use client";

import { useI18n } from "@/lib/i18n";

/**
 * The overview tab: the overall progress bar, the per-status task counters and
 * the five most recent tasks.
 * Extracted verbatim from StaffProjectDetail.
 */
export default function OverviewTab({ project, tasks }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("staffMisc.projectDetail.overallProgress")}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${project.completionRate || 0}%` }}
            />
          </div>
          <span className="text-sm font-black text-emerald-500">
            {project.completionRate || 0}%
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            label: t("staffMisc.projectDetail.taskStatusActive"),
            key: "in_progress",
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: t("staffMisc.projectDetail.taskStatusBlocked"),
            key: "blocked",
            color: "text-rose-500",
            bg: "bg-rose-500/10",
          },
          {
            label: t("staffMisc.projectDetail.taskStatusPending"),
            key: "pending",
            color: "text-slate-500",
            bg: "bg-slate-500/10",
          },
          {
            label: t("staffMisc.projectDetail.taskStatusDone"),
            key: "completed",
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: t("staffMisc.projectDetail.taskStatusCarryover"),
            key: "carried_over",
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
        ].map(({ label, key, color, bg }) => {
          const count = tasks.filter((task) => task.status === key).length;
          return (
            <div key={key} className={`card p-4 ${bg}`}>
              <p className={`text-2xl font-black ${color}`}>{count}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                {label}
              </p>
            </div>
          );
        })}
      </div>
      {tasks.length > 0 && (
        <div className="card">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
            {t("staffMisc.projectDetail.latestTasks")}
          </h3>
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <div
                  className={`w-2 h-2 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "blocked" ? "bg-rose-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-slate-500"}`}
                />
                <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 truncate">
                  {task.title}
                </span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {task.assignee_name || task.user_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
