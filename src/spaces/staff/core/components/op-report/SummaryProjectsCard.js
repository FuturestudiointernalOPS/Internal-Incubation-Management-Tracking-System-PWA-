import { Briefcase, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG, statusLabelKey } from "./constants";

export default function SummaryProjectsCard({
  onToggleProject,
  summaryProjectExpanded,
  summaryProjects,
  summaryTasks,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("staff.section.projectContributions")}
      </h3>
      {(() => {
        const grouped = {};
        summaryTasks.forEach((task) => {
          const key = task.project_id
            ? `project_${task.project_id}`
            : `category_${task.category || "Operations"}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(task);
        });
        const entries = Object.entries(grouped);
        if (entries.length === 0)
          return (
            <p className="text-sm text-[var(--text-secondary)] text-center py-8">
              {t("staff.opReport.noProjectData")}
            </p>
          );
        return entries.map(([key, projectTasks]) => {
          const isProject = key.startsWith("project_");
          const projectId = isProject ? key.replace("project_", "") : null;
          const projectName = isProject
            ? summaryProjects.find(
                (project) => String(project.id) === String(projectId),
              )?.name || t("staff.table.projectFallback")
            : key.replace("category_", "");
          const completedCount = projectTasks.filter(
            (task) => task.status === "completed",
          ).length;
          const carriedCount = projectTasks.filter(
            (task) => task.status === "carried_over",
          ).length;
          const activeBlockersCount = projectTasks.reduce(
            (sum, task) =>
              sum +
              (task.blockers || []).filter(
                (blocker) => blocker.status === "active",
              ).length,
            0,
          );
          const expanded = summaryProjectExpanded[key];
          return (
            <div key={key} className="card p-4 space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => onToggleProject(key)}
              >
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {projectName}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("staff.opReport.tasksWorkedOnCount", {
                      count: projectTasks.length,
                    })}{" "}
                    |{t("staff.table.completed")}: {completedCount} |{" "}
                    {t("staff.opReport.carryOver")}: {carriedCount} |{" "}
                    {t("staff.table.blockers")}: {activeBlockersCount}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </div>
              {expanded && (
                <div className="space-y-1.5 pt-2 border-t border-divider/30">
                  {projectTasks.map((projTask) => {
                    const statusConfig =
                      STATUS_CONFIG[projTask.status] || STATUS_CONFIG.pending;
                    return (
                      <div
                        key={projTask.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-tertiary/50"
                      >
                        <span className="text-[10px] font-medium text-[var(--text-primary)]">
                          {projTask.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                        >
                          {t(statusLabelKey(projTask.status))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        });
      })()}
    </div>
  );
}
