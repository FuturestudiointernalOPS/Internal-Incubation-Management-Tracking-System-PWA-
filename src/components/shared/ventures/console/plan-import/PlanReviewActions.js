"use client";

import { Loader2, Play, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The review's closing actions: the "next step" line and the Apply / Save
 * buttons. The parent (`PlanReview`) owns the writes and passes them down;
 * this component only renders.
 */
export default function PlanReviewActions({ applying, saving, onApply, onSave }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[10px] text-slate-500">{t("venture.planImport.nextStep")}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={applying || saving}
          className="px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
        >
          {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {t(applying ? "venture.planImport.applying" : "venture.planImport.apply")}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || applying}
          className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {t("venture.planImport.saveReview")}
        </button>
      </div>
    </div>
  );
}
