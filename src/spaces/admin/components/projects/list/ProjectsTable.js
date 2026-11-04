import { Briefcase, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { STATUS_BG, STATUS_COLORS } from "./constants";

export default function ProjectsTable({
  loading,
  filteredProjects,
  onOpen,
  actionLoading,
  onQuickStatus,
  onEdit,
  onArchiveToggle,
}) {
  const { t } = useI18n();
  return (
    <>
      {loading ? (
        <TableSkeleton rows={6} />
      ) : filteredProjects.length === 0 ? (
        <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
          <Briefcase className="w-16 h-16 mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("adminMisc.projectsList.noProjectsFound")}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            {t("adminMisc.projectsList.emptyStateDesc")}
          </p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.project")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.status")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.priority")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.tasks")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.completed")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.blockers")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.progress")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.start")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("adminMisc.projectsList.end")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-divider/50 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => onOpen(project)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                            {project.name}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                            {t("adminMisc.projectsList.project")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${STATUS_BG[project.status] || "bg-slate-500/10"} ${STATUS_COLORS[project.status] || "text-slate-400"}`}
                      >
                        {project.status}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          project.priority === "critical"
                            ? "bg-red-500/10 text-red-400"
                            : project.priority === "high"
                              ? "bg-amber-500/10 text-amber-400"
                              : project.priority === "low"
                                ? "bg-slate-500/10 text-slate-400"
                                : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {project.priority || "medium"}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="text-sm font-black">
                        {project.taskStats?.total || 0}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="text-sm font-black text-emerald-500">
                        {project.completionRate || 0}%
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <div className="flex items-center justify-center gap-1">
                        <Shield
                          className={`w-3 h-3 ${project.blockerStats?.active > 0 ? "text-rose-500" : "text-slate-600"}`}
                        />
                        <span
                          className={`text-sm font-black ${project.blockerStats?.active > 0 ? "text-rose-500" : "text-slate-600"}`}
                        >
                          {project.blockerStats?.active || 0}
                        </span>
                        {project.blockerStats?.total > 0 && (
                          <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                            / {project.blockerStats.total}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{
                              width: `${project.completionRate || 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] w-8 text-right">
                          {project.completionRate || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="text-center p-4">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {project.start_date
                          ? new Date(project.start_date).toLocaleDateString(
                              "en",
                              { month: "short", day: "numeric" },
                            )
                          : "—"}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                        {project.end_date
                          ? new Date(project.end_date).toLocaleDateString(
                              "en",
                              { month: "short", day: "numeric" },
                            )
                          : "—"}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Status quick actions */}
                        {project.status === "Active" && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onQuickStatus(project, "Paused");
                            }}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-wait"
                          >
                            {actionLoading
                              ? "..."
                              : t("adminMisc.projectsList.pause")}
                          </button>
                        )}
                        {project.status === "Paused" && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onQuickStatus(project, "Active");
                            }}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-wait"
                          >
                            {actionLoading
                              ? "..."
                              : t("adminMisc.projectsList.resume")}
                          </button>
                        )}
                        {project.status === "Active" && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onQuickStatus(
                                project,
                                "Completed",
                                "Mark as completed?",
                              );
                            }}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-wait"
                          >
                            {actionLoading
                              ? "..."
                              : t("adminMisc.projectsList.complete")}
                          </button>
                        )}
                        <button
                          onClick={(event) => {
                              event.stopPropagation();
                              onEdit(project);
                            }}
                          className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-brand-orange/10 text-[var(--brand-orange)] hover:bg-[var(--brand-orange)] hover:text-black transition-all"
                        >
                          {t("adminMisc.projectsList.edit")}
                        </button>
                        <button
                          onClick={(event) => {
                              event.stopPropagation();
                              onArchiveToggle(project);
                            }}
                          disabled={actionLoading}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-wait ${
                            project.status === "Archived"
                              ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                              : "bg-slate-500/10 text-slate-500 hover:bg-rose-500 hover:text-white"
                          }`}
                        >
                          {actionLoading
                            ? "..."
                            : project.status === "Archived"
                              ? t("adminMisc.projectsList.restore")
                              : t("adminMisc.projectsList.archive")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
