import { Search, Plus } from "lucide-react";

export default function RunsToolbar({ search, setSearch, statusFilter, onStatusFilterChange, onNewRun, t }) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.runs.formRuns")}</h1>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.formRunsSubtitle")}</p>
        </div>
        <button onClick={onNewRun} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110"><Plus className="w-3.5 h-3.5" /> {t("platformMisc.runs.newRun")}</button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" /><input type="text" placeholder={t("platformMisc.runs.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" /></div>
        {/* Changing the filter resets the page here, in the event that causes it:
            an effect would first fire the fetch with the new filter and the old
            page, then fire it again after the reset. */}
        <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="px-3 py-2.5 rounded-xl bg-tertiary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]">
          <option value="all">{t("platformMisc.runs.allStatus")}</option><option value="draft">{t("platformMisc.runs.statusDraft")}</option><option value="scheduled">{t("platformMisc.runs.statusScheduled")}</option><option value="active">{t("platformMisc.runs.statusActive")}</option><option value="closed">{t("platformMisc.runs.statusClosed")}</option><option value="cancelled">{t("platformMisc.runs.statusCancelled")}</option><option value="archived">{t("platformMisc.runs.statusArchived")}</option>
        </select>
      </div>
    </>
  );
}
