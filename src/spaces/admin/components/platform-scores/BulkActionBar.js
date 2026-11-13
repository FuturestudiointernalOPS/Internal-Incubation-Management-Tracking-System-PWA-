"use client";

import { Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The bulk-action bar: select-all-pending, the selected count, the bulk
 * approve/reject buttons and the CSV export.
 * Extracted verbatim from ScoresPage.
 */
export default function BulkActionBar({
  filteredRespondents,
  pendingSelectedIds,
  onSelectAll,
  onApprove,
  onReject,
  onExport,
}) {
  const { t } = useI18n();
  const pendingInFilter = filteredRespondents.filter((respondent) => respondent.status === "submitted");

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase">
          <input
            type="checkbox"
            checked={pendingSelectedIds.length === pendingInFilter.length && filteredRespondents.some((respondent) => respondent.status === "submitted")}
            onChange={(event) => {
              const next = {};
              filteredRespondents.forEach((respondent) => {
                if (respondent.status === "submitted") next[respondent.submission_id] = event.target.checked;
              });
              onSelectAll(next);
            }}
            className="accent-[var(--brand-orange)]"
          />
          {t("adminMisc.platformScores.selectAllPending", { count: pendingInFilter.length })}
        </label>
      </div>
      {pendingSelectedIds.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("adminMisc.platformScores.selectedCount", { count: pendingSelectedIds.length })}
          </span>
          <button
            onClick={onApprove}
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110"
          >
            {t("adminMisc.platformScores.approve")}
          </button>
          <button
            onClick={onReject}
            className="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold uppercase tracking-wide hover:brightness-110"
          >
            {t("adminMisc.platformScores.reject")}
          </button>
        </div>
      )}
      <button
        onClick={onExport}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500/20 transition-all"
      >
        <Download className="w-3 h-3" />
        {t("adminMisc.platformScores.exportCsv")}
      </button>
    </div>
  );
}
