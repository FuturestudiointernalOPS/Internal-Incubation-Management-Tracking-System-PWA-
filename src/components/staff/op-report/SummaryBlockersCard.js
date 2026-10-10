import { Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "./constants";

export default function SummaryBlockersCard({
  now,
  summaryBlockers = [],
  summaryTasks = [],
}) {
  const { t } = useI18n();

  const resolvedBlockers = summaryBlockers.filter(
    (blocker) => blocker.status === "resolved",
  );

  const blockedTasksWithoutBlockerRecord = summaryTasks
    .filter(
      (task) =>
        task.status === "blocked" &&
        !summaryBlockers.some(
          (blocker) => blocker.task_id === task.id && blocker.status === "active",
        ),
    )
    .map((task) => ({
      id: `task-status-${task.id}`,
      task_id: task.id,
      title: task.title,
      status: "active",
      created_at: task.created_at || new Date().toISOString(),
      isTaskStatus: true,
    }));

  const activeBlockers = [
    ...summaryBlockers.filter((blocker) => blocker.status === "active"),
    ...blockedTasksWithoutBlockerRecord,
  ];

  const hasAnyBlockers = resolvedBlockers.length > 0 || activeBlockers.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight flex items-center gap-2">
        <Shield className="w-4 h-4 text-rose-400" />
        {t("staff.section.blockersSummary")}
      </h3>
      {!hasAnyBlockers ? (
        <p className="text-sm text-[var(--text-secondary)] text-center py-8">
          {t("reports.noBlockersFound")}
        </p>
      ) : (
        <>
          {/* Resolved Blockers */}
          {resolvedBlockers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                {t("staff.opReport.resolvedBlockers")}
              </p>
              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-tertiary">
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("staff.table.blocker")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("staff.table.task")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("time.created")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("staff.table.resolved")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedBlockers.map((blocker) => (
                      <tr
                        key={blocker.id}
                        className="border-b border-divider/40"
                      >
                        <td className="px-3 py-2 text-[10px] font-bold text-emerald-400">
                          {blocker.title}
                        </td>
                        <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                          {summaryTasks.find(
                            (task) => task.id === blocker.task_id,
                          )?.title ||
                            t("staff.table.taskLabel") +
                              " #" +
                              blocker.task_id}
                        </td>
                        <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                          {formatDate(blocker.created_at)}
                        </td>
                        <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                          {formatDate(blocker.resolved_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Active Blockers */}
          {activeBlockers.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                {t("staff.opReport.activeBlockers")}
              </p>
              <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-tertiary">
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("staff.table.blocker")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("staff.table.task")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("time.created")}
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("staff.table.weeksOpen")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBlockers.map((blocker) => {
                      const weeksOpen = Math.floor(
                        (now - new Date(blocker.created_at).getTime()) /
                          (7 * 24 * 60 * 60 * 1000),
                      );
                      const taskTitle =
                        summaryTasks.find(
                          (task) => task.id === blocker.task_id,
                        )?.title ||
                        (blocker.isTaskStatus
                          ? blocker.title
                          : t("staff.table.taskLabel") +
                            " #" +
                            blocker.task_id);
                      const blockerTitle = blocker.isTaskStatus
                        ? t("status.blocked")
                        : blocker.title;
                      return (
                        <tr
                          key={blocker.id}
                          className={`border-b border-divider/40 ${weeksOpen > 2 ? "bg-rose-500/5" : ""}`}
                        >
                          <td className="px-3 py-2 text-[10px] font-bold text-rose-400">
                            {blockerTitle}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                            {taskTitle}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">
                            {formatDate(blocker.created_at)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`text-[10px] font-bold ${weeksOpen >= 3 ? "text-rose-400" : weeksOpen >= 2 ? "text-amber-400" : "text-[var(--text-secondary)]"}`}
                            >
                              {weeksOpen}w
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
