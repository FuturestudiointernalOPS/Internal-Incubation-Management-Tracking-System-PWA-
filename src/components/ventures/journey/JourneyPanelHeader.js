"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Route, Copy, Save, Plus, X } from "lucide-react";

/**
 * The journey panel toolbar: the title + active-stage count, and the Create
 * actions ("From template" / "Save as template" / "Add journey"), with the
 * intro line underneath.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneyPanelHeader({
  access,
  activeStages,
  addOpen,
  applyOpen,
  saveOpen,
  stages,
  setAddOpen,
  setSaveOpen,
  toggleApply,
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.manager.title")}
          <span className="px-1.5 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)]">{t("venture.manager.stagesCount", { count: activeStages.length })}</span>
        </h3>
        {access.create && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleApply}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" />
              {applyOpen ? t("common.cancel") : t("venture.manager.fromTemplate")}
            </button>
            {access.manage && stages.length > 0 && (
              <button
                onClick={() => setSaveOpen(!saveOpen)}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-brand-orange/40 text-[var(--brand-orange)] hover:bg-brand-orange/10 flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                {t("venture.manager.saveTemplate")}
              </button>
            )}
            <button
              onClick={() => setAddOpen(!addOpen)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
            >
              {addOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {addOpen ? t("common.cancel") : t("venture.manager.addStage")}
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mb-3 -mt-1">{t("venture.manager.intro")}</p>
    </>
  );
}
