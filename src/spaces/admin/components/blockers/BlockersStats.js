import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function BlockersStats({ stats }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="card flex items-center gap-4 p-5 border-l-4 border-rose-500">
        <AlertTriangle className="w-6 h-6 text-rose-500" />
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("reports.active")}
          </p>
          <p className="text-2xl font-black tracking-tight text-rose-500">
            {stats.active}
          </p>
        </div>
      </div>
      <div className="card flex items-center gap-4 p-5 border-l-4 border-emerald-500">
        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("reports.resolved")}
          </p>
          <p className="text-2xl font-black tracking-tight text-emerald-500">
            {stats.resolved}
          </p>
        </div>
      </div>
      <div className="card flex items-center gap-4 p-5 border-l-4 border-[var(--brand-orange)]">
        <Shield className="w-6 h-6 text-[var(--brand-orange)]" />
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("reports.blockers")}
          </p>
          <p className="text-2xl font-black tracking-tight">{stats.total}</p>
        </div>
      </div>
    </div>
  );
}
