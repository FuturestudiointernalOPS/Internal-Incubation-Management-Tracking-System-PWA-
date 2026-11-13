import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import { getWeekNumber } from "./constants";

export default function BlockersTab({
  blockersList,
  allTasks,
  allProjects,
  blockersPage,
  setBlockersPage,
  blockerFilterWeek,
  setBlockerFilterWeek,
  blockerFilterStatus,
  setBlockerFilterStatus,
  PAGE_SIZE,
}) {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
          {t("reports.blockers")}
        </h3>
        {/* Week selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("time.week")}
          </span>
          <select
            value={blockerFilterWeek}
            onChange={(event) => setBlockerFilterWeek(event.target.value)}
            className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
          >
            <option value="all">{t("reports.filter.allWeeks")}</option>
            {(() => {
              const weeks = new Set();
              blockersList.forEach((blocker) => {
                if (blocker.created_at) {
                  const createdDate = new Date(blocker.created_at);
                  const weekNumber = getWeekNumber(createdDate);
                  weeks.add(
                    `${createdDate.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`,
                  );
                }
              });
              return Array.from(weeks)
                .sort()
                .reverse()
                .map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ));
            })()}
          </select>
          <select
            value={blockerFilterStatus}
            onChange={(event) => setBlockerFilterStatus(event.target.value)}
            className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
          >
            <option value="all">{t("reports.filter.allStatuses")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="resolved">{t("status.resolved")}</option>
          </select>
        </div>
      </div>

      {/* Blocker Lifecycle Table */}
      {(() => {
        // Build task lookup
        const taskMap = {};
        allTasks.forEach((taskItem) => {
          taskMap[taskItem.id] = taskItem;
        });

        // Filter blockers
        let filtered = [...blockersList];
        if (blockerFilterWeek !== "all") {
          const [filterYear, filterWeek] =
            blockerFilterWeek.split("-W");
          filtered = filtered.filter((blocker) => {
            if (!blocker.created_at) return false;
            const createdDate = new Date(blocker.created_at);
            const weekNumber = getWeekNumber(createdDate);
            return (
              String(weekNumber) === filterWeek &&
              String(createdDate.getFullYear()) === filterYear
            );
          });
        }
        if (blockerFilterStatus !== "all") {
          filtered = filtered.filter(
            (blocker) => blocker.status === blockerFilterStatus,
          );
        }

        const computeDuration = (blocker) => {
          const start = new Date(blocker.created_at).getTime();
          const end =
            blocker.status === "resolved" && blocker.resolved_at
              ? new Date(blocker.resolved_at).getTime()
              : Date.now();
          const elapsedMs = end - start;
          const days = Math.floor(elapsedMs / 86400000);
          const hours = Math.floor((elapsedMs % 86400000) / 3600000);
          if (days > 0) return `${days}d ${hours}h`;
          return `${hours}h`;
        };

        const formatDateTime = (date) => {
          if (!date) return "—";
          try {
            return formatLocaleDate(date, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }, lang);
          } catch {
            return date;
          }
        };

        if (filtered.length === 0) {
          return (
            <div className="card py-20 text-center opacity-40 border-dashed">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">
                {t("reports.noBlockersFound")}
              </p>
            </div>
          );
        }

        // Group by user for effort analysis
        const byUser = {};
        filtered.forEach((blocker) => {
          const key = blocker.user_id || "unknown";
          if (!byUser[key])
            byUser[key] = {
              name: blocker.user_name || key,
              blockers: [],
              totalDuration: 0,
              resolvedCount: 0,
            };
          byUser[key].blockers.push(blocker);
          if (blocker.status === "resolved" && blocker.resolved_at) {
            const durationMs =
              new Date(blocker.resolved_at) -
              new Date(blocker.created_at);
            byUser[key].totalDuration += durationMs;
            byUser[key].resolvedCount++;
          }
        });

        const userAvgData = Object.values(byUser)
          .map((user) => ({
            name: user.name,
            avgHours:
              user.resolvedCount > 0
                ? (user.totalDuration / user.resolvedCount / 3600000).toFixed(
                    1,
                  )
                : "—",
            totalBlockers: user.blockers.length,
            activeCount: user.blockers.filter(
              (blocker) => blocker.status === "active",
            ).length,
          }))
          .sort((userA, userB) => {
            if (userA.avgHours === "—") return 1;
            if (userB.avgHours === "—") return -1;
            return parseFloat(userB.avgHours) - parseFloat(userA.avgHours);
          });

        return (
          <>
            {/* Effort Analysis Summary */}
            {userAvgData.length > 1 && (
              <div className="card p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                  {t("reports.effortAnalysis")}
                </p>
                <div className="space-y-2">
                  {userAvgData.map((userAvg) => (
                    <div
                      key={userAvg.name}
                      className="flex items-center gap-3 text-[10px]"
                    >
                      <span className="w-32 font-bold truncate">
                        {userAvg.name}
                      </span>
                      <div className="flex-1 h-4 rounded bg-tertiary overflow-hidden">
                        <div
                          className={`h-full rounded ${parseFloat(userAvg.avgHours) > 48 ? "bg-rose-500" : parseFloat(userAvg.avgHours) > 24 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{
                            width: `${Math.min(((parseFloat(userAvg.avgHours) || 0) / 120) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-24 text-right font-bold">
                        {userAvg.avgHours === "—"
                          ? t("common.noData")
                          : t("reports.hoursAvg", {
                              hours: userAvg.avgHours,
                            })}
                      </span>
                      <span className="w-16 text-right text-[var(--text-secondary)]">
                        {userAvg.activeCount > 0
                          ? t("reports.nActive", {
                              count: userAvg.activeCount,
                            })
                          : t("reports.nTotal", {
                              count: userAvg.totalBlockers,
                            })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main blocker table */}
            <div className="card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-tertiary border-b border-[var(--border-primary)]">
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("reports.table.blocker")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("reports.table.staff")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("reports.table.task")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("reports.table.project")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("time.created")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("reports.table.resolved")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("reports.table.duration")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("reports.table.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered
                      .slice(0, blockersPage * PAGE_SIZE)
                      .map((blocker) => {
                        const task = taskMap[blocker.task_id];
                        const projectName = task?.project_id
                          ? allProjects.find(
                              (project) =>
                                String(project.id) ===
                                String(task.project_id),
                            )?.name || null
                          : null;
                        const duration = computeDuration(blocker);
                        return (
                          <tr
                            key={blocker.id}
                            className={`border-b border-divider/40 ${blocker.status === "active" ? "bg-rose-500/[0.02]" : ""}`}
                          >
                            <td className="px-3 py-2.5 text-xs font-bold text-[var(--text-primary)]">
                              {blocker.title}
                            </td>
                            <td className="px-3 py-2.5 text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                                  {blocker.user_name?.charAt(0) || "?"}
                                </div>
                                <span>
                                  {blocker.user_name ||
                                    blocker.user_id ||
                                    "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              {task?.title || `#${blocker.task_id}`}
                            </td>
                            <td className="px-3 py-2.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              {projectName || task?.category || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              {formatDateTime(blocker.created_at)}
                            </td>
                            <td className="px-3 py-2.5 text-[10px] font-medium text-[var(--text-secondary)]">
                              {blocker.status === "resolved"
                                ? formatDateTime(blocker.resolved_at)
                                : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`text-[10px] font-bold ${blocker.status === "active" ? "text-rose-400" : "text-emerald-400"}`}
                              >
                                {duration}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${blocker.status === "active" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}
                              >
                                {blocker.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Load More for blockers */}
            {filtered.length > blockersPage * PAGE_SIZE && (
              <div className="flex justify-center px-4 pb-4">
                <button
                  onClick={() => setBlockersPage((page) => page + 1)}
                  className="px-6 py-2.5 bg-tertiary border border-[var(--border-primary)] rounded-lg text-[10px] font-bold uppercase tracking-wide hover:border-brand-orange/30 transition-all"
                >
                  {t("reports.loadMore", {
                    count: filtered.length - blockersPage * PAGE_SIZE,
                  })}
                </button>
              </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3">
                <p className="text-2xl font-black tracking-tight text-rose-400">
                  {filtered.filter((blocker) => blocker.status === "active")
                    .length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("status.active")}
                </p>
              </div>
              <div className="card p-3">
                <p className="text-2xl font-black tracking-tight text-emerald-400">
                  {filtered.filter((blocker) => blocker.status === "resolved")
                    .length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("status.resolved")}
                </p>
              </div>
              <div className="card p-3">
                <p className="text-2xl font-black tracking-tight">{filtered.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("common.total")}
                </p>
              </div>
              <div className="card p-3">
                <p className="text-2xl font-black tracking-tight">
                  {(() => {
                    const resolved = filtered.filter(
                      (blocker) =>
                        blocker.status === "resolved" &&
                        blocker.resolved_at,
                    );
                    if (resolved.length === 0) return "—";
                    const averageMs =
                      resolved.reduce(
                        (total, blocker) =>
                          total +
                          (new Date(blocker.resolved_at) -
                            new Date(blocker.created_at)),
                        0,
                      ) / resolved.length;
                    const hours = Math.floor(averageMs / 3600000);
                    return `${hours}h`;
                  })()}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("reports.avgResolution")}
                </p>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
