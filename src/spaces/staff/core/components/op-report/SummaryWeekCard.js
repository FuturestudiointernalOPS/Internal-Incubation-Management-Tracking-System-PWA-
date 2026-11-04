import { BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import { getWeekNumber } from "./dates";

export default function SummaryWeekCard({
  lang,
  summaryBlockers,
  summaryTasks,
  weekInfo,
}) {
  const { t } = useI18n();

  const planned = summaryTasks.length;
  const completed = summaryTasks.filter(
    (task) => task.status === "completed",
  ).length;
  const carriedOver = summaryTasks.filter(
    (task) => task.status === "carried_over",
  ).length;
  const blockersCreated = summaryBlockers.length;
  const blockersResolved = summaryBlockers.filter(
    (blocker) => blocker.status === "resolved",
  ).length;
  const activeBlockers = summaryBlockers.filter(
    (blocker) => blocker.status === "active",
  ).length;
  const projectsCount = new Set(
    summaryTasks
      .filter((task) => task.project_id)
      .map((task) => task.project_id),
  ).size;

  // Calculate date range
  const monday = new Date();
  monday.setDate(
    monday.getDate() +
      ((7 - monday.getDay() + 1) % 7 || 7) * -1 +
      7 * (weekInfo.week - getWeekNumber(new Date())),
  );
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const dateRange = `${formatLocaleDate(monday, { month: "short", day: "numeric" }, lang)} - ${formatLocaleDate(friday, { month: "short", day: "numeric" }, lang)}`;

  return (
    <div className="card p-5 space-y-4 border-brand-orange/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-black text-[var(--text-primary)]">
            {t("staff.table.week")} {weekInfo.week}
          </p>
          <p className="text-[10px] text-[var(--text-secondary)]">
            {dateRange}
          </p>
        </div>
        <BarChart3 className="w-6 h-6 text-[var(--brand-orange)] opacity-40" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-2xl font-black text-[var(--text-primary)]">
            {planned}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staff.opReport.tasksPlanned")}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-emerald-400">{completed}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staff.table.completed")}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-indigo-400">{carriedOver}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staff.opReport.carriedOver")}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-rose-400">{activeBlockers}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staff.opReport.activeBlockers")}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 pt-2 border-t border-divider/30">
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("staff.opReport.productivity")}:{" "}
          <span className="font-bold text-emerald-400">
            {planned > 0 ? Math.round((completed / planned) * 100) : 0}%
          </span>
        </span>
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("staff.opReport.blockersCreated")}:{" "}
          <span className="font-bold text-[var(--text-primary)]">
            {blockersCreated}
          </span>
        </span>
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("staff.opReport.blockersResolved")}:{" "}
          <span className="font-bold text-emerald-400">{blockersResolved}</span>
        </span>
        <span className="text-[10px] font-medium text-[var(--text-secondary)]">
          {t("staff.opReport.projectsContributed")}:{" "}
          <span className="font-bold text-[var(--text-primary)]">
            {projectsCount}
          </span>
        </span>
      </div>
    </div>
  );
}
