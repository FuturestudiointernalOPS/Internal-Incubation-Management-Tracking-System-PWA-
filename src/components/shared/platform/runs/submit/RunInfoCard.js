"use client";

import { Info, Clock } from "lucide-react";

export default function RunInfoCard({ t, run }) {
  return (
    <div className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] space-y-2">
      <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{run.name}</h2>
      {run.description && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{run.description}</p>}
      {run.settings?.instructions && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-orange/5 border border-brand-orange/10">
          <Info className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
          <p className="text-[10px] text-[var(--text-primary)] font-bold whitespace-pre-wrap">{run.settings.instructions}</p>
        </div>
      )}
      {(run.opens_at || run.closes_at) && (
        <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]">
          <Clock className="w-3 h-3" />
          {run.opens_at && <span>{t("platformMisc.runSubmitDetail.opensAt", { date: new Date(run.opens_at).toLocaleString() })}</span>}
          {run.closes_at && <span>{t("platformMisc.runSubmitDetail.closesAt", { date: new Date(run.closes_at).toLocaleString() })}</span>}
        </div>
      )}
    </div>
  );
}
