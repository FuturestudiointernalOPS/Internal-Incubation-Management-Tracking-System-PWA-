import { Clock, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "./constants";

export default function SummaryCarryoverCard({
  onSetTaskReason,
  summaryProjects,
  summaryTasks,
  taskReasons,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <Clock className="w-4 h-4 text-indigo-400" />
        {t("staff.section.carryOverItems")}
      </h3>
      {(() => {
        const carryOverTasks = summaryTasks.filter((task) =>
          ["pending", "in_progress", "blocked"].includes(task.status),
        );
        if (carryOverTasks.length === 0)
          return (
            <p className="text-sm text-emerald-400 text-center py-8">
              {t("staff.opReport.allCompleted")}
            </p>
          );
        return (
          <div className="space-y-2">
            {carryOverTasks.map((task) => {
              const weeks = task.reschedule_count || 0;
              return (
                <div
                  key={task.id}
                  className={`card p-3 ${weeks >= 5 ? "border-rose-500/30 bg-rose-500/5" : weeks >= 3 ? "border-amber-500/30 bg-amber-500/5" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {task.title}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                        {t("staff.opReport.project")}:{" "}
                        {summaryProjects.find(
                          (project) =>
                            String(project.id) === String(task.project_id),
                        )?.name || "—"}{" "}
                        | {t("staff.table.due")}: {formatDate(task.end_date)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p
                        className={`text-lg font-black ${weeks >= 5 ? "text-rose-400" : weeks >= 3 ? "text-amber-400" : "text-[var(--text-primary)]"}`}
                      >
                        {weeks}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("staff.table.weeksOpen")}
                      </p>
                    </div>
                  </div>
                  {/* Reason not completed */}
                  <div className="mt-2">
                    <input
                      type="text"
                      value={taskReasons[task.id] || ""}
                      onChange={(event) =>
                        onSetTaskReason(task.id, event.target.value)
                      }
                      placeholder="Why wasn't this completed? e.g. Waiting for feedback, dependency blocked..."
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand-orange)] transition-all"
                    />
                  </div>
                  {weeks >= 3 && (
                    <div
                      className={`mt-2 text-[10px] font-bold uppercase tracking-wide ${weeks >= 5 ? "text-rose-400" : "text-amber-400"}`}
                    >
                      {weeks >= 5
                        ? t("staff.opReport.criticalAttention")
                        : t("staff.opReport.requiresAttention")}
                    </div>
                  )}
                  {(task.blockers || []).filter(
                    (blocker) => blocker.status === "active",
                  ).length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-rose-400 text-[10px]">
                      <Shield className="w-3 h-3" />
                      {
                        (task.blockers || []).filter(
                          (blocker) => blocker.status === "active",
                        ).length
                      }{" "}
                      {t("staff.opReport.activeBlockersCount")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
