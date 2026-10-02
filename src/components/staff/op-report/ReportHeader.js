import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ReportHeader({ onNavigateWeek, reportType, weekInfo }) {
  const { t } = useI18n();

  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
            {t("reports.companyReports")}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
          {t("reports.weeklyReport")}
        </h1>
        <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
          {t("staff.opReport.subtitle")}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigateWeek(-1)}
          className="btn btn-secondary !p-3 rounded-xl"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center px-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("time.week")} {weekInfo.week} — {weekInfo.year}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 mt-0.5">
            {reportType === "standup"
              ? t("reports.mondayStandup")
              : t("reports.fridayRetro")}
          </p>
        </div>
        <button
          onClick={() => onNavigateWeek(1)}
          className="btn btn-secondary !p-3 rounded-xl"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
