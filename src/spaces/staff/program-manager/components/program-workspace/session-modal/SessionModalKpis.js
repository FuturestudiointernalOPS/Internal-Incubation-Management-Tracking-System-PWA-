"use client";

import { useI18n } from "@/lib/i18n";
import { Target, CheckCircle2 } from "lucide-react";

export default function SessionModalKpis({
  t,
  newSession,
  kpis,
  onToggleKpi,
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
        <Target className="w-3 h-3 text-[#FF6600]" />{" "}
        {t("pmMisc.workspace.linkStrategicKpis")}
      </label>
      <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto p-1 custom-scrollbar text-left">
        {kpis.map((kpi) => (
          <button
            key={kpi.id}
            onClick={() => onToggleKpi("session", kpi.id)}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
              (newSession.kpi_ids || []).includes(kpi.id)
                ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                : "bg-black/20 border-white/5 text-slate-500 hover:border-white/20"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-tight">
              {kpi.title}
            </span>
            {(newSession.kpi_ids || []).includes(kpi.id) && (
              <CheckCircle2 className="w-3 h-3 text-[#FF6600]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}