import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SummaryCollaborationCard({
  summaryCollapsed,
  summaryProjects,
  summaryTasks,
  toggleSummaryCollapsed,
  user,
}) {
  const { t } = useI18n();

  const collabMap = {};
  summaryTasks.forEach((task) => {
    if (task.user_name && task.user_name !== user?.name) {
      if (!collabMap[task.user_name]) collabMap[task.user_name] = [];
      collabMap[task.user_name].push(task);
    }
  });
  const entries = Object.entries(collabMap);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <Users className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("staff.section.collaborationOverview")}
      </h3>
      {entries.map(([name, sharedTasks]) => (
        <div key={name} className="card p-3">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSummaryCollapsed(name)}
          >
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {name}
              </span>
            </div>
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">
              {t("staff.opReport.sharedTasks", {
                count: sharedTasks.length,
              })}
            </span>
          </div>
          {summaryCollapsed[name] && (
            <div className="mt-2 pt-2 border-t border-divider/30 space-y-1">
              {sharedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex justify-between text-[10px] py-0.5"
                >
                  <span className="font-medium text-[var(--text-primary)]">
                    {task.title}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {summaryProjects.find(
                      (project) =>
                        String(project.id) === String(task.project_id),
                    )?.name ||
                      task.category ||
                      "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
