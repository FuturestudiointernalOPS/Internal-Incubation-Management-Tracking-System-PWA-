import { useI18n } from "@/lib/i18n";

export default function ReportTypeToggle({ onSelectType, reportType }) {
  const { t } = useI18n();
  const tabs = [
    ["standup", t("reports.mondayStandup")],
    ["retro", t("reports.fridayRetro")],
    ["summary", t("staff.opReport.weeklySummary")],
  ];

  return (
    <div className="stf-tabs" role="tablist">
      {tabs.map(([value, label]) => (
        <button key={value} type="button" role="tab" aria-selected={reportType === value} className={reportType === value ? "on" : ""} onClick={() => onSelectType(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}
