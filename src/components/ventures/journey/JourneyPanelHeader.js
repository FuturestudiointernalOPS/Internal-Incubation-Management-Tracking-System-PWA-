"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Route, Copy, Save, Plus, X, FileSpreadsheet, History } from "lucide-react";

/**
 * The journey panel toolbar: the title + active-stage count, and the Create
 * actions ("From template" / "Import a plan" / "Change history" / "Save as
 * template" / "Add journey"), with the intro line underneath.
 *
 * Import and history sit here, beside "From template", because all three act on
 * the journey as a whole: a template generates it, a tracker proposes it, and
 * the change log says what happened to it. Each one opens its own panel below,
 * so the toolbar stays one line of actions.
 *
 * Every prop carries the panel value of the same name (state, setter, handler or
 * loop value): the panel keeps all state and all writes, this block only lays
 * the toolbar out.
 */
export default function JourneyPanelHeader({
  access,
  activeStages,
  addOpen,
  applyOpen,
  historyOpen,
  importOpen,
  saveOpen,
  stages,
  setAddOpen,
  setSaveOpen,
  toggleApply,
  toggleHistory,
  toggleImport,
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
        <div className="jy-acts">
          {access.create && (
            <>
              <button onClick={toggleApply} className="stf-btn">
                <Copy size={14} />
                {applyOpen ? t("common.cancel") : t("venture.manager.fromTemplate")}
              </button>
              <button onClick={toggleImport} className="stf-btn">
                <FileSpreadsheet size={14} />
                {importOpen ? t("common.cancel") : t("venture.planImport.title")}
              </button>
            </>
          )}
          <button onClick={toggleHistory} className="stf-btn">
            <History size={14} />
            {historyOpen ? t("common.cancel") : t("venture.changes.title")}
          </button>
          {access.create && access.manage && stages.length > 0 && (
            <button onClick={() => setSaveOpen(!saveOpen)} className="stf-btn">
              <Save size={14} />
              {t("venture.manager.saveTemplate")}
            </button>
          )}
          {access.create && (
            <button onClick={() => setAddOpen(!addOpen)} className="stf-btn pr">
              {addOpen ? <X size={14} /> : <Plus size={14} />}
              {addOpen ? t("common.cancel") : t("venture.manager.addStage")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
