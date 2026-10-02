"use client";

import { Target, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn, programStatusLabel } from "./constants";

/**
 * The KPI progress strip: one card per programme with its weighted completion
 * rate, tinted by how far along it is.
 * Extracted verbatim from app/admin/page.js.
 */
export default function KpiProgressSection({ programs, onOpen }) {
  const { t } = useI18n();
  if (programs.length === 0) return null;
  return (
    <div className="space-y-4 pt-6 border-t border-[var(--border-primary)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("adminMisc.dashboard.kpiProgress")}
            </h3>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">
              {t("adminMisc.dashboard.weightedAverageCompletion")}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {programs.map((program) => (
          <div
            key={program.id}
            onClick={() => onOpen(program)}
            className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] hover:border-emerald-500/30 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">{program.name}</span>
              <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                program.avg_kpi_rate >= 70 ? "bg-emerald-500/10 text-emerald-400" :
                program.avg_kpi_rate >= 40 ? "bg-amber-500/10 text-amber-400" :
                "bg-rose-500/10 text-rose-400"
              )}>{program.avg_kpi_rate}%</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)] mb-2">
              <Target className="w-3 h-3" /> {program.kpi_count} KPIs
              <span className={cn("ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold",
                program.status === 'Active' ? "bg-emerald-500/10 text-emerald-400" : "bg-secondary text-[var(--text-secondary)]"
              )}>{programStatusLabel(t, program.status)}</span>
            </div>
            <div className="h-2 w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all",
                program.avg_kpi_rate >= 70 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                program.avg_kpi_rate >= 40 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                "bg-gradient-to-r from-rose-500 to-rose-400"
              )} style={{width: `${Math.max(program.avg_kpi_rate, 5)}%`}} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}