import { useI18n } from "@/lib/i18n";
export default function OverviewTab({ project, }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="card space-y-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("adminMisc.projectDetail.overallProgress")}
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

      {/* Task breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            label: t("adminMisc.projectDetail.breakdownCompleted"),
            count: project.taskStats?.completed || 0,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: t("adminMisc.projectDetail.breakdownInProgress"),
            count: project.taskStats?.in_progress || 0,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: t("adminMisc.projectDetail.breakdownBlocked"),
            count: project.taskStats?.blocked || 0,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
          },
          {
            label: t("adminMisc.projectDetail.breakdownCarriedOver"),
            count: project.taskStats?.carried_over || 0,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
          {
            label: t("adminMisc.projectDetail.breakdownPending"),
            count: project.taskStats?.pending || 0,
            color: "text-slate-500",
            bg: "bg-slate-500/10",
          },
        ].map((breakdownItem) => (
          <div
            key={breakdownItem.label}
            className={`card p-3 text-center ${breakdownItem.bg}`}
          >
            <p className={`text-lg font-black ${breakdownItem.color}`}>
              {breakdownItem.count}
            </p>
            <p
              className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${breakdownItem.color}`}
            >
              {breakdownItem.label}
            </p>
          </div>
        ))}
      </div>

      {/* Timeline Health */}
      {project.timelineHealth !== undefined && (
        <div className="card space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("adminMisc.projectDetail.timelineCoverage")}
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${project.timelineHealth}%` }}
              />
            </div>
            <span className="text-xs font-bold text-blue-500">
              {t("adminMisc.projectDetail.timelineHealthLabel", {
                percent: project.timelineHealth,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
