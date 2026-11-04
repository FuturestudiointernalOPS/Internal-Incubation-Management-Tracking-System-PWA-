"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Route, Copy, Save, Plus, X, FileSpreadsheet, History, CheckSquare } from "lucide-react";
import AppMenu from "@/components/ui/AppMenu";

/**
 * The journey panel toolbar: the title, the active-stage count, and ONE primary
 * action.
 *
 * The journey-wide actions that used to sit beside it as equal buttons (generate
 * from a template, import a plan, change history, save as a template) are rare
 * and are now behind a single overflow menu — each of them opens a panel that
 * closes itself. "Select" enters selection mode; while it is on, the bulk
 * archive/delete bar and the per-stage checkboxes are the only new controls.
 *
 * Every prop carries the panel value of the same name (state, setter, handler or
 * loop value): the panel keeps all state and all writes, this block only lays
 * the toolbar out.
 */
export default function JourneyPanelHeader({
  access,
  activeStages,
  addOpen,
  saveOpen,
  selectMode,
  stages,
  setAddOpen,
  setSaveOpen,
  toggleApply,
  toggleHistory,
  toggleImport,
  toggleSelectMode,
}) {
  const { t } = useI18n();

  const overflow = [];
  if (access.create) {
    overflow.push({
      key: "template",
      label: t("venture.manager.fromTemplate"),
      icon: Copy,
      onSelect: toggleApply,
    });
    overflow.push({
      key: "import",
      label: t("venture.planImport.title"),
      icon: FileSpreadsheet,
      onSelect: toggleImport,
    });
  }
  overflow.push({
    key: "history",
    label: t("venture.changes.title"),
    icon: History,
    onSelect: toggleHistory,
  });
  if (access.create && access.manage && stages.length > 0) {
    overflow.push({ key: "sep", separator: true });
    overflow.push({
      key: "save",
      label: t("venture.manager.saveTemplate"),
      icon: Save,
      onSelect: () => setSaveOpen(!saveOpen),
    });
  }

  return (
    <div className="jy-top">
      <div style={{ display: "grid", gap: 6 }}>
        <h2>
          <Route size={18} />
          {t("venture.manager.title")}
          <span className="stf-tag o">
            {t("venture.manager.stagesCount", { count: activeStages.length })}
          </span>
        </h2>
        {/* Guidance is only useful while there is nothing to guide: once the
            journeys exist, the journeys are the explanation. */}
        {activeStages.length === 0 && <p className="jy-note">{t("venture.manager.intro")}</p>}
      </div>
      <div className="jy-acts">
        {access.manage && (
          <button
            type="button"
            onClick={toggleSelectMode}
            aria-pressed={selectMode}
            className={`stf-btn${selectMode ? " pr" : ""}`}
          >
            <CheckSquare size={14} />
            {selectMode ? t("common.cancel") : t("venture.manager.selectJourney")}
          </button>
        )}
        <AppMenu label={t("venture.manager.journeyActions")} align="right" items={overflow} />
        {access.create && (
          <button onClick={() => setAddOpen(!addOpen)} className="stf-btn pr">
            {addOpen ? <X size={14} /> : <Plus size={14} />}
            {addOpen ? t("common.cancel") : t("venture.manager.addStage")}
          </button>
        )}
      </div>
    </div>
  );
}
