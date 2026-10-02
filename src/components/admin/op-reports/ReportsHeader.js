import { ArrowLeft, BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import StatCard from "./StatCard";

export default function ReportsHeader({
  totalReports,
  memberCount,
  monthCount,
  onBack,
}) {
  const { t } = useI18n();
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
        >
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
          {t("navigation.dashboard")}
        </button>
        <div className="flex items-center gap-2 mt-2">
          <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("reports.operationalReports")}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("reports.companyReports")}
        </h1>
      </div>

      <div className="flex gap-3">
        <StatCard
          label={t("reports.totalReports")}
          value={totalReports}
        />
        <StatCard label={t("reports.teamMembers")} value={memberCount} />
        <StatCard
          label={t("reports.thisMonth")}
          value={monthCount}
        />
      </div>
    </header>
  );
}
