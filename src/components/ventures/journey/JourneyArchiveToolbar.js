"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import {
  Archive,
  CheckSquare,
  Loader2,
  Square,
  Trash2,
} from "lucide-react";

/**
 * Journey archive toolbar: Active / Archived views, select all, and the
 * bulk archive / delete of the selected journeys.
 *
 * Permanent deletion is Super Admin only (`canDelete`, from the server's
 * `access.delete`): everyone else sees archive/restore and no destroy button.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneyArchiveToolbar({
  activeStages,
  allSelected,
  archivedStages,
  askArchiveSelected,
  askDeleteSelected,
  bulkBusy,
  canDelete,
  selectedStageIds,
  setSelectedStageIds,
  setViewArchived,
  toggleSelectAllStages,
  viewArchived,
}) {
  const { t } = useI18n();
  return (
    <div className="jy-views">
      <div className="stf-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!viewArchived}
          className={!viewArchived ? "on" : ""}
          onClick={() => { setViewArchived(false); setSelectedStageIds(new Set()); }}
        >
          {t("venture.manager.viewActiveJourneys", { n: activeStages.length })}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewArchived}
          className={viewArchived ? "on" : ""}
          onClick={() => { setViewArchived(true); setSelectedStageIds(new Set()); }}
        >
          {t("venture.manager.viewArchivedJourneys", { n: archivedStages.length })}
        </button>
      </div>
      {!viewArchived && activeStages.length > 0 && (
        <button type="button" onClick={toggleSelectAllStages} className="stf-btn sm">
          {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
          {t("venture.manager.selectAllJourneys")}
        </button>
      )}
      {!viewArchived && selectedStageIds.size > 0 && (
        <>
          <button type="button" onClick={askArchiveSelected} disabled={bulkBusy} className="stf-btn sm">
            {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            {t("venture.manager.archiveSelectedJourneys", { n: selectedStageIds.size })}
          </button>
          {canDelete && (
            <button type="button" onClick={askDeleteSelected} disabled={bulkBusy} className="stf-btn sm rj">
              {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {t("venture.manager.deleteSelectedJourneys", { n: selectedStageIds.size })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
