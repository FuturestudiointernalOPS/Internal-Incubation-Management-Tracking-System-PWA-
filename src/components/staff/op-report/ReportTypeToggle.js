import { BarChart3, Calendar, Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ReportTypeToggle({ onSelectType, reportType }) {
  const { t } = useI18n();

  return (
    <div className="flex gap-2 bg-tertiary p-1 rounded-xl border border-[var(--border-primary)] w-fit">
      <button
        onClick={() => onSelectType("standup")}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
          reportType === "standup"
            ? "bg-[var(--brand-orange)] text-black shadow-lg"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        <Calendar className="w-4 h-4" /> {t("reports.mondayStandup")}
      </button>
      <button
        onClick={() => onSelectType("retro")}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
          reportType === "retro"
            ? "bg-[var(--brand-orange)] text-black shadow-lg"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        <Trophy className="w-4 h-4" /> {t("reports.fridayRetro")}
      </button>
      <button
        onClick={() => onSelectType("summary")}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
          reportType === "summary"
            ? "bg-[var(--brand-orange)] text-black shadow-lg"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
      >
        <BarChart3 className="w-4 h-4" /> {t("staff.opReport.weeklySummary")}
      </button>
    </div>
  );
}
