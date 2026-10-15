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
      <div className="jy-top">
        <div style={{ display: "grid", gap: 6 }}>
          <h2>
            <Route size={18} />
            {t("venture.manager.title")}
            <span className="stf-tag o">{t("venture.manager.stagesCount", { count: activeStages.length })}</span>
          </h2>
          <p className="jy-note">{t("venture.manager.intro")}</p>
        </div>
        {access.create && (
          <div className="jy-acts">
            <button onClick={toggleApply} className="stf-btn">
              <Copy size={14} />
              {applyOpen ? t("common.cancel") : t("venture.manager.fromTemplate")}
            </button>
            {access.manage && stages.length > 0 && (
              <button onClick={() => setSaveOpen(!saveOpen)} className="stf-btn">
                <Save size={14} />
                {t("venture.manager.saveTemplate")}
              </button>
            )}
            <button onClick={() => setAddOpen(!addOpen)} className="stf-btn pr">
              {addOpen ? <X size={14} /> : <Plus size={14} />}
              {addOpen ? t("common.cancel") : t("venture.manager.addStage")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
