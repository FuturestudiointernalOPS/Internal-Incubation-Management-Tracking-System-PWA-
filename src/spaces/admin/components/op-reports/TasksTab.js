import { CheckCircle2, ListTodo, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function TasksTab({ allTasks, tasksLoading, onViewAllTasks }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      {/* Tasks Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: t("reports.totalReports"),
            value: allTasks.length,
            color: "text-[var(--text-primary)]",
            bg: "bg-white/5",
          },
          {
            label: t("reports.inProgress"),
            value: allTasks.filter((task) => task.status === "in_progress")
              .length,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: t("status.blocked"),
            value: allTasks.filter((task) => task.status === "blocked")
              .length,
            color: "text-rose-500",
            bg: "bg-rose-500/10",
          },
          {
            label: t("reports.completed"),
            value: allTasks.filter((task) => task.status === "completed")
              .length,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: t("reports.carriedOver"),
            value: allTasks.filter((task) => task.status === "carried_over")
              .length,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card flex items-center gap-3 p-3"
          >
            <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {stat.label}
              </p>
              <p className={`text-base font-black ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Tasks Table */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
          {t("reports.recentReports")}
        </h3>
        <button
          onClick={onViewAllTasks}
          className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide hover:underline flex items-center gap-1"
        >
          <ListTodo className="w-3 h-3" /> {t("reports.viewAllTasks")}
        </button>
      </div>

      {tasksLoading ? (
        <TableSkeleton rows={5} />
      ) : allTasks.length === 0 ? (
        <div className="card py-20 text-center opacity-40 border-dashed">
          <ListTodo className="w-12 h-12 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("reports.noTasksFound")}
          </p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-primary)]">
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("reports.table.task")}
                  </th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("reports.table.owner")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("time.week")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("reports.table.status")}
                  </th>
                  <th className="text-center p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("reports.table.blockers")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allTasks.slice(0, 10).map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-divider/50 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                        {task.title}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                          {task.user_name?.charAt(0) || "?"}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight">
                          {task.user_name || task.user_id || t("common.unknown")}
                        </span>
                      </div>
                    </td>
                    <td className="text-center p-4">
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                        W{task.created_week}·{task.created_year}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                          {
                            pending: "bg-slate-500/10 text-[var(--text-secondary)]",
                            in_progress: "bg-blue-500/10 text-blue-500",
                            blocked: "bg-rose-500/10 text-rose-500",
                            completed:
                              "bg-emerald-500/10 text-emerald-500",
                            carried_over:
                              "bg-amber-500/10 text-amber-500",
                          }[task.status] ||
                          "bg-slate-500/10 text-[var(--text-secondary)]"
                        }`}
                      >
                        {{
                          pending: t("status.pending"),
                          in_progress: t("reports.inProgress"),
                          blocked: t("status.blocked"),
                          completed: t("status.completed"),
                          carried_over: t("reports.carriedOver"),
                        }[task.status] || task.status}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      {task.blockers && task.blockers.length > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          <Shield className="w-3 h-3 text-rose-500" />
                          <span className="text-[10px] font-bold text-rose-500">
                            {task.blockers.length}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-[var(--text-secondary)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
