import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function StandupFormHeader({
  history,
  onOpenNewStandup,
  weekInfo,
}) {
  const { t } = useI18n();
  const exists = history.some(
    (entry) =>
      entry.report_type === "standup" &&
      entry.week_number === weekInfo.week &&
      entry.year === weekInfo.year,
  );

  return (
    <div className="stf-head" style={{ alignItems: "center" }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t("reports.mondayStandup")}</h2>
        <p className="stf-sub" style={{ margin: "2px 0 0" }}>{t("staff.opReport.manageWeeklyPlans")}</p>
      </div>
      <button type="button" onClick={onOpenNewStandup} className="stf-btn pr">
        <Plus size={15} /> {exists ? t("staff.opReport.editStandup") : t("staff.opReport.createNewStandup")}
      </button>
    </div>
  );
}
