import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ReportHeader({ onNavigateWeek, reportType, weekInfo }) {
  const { t } = useI18n();
  const typeLabel =
    reportType === "standup"
      ? t("reports.mondayStandup")
      : reportType === "retro"
        ? t("reports.fridayRetro")
        : t("staff.opReport.weeklySummary");

  return (
    <header className="stf-head">
      <div>
        <h1 className="stf-title">{t("reports.weeklyReport")}</h1>
        <p className="stf-sub">{t("staff.opReport.subtitle")}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={() => onNavigateWeek(-1)} className="stf-btn" aria-label={t("staffMisc.front.calendar.previous")}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <p className="stf-k">
            {t("time.week")} {weekInfo.week} — {weekInfo.year}
          </p>
          <p className="stf-k" style={{ opacity: 0.6, marginTop: 2 }}>
            {typeLabel}
          </p>
        </div>
        <button type="button" onClick={() => onNavigateWeek(1)} className="stf-btn" aria-label={t("staffMisc.front.calendar.next")}>
          <ChevronRight size={16} />
        </button>
      </div>
    </header>
  );
}
