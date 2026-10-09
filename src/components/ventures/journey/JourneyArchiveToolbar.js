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
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <button
        onClick={() => { setViewArchived(false); setSelectedStageIds(new Set()); }}
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${!viewArchived ? "bg-brand-orange/15 text-[var(--brand-orange)] border-brand-orange/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}
      >
        {t("venture.manager.viewActiveJourneys", { n: activeStages.length })}
      </button>
      <button
        onClick={() => { setViewArchived(true); setSelectedStageIds(new Set()); }}
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${viewArchived ? "bg-brand-orange/15 text-[var(--brand-orange)] border-brand-orange/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}
      >
        {t("venture.manager.viewArchivedJourneys", { n: archivedStages.length })}
      </button>
      {!viewArchived && activeStages.length > 0 && (
        <button
          onClick={toggleSelectAllStages}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[var(--text-primary)] border border-[var(--border-primary)] transition-all"
        >
          {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          {t("venture.manager.selectAllJourneys")}
        </button>
      )}
      {!viewArchived && selectedStageIds.size > 0 && (
        <>
          <button
            onClick={askArchiveSelected}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
          >
            {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            {t("venture.manager.archiveSelectedJourneys", { n: selectedStageIds.size })}
          </button>
          {canDelete && (
            <button
              onClick={askDeleteSelected}
              disabled={bulkBusy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-40"
            >
              {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {t("venture.manager.deleteSelectedJourneys", { n: selectedStageIds.size })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
