"use client";

import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The form/run selectors, the sort order and the fetch button.
 * Extracted verbatim from ScoresPage.
 */
export default function ScoresControls({
  forms,
  selectedFormId,
  runs,
  selectedRunId,
  sort,
  loading,
  onFormChange,
  onRunChange,
  onSortChange,
  onFetch,
}) {
  const { t } = useI18n();
  return (
    <div className="card p-6 space-y-4">
      {/* Form selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          {t("adminMisc.platformScores.selectForm")}
        </label>
        <select
          value={selectedFormId}
          onChange={(event) => onFormChange(event.target.value)}
          className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
        >
          <option value="">{t("adminMisc.platformScores.chooseForm")}</option>
          {forms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.name}
            </option>
          ))}
        </select>
      </div>

      {/* Run selector — evaluations are scoped to THIS run */}
      {selectedFormId && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
            {t("adminMisc.platformScores.selectRun")}
          </label>
          <select
            value={selectedRunId}
            onChange={(event) => onRunChange(event.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">{t("adminMisc.platformScores.chooseRun")}</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name || `${t("adminMisc.platformScores.runFallback")} #${run.id}`} ({run.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sort */}
      <div className="flex items-center gap-4">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("adminMisc.platformScores.sort")}
        </label>
        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
        >
          <option value="desc">{t("adminMisc.platformScores.sortDesc")}</option>
          <option value="asc">{t("adminMisc.platformScores.sortAsc")}</option>
        </select>
      </div>

      <button
        onClick={onFetch}
        disabled={loading || !selectedRunId}
        className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("adminMisc.platformScores.loading")}
          </>
        ) : (
          t("adminMisc.platformScores.fetchScores")
        )}
      </button>
    </div>
  );
}
