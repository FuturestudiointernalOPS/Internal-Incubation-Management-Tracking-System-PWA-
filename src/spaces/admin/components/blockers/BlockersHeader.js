import { ArrowLeft, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function BlockersHeader({ stats, onBack }) {
  const { t } = useI18n();
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
        >
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
          {t("adminMisc.blockers.backToDashboard")}
        </button>
        <div className="flex items-center gap-2 mt-2">
          <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("navigation.internalReports")}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("reports.blockers")}
        </h1>
      </div>

      <div className="flex gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span className="text-[10px] font-bold uppercase text-rose-500">
              {stats.active} {t("reports.active")}
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase text-emerald-500">
              {stats.resolved} {t("reports.resolved")}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
