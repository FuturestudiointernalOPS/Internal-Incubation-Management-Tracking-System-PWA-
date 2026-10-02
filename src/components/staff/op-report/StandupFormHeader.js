import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function StandupFormHeader({
  history,
  onOpenNewStandup,
  weekInfo,
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          {t("reports.mondayStandup")}
        </h2>
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
          {t("staff.opReport.manageWeeklyPlans")}
        </p>
      </div>
      <button
        onClick={onOpenNewStandup}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold bg-[var(--brand-orange)] text-black hover:brightness-110 transition-all"
      >
        <>
          <Plus className="w-4 h-4" />{" "}
          {history.some(
            (entry) =>
              entry.report_type === "standup" &&
              entry.week_number === weekInfo.week &&
              entry.year === weekInfo.year,
          )
            ? t("staff.opReport.editStandup")
            : t("staff.opReport.createNewStandup")}
        </>
      </button>
    </div>
  );
}
