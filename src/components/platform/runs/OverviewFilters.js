import { AlertTriangle, ChevronDown, Download, Filter, Key, Mail, Plus, RefreshCw, Search, Send, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TRACKING_FILTERS } from "./constants";
import { cn } from "./helpers";

export default function OverviewFilters({ ctx }) {
  const { t } = useI18n();
  const { activeFieldFilters, activeTrackingFilters, allFilteredSelected, availableParams, bulkMenuOpen, bulkProcessing, clearRunFilters, clearScoreFilter, duplicateGroups, fieldOptionsOf, filterPickerMode, filterPickerOpen, filterRowRef, filteredSubmissions, hasRunFilters, openActivationConfirm, openMessageComposer, openSendResultConfirm, perPage, pickFilterParam, removeFieldFilter, respSafePage, respSearch, scoreChipActive, scoreChipLabel, scoreOp, scoreValue, scoreValue2, selectedIds, setBulkConfirmOpen, setBulkIncludeResultPdf, setBulkMenuOpen, setExportScope, setFieldFilters, setFilterPickerMode, setFilterPickerOpen, setRespSearch, setScoreOp, setScoreValue, setScoreValue2, setShowDuplicates, setShowExportOptions, setTrackingFilter, showDuplicates, toggleSelectAllFiltered, trackingFilterOptionLabel, trackingFilterOptions, visibleSubmissions } = ctx;
  return (
    <>
              {/* Run-scoped search + filters */}
              <div className="rounded-xl border border-[var(--border-primary)] bg-secondary p-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={respSearch}
                    onChange={(event) => setRespSearch(event.target.value)}
                    placeholder="Search this run's respondents (name, email, answers)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap" ref={filterRowRef}>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    <Filter className="w-3 h-3" /> Filters
                  </span>

                  {/* Active filter chips — each removable individually */}
                  {scoreChipActive && (
                    <button
                      onClick={clearScoreFilter}
                      title="Remove this filter"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/30 text-[10px] font-bold text-[var(--brand-orange)] hover:bg-brand-orange/20"
                    >
                      {scoreChipLabel} <X className="w-3 h-3" />
                    </button>
                  )}

                  {activeFieldFilters.map(([label, filterValue]) => (
                    <button
                      key={label}
                      onClick={() => removeFieldFilter(label)}
                      title="Remove this filter"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/30 text-[10px] font-bold text-[var(--brand-orange)] hover:bg-brand-orange/20"
                    >
                      {label}: {filterValue} <X className="w-3 h-3" />
                    </button>
                  ))}

                  {activeTrackingFilters.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setTrackingFilter(filter.key, "")}
                      title="Remove this filter"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/30 text-[10px] font-bold text-[var(--brand-orange)] hover:bg-brand-orange/20"
                    >
                      {filter.label}: {trackingFilterOptionLabel(filter.key, filter.value)} <X className="w-3 h-3" />
                    </button>
                  ))}

                  {/* Inline editor — AI Score */}
                  {filterPickerMode === "score" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tertiary border border-brand-orange/30">
                      <select
                        value={scoreOp}
                        onChange={(event) => setScoreOp(event.target.value)}
                        className="bg-primary border border-[var(--border-primary)] rounded-md px-1.5 py-1 text-sm font-bold outline-none"
                      >
                        <option value="gte">≥</option>
                        <option value="gt">&gt;</option>
                        <option value="eq">=</option>
                        <option value="lte">≤</option>
                        <option value="lt">&lt;</option>
                        <option value="between">Between</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={scoreValue}
                        onChange={(event) => setScoreValue(event.target.value)}
                        placeholder="80"
                        className="w-14 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
                      />
                      {scoreOp === "between" && (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={scoreValue2}
                          onChange={(event) => setScoreValue2(event.target.value)}
                          placeholder="90"
                          className="w-14 px-2 py-1 rounded-md bg-primary border border-[var(--border-primary)] text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
                        />
                      )}
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]">%</span>
                      <button
                        onClick={() => setFilterPickerMode(null)}
                        disabled={scoreValue === ""}
                        className="px-2 py-1 rounded-md bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide disabled:opacity-40"
                      >
                        Apply
                      </button>
                      <button onClick={() => { setFilterPickerMode(null); clearScoreFilter(); }} className="text-[var(--text-secondary)] hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Inline editor — form field option */}
                  {filterPickerMode && filterPickerMode.type === "field" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tertiary border border-brand-orange/30">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{filterPickerMode.label}:</span>
                      <select
                        value=""
                        onChange={(event) => {
                          if (event.target.value) {
                            setFieldFilters((prev) => ({ ...prev, [filterPickerMode.label]: event.target.value }));
                            setFilterPickerMode(null);
                          }
                        }}
                        className="bg-primary border border-[var(--border-primary)] rounded-md px-1.5 py-1 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
                      >
                        <option value="">Select…</option>
                        {fieldOptionsOf(filterPickerMode.label).map((option, index) => (
                          <option key={`${filterPickerMode.label}-${index}`} value={String(option)}>
                            {String(option)}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => setFilterPickerMode(null)} className="text-[var(--text-secondary)] hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Inline editor — tracking filter (Approval Email / Review / Status / Activation Email / Account Status) */}
                  {filterPickerMode && filterPickerMode.type === "status" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-tertiary border border-brand-orange/30">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {TRACKING_FILTERS.find((filter) => filter.key === filterPickerMode.key)?.label || filterPickerMode.key}:
                      </span>
                      <select
                        value=""
                        onChange={(event) => {
                          if (event.target.value) {
                            setTrackingFilter(filterPickerMode.key, event.target.value);
                            setFilterPickerMode(null);
                          }
                        }}
                        className="bg-primary border border-[var(--border-primary)] rounded-md px-1.5 py-1 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
                      >
                        <option value="">Select…</option>
                        {trackingFilterOptions(filterPickerMode.key).map((optionValue) => (
                          <option key={optionValue} value={optionValue}>{trackingFilterOptionLabel(filterPickerMode.key, optionValue)}</option>
                        ))}
                      </select>
                      <button onClick={() => setFilterPickerMode(null)} className="text-[var(--text-secondary)] hover:text-rose-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* + Add Filter dropdown — parameters come from this run's form */}
                  {availableParams.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setFilterPickerOpen(!filterPickerOpen)}
                        className="px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Filter
                      </button>
                      {filterPickerOpen && (
                        <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-[var(--border-primary)] bg-secondary shadow-xl z-30 max-h-64 overflow-y-auto">
                          {availableParams.map((param) => (
                            <button
                              key={param.key}
                              onClick={() => pickFilterParam(param)}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold text-[var(--text-primary)] hover:bg-tertiary"
                            >
                              {param.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {duplicateGroups.groups.length > 0 && (
                    <button
                      onClick={() => setShowDuplicates(!showDuplicates)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border", showDuplicates ? "bg-amber-500 text-black border-amber-500" : "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20")}
                    >
                      {showDuplicates ? "Show all" : `Duplicates (${duplicateGroups.extra})`}
                    </button>
                  )}

                  {hasRunFilters && (
                    <button
                      onClick={clearRunFilters}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20"
                    >
                      Clear all
                    </button>
                  )}

                  {/* Export the CURRENTLY FILTERED set (or selection) */}
                  {visibleSubmissions.length > 0 && (
                    <button
                      onClick={() => { setShowExportOptions(true); setExportScope("filtered"); }}
                      className="ml-auto px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500/20 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> {t("platformMisc.runs.exportBtn")} ({visibleSubmissions.length})
                    </button>
                  )}
                </div>

                {/* Visual separator between the filter controls and the selection bar */}
                <div className="border-t border-[var(--border-primary)]" />

                {/* Bulk selection bar — selection always respects the active filters */}
                {duplicateGroups.groups.length > 0 && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500">
                    <AlertTriangle className="w-3 h-3" />
                    {duplicateGroups.groups.length} duplicate email group{duplicateGroups.groups.length === 1 ? "" : "s"} — {duplicateGroups.extra} extra submission{duplicateGroups.extra === 1 ? "" : "s"}. Only the highest-scored duplicate receives emails.
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        className="accent-[var(--brand-orange)] w-3.5 h-3.5"
                      />
                      Select all filtered
                    </label>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {showDuplicates
                        ? `${visibleSubmissions.length} duplicate submission${visibleSubmissions.length === 1 ? "" : "s"}`
                        : `${filteredSubmissions.length} respondent${filteredSubmissions.length === 1 ? "" : "s"} match your filters`}
                    </span>
                  </div>
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--brand-orange)]">
                        {selectedIds.length} selected
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setBulkMenuOpen(!bulkMenuOpen)}
                          disabled={bulkProcessing}
                          className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide disabled:opacity-50 flex items-center gap-1"
                        >
                          Actions <ChevronDown className="w-3 h-3" />
                        </button>
                        {bulkMenuOpen && (
                          <div className="absolute right-0 mt-1 w-56 rounded-lg border border-[var(--border-primary)] bg-secondary shadow-xl z-30">
                            <button
                              type="button"
                              onClick={() => { setBulkMenuOpen(false); setBulkIncludeResultPdf(false); setBulkConfirmOpen(true); }}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-emerald-400 hover:bg-emerald-500/10"
                            >
                              {t("platformMisc.runs.approve")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openActivationConfirm(false)}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[var(--text-primary)] hover:bg-tertiary flex items-center gap-1.5"
                            >
                              <Key className="w-3 h-3" /> {t("platformMisc.runs.sendActivationMessage")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openActivationConfirm(true)}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-amber-400 hover:bg-amber-500/10 flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3 h-3" /> {t("platformMisc.runs.resendActivationMessage")}
                            </button>
                            <button
                              type="button"
                              onClick={openSendResultConfirm}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-sky-400 hover:bg-sky-500/10 flex items-center gap-1.5"
                            >
                              <Send className="w-3 h-3" /> {t("platformMisc.runs.sendResponse")}
                            </button>
                            <button
                              type="button"
                              onClick={openMessageComposer}
                              className="w-full px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[var(--text-primary)] hover:bg-tertiary flex items-center gap-1.5"
                            >
                              <Mail className="w-3 h-3" /> {t("platformMisc.runs.sendCustomMessage")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("platformMisc.runs.showingRespondentsInRun", { start: visibleSubmissions.length === 0 ? 0 : (respSafePage - 1) * perPage + 1, end: Math.min(respSafePage * perPage, visibleSubmissions.length), total: visibleSubmissions.length })}
                </p>
              </div>
    </>
  );
}
