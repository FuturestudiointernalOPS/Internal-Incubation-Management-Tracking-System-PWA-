import { Briefcase } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SummaryOwnerCard({ summaryProjects, summaryTasks }) {
  const { t } = useI18n();

  const ownedProjects = summaryProjects.filter(
    (project) => project.member_role === "lead",
  );
  if (ownedProjects.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("staff.section.projectsIOwn")}
      </h3>
      {ownedProjects.map((project) => {
        const projectTasks = summaryTasks.filter(
          (task) => String(task.project_id) === String(project.id),
        );
        const completed = projectTasks.filter(
          (task) => task.status === "completed",
        ).length;
        const active = projectTasks.filter(
          (task) => task.status === "in_progress" || task.status === "blocked",
        ).length;
        const carried = projectTasks.filter(
          (task) => task.status === "carried_over",
        ).length;
        const blockerCount = projectTasks.reduce(
          (sum, task) =>
            sum +
            (task.blockers || []).filter(
              (blocker) => blocker.status === "active",
            ).length,
          0,
        );
        const collaborators = new Set(
          projectTasks.map((task) => task.user_name).filter(Boolean),
        );
        const total = projectTasks.length;
        const rate = total > 0 ? completed / total : 0;
        let health = "on_track";
        if (
          (blockerCount > 0 || (total > 0 && carried / total > 0.3)) &&
          rate < 0.7
        )
          health = "at_risk";
        if (blockerCount >= 2 || rate < 0.3) health = "blocked";
        const healthColors = {
          on_track: "text-emerald-400 bg-emerald-500/10",
          at_risk: "text-amber-400 bg-amber-500/10",
          blocked: "text-rose-400 bg-rose-500/10",
        };
        // healthLabels used via t() inline
        return (
          <div key={project.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {project.name}
              </p>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${healthColors[health]}`}
              >
                {health === "on_track"
                  ? t("status.onTrack")
                  : health === "at_risk"
                    ? t("status.atRisk")
                    : t("status.blocked")}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
              <div>
                <span className="font-bold text-emerald-400">{completed}</span>{" "}
                <span className="text-[var(--text-secondary)]">
                  {t("status.completed")}
                </span>
              </div>
              <div>
                <span className="font-bold text-blue-400">{active}</span>{" "}
                <span className="text-[var(--text-secondary)]">
                  {t("status.active")}
                </span>
              </div>
              <div>
                <span className="font-bold text-indigo-400">{carried}</span>{" "}
                <span className="text-[var(--text-secondary)]">
                  {t("status.carriedOver")}
                </span>
              </div>
              <div>
                <span className="font-bold text-rose-400">{blockerCount}</span>{" "}
                <span className="text-[var(--text-secondary)]">
                  {t("staff.table.blockers")}
                </span>
              </div>
            </div>
            {collaborators.size > 0 && (
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-2">
                {t("staff.table.collaborators")}:{" "}
                {Array.from(collaborators).join(", ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
