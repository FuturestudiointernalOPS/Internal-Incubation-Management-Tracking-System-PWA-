import {
  AlertTriangle, CheckCircle2, ChevronDown, Download, Eye, FileText, Filter,
  Hash, History, Key, Loader2, Mail, Plus, RefreshCw, RotateCcw, Search, Send, X, XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppPdfPreview from "@/components/ui/AppPdfPreview";
import {
  ACCOUNT_STATUS_STYLES, EMAIL_STATUS_CONFIG, PAYMENT_ACCESS_LABELS,
  PAYMENT_EMAIL_LABELS, PAYMENT_STATUS_STYLES, SUB_STATUS, TRACKING_FILTERS,
} from "./constants";
import { cn, fetchResultPdf } from "./helpers";
import SubmissionTimeline from "./SubmissionTimeline";

export default function OverviewTab({
  subtotal, submitted, approved, rejected, revision, drafts, overdue,
  respSearch, setRespSearch,
  scoreChipActive, scoreChipLabel, clearScoreFilter,
  activeFieldFilters, removeFieldFilter,
  activeTrackingFilters, setTrackingFilter,
  filterPickerMode, setFilterPickerMode, filterRowRef,
  scoreOp, setScoreOp, scoreValue, setScoreValue, scoreValue2, setScoreValue2,
  fieldOptionsOf, setFieldFilters,
  filterPickerOpen, setFilterPickerOpen,
  availableParams, pickFilterParam,
  trackingFilterOptions, trackingFilterOptionLabel,
  duplicateGroups, showDuplicates, setShowDuplicates,
  hasRunFilters, clearRunFilters,
  visibleSubmissions, setShowExportOptions, setExportScope,
  allFilteredSelected, toggleSelectAllFiltered,
  filteredSubmissions,
  selectedIds, selectedSet, toggleSelect,
  bulkMenuOpen, setBulkMenuOpen, bulkProcessing,
  setBulkIncludeResultPdf, setBulkConfirmOpen,
  openActivationConfirm, openSendResultConfirm, openMessageComposer,
  respSafePage, perPage,
  subLoading,
  runFormFields,
  pagedSubmissions,
  paymentsBySubmission, reviews, evaluations, emailLog,
  duplicateEmailSet,
  evaluatedSubmissionIds,
  openReview, handleDeleteSubmission,
  setSelectedSubmission, selectedSubmission,
  respTotalPages, setRespPage,
  bulkConfirmOpen, bulkIncludeResultPdf, allSelectedEvaluated, runBulkApprove,
  activationConfirmOpen, activationForceResend,
  eligibleResendActivationIds, eligibleSendActivationIds,
  submissions,
  setActivationConfirmOpen, activationProcessing, runSendActivationMessages,
  activationProgress,
  resultConfirmOpen, eligibleSendResultIds,
  resultPreviewId, setResultPreviewId,
  closeSendResultConfirm, resultProcessing, runSendResultEmails,
  previewSubmission, runSettings, reportFile, regenerateReport, reportRegenerating,
  previewNonce, setPreviewSubmission,
  resultProgress,
  bulkAbortRef, bulkProgress,
  bulkSummary, setBulkSummary,
  messageSummary, setMessageSummary,
  subFilter, setSubFilter,
}) {
  const { t } = useI18n();
  return (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {[
                  { label: t("platformMisc.runs.total"), value: subtotal, filter: "all", icon: Hash, color: "text-[var(--text-primary)]" },
                  { label: t("platformMisc.runs.statusSubmitted"), value: submitted, filter: "submitted", icon: Send, color: "text-blue-500" },
                  { label: t("platformMisc.runs.statusApproved"), value: approved, filter: "approved", icon: CheckCircle2, color: "text-emerald-500" },
                  { label: t("platformMisc.runs.statusRejected"), value: rejected, filter: "rejected", icon: XCircle, color: "text-rose-500" },
                  { label: t("platformMisc.runs.statusRevision"), value: revision, filter: "revision_requested", icon: RotateCcw, color: "text-amber-500" },
                  { label: t("platformMisc.runs.drafts"), value: drafts, filter: "draft", icon: FileText, color: "text-slate-500" },
                  ...(overdue > 0 ? [{ label: t("platformMisc.runs.overdue"), value: overdue, filter: "submitted", icon: AlertTriangle, color: "text-rose-500" }] : []),
                ].map((statCard) => (
                  <button
                    key={statCard.label}
                    onClick={() => setSubFilter(subFilter === statCard.filter ? "all" : statCard.filter)}
                    className={cn(
                      "p-4 rounded-2xl border text-center transition-all",
                      subFilter === statCard.filter
                        ? "bg-brand-orange/10 border-[var(--brand-orange)]"
                        : "bg-secondary border-[var(--border-primary)] hover:border-[var(--text-secondary)]"
                    )}
                  >
                    <p className={cn("text-2xl font-black", statCard.color)}>{statCard.value}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5"><statCard.icon className={cn("w-2.5 h-2.5", statCard.color)} /><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{statCard.label}</p></div>
                  </button>
                ))}
              </div>

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

              {/* Submissions table */}
              {subLoading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div> : (
                <>
                <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                  <table className="w-full text-left">
                    <thead className="bg-tertiary">
                      <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAllFiltered}
                            className="accent-[var(--brand-orange)] w-3.5 h-3.5 align-middle"
                          />
                        </th>
                        <th className="px-4 py-3 w-10">{t("platformMisc.runs.colSn")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colEmail")}</th>
                        {runFormFields.slice(0, 2).map(field => (
                          <th key={field.id} className="px-3 py-3 max-w-[120px]" title={field.label}>
                            <span className="line-clamp-1">{field.label.length > 25 ? field.label.substring(0, 25) + "..." : field.label}</span>
                          </th>
                        ))}
                        <th className="px-4 py-3">{t("platformMisc.runs.statusSubmitted")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colAiScore")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colApprovalEmail")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.review")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colStatus")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colActivationEmail")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colAccountStatus")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colPayment")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colActions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-primary)]">
                      {pagedSubmissions.map((submission, rowIndex) => {
                        const statusConfig = SUB_STATUS[submission.status] || SUB_STATUS.draft;
                        const payment = paymentsBySubmission[String(submission.id)] || null;
                        const submissionReviews = reviews.filter((review) => review.submission_id === submission.id);
                        const lastReview = submissionReviews[submissionReviews.length - 1];
                        const submissionData = submission.data || {};
                        const scores = submissionData._scores;
                        // AI evaluation table is the source of truth; fall back
                        // to legacy inline _scores for pre-evaluation data.
                        const evalRow = evaluations.find((evaluationRow) => evaluationRow.submission_id === submission.id);
                        const overall = evalRow != null ? evalRow.overall_score : scores?.overall;
                        const ranking = evalRow != null ? evalRow.ranking : scores?.ranking;
                        const activationEmail = emailLog
                          .filter((emailRow) => emailRow.submission_id === submission.id && emailRow.email_type === "activation")
                          .slice(-1)[0];
                        // "Actually sent" must come from sent rows in the full
                        // history (activation_history.first_sent_at) — never
                        // inferred from a queued/pending row or account status.
                        const activationEverSent =
                          !!submission.activation_history?.first_sent_at ||
                          (activationEmail && ["sent", "delivered", "opened", "clicked"].includes(activationEmail.status));
                        const approvalEmail = emailLog
                          .filter((emailRow) => emailRow.submission_id === submission.id && emailRow.email_type === "approval")
                          .slice(-1)[0];
                        const accountStatus = submission.account_status || (submission.account_activated
                          ? "active"
                          : submission.account_created
                            ? "activation_pending"
                            : "not_created");
                        // The address the system actually sent to (from the
                        // delivery log) — falls back to the resolved respondent
                        // email when nothing has been sent yet.
                        const sentLog = [...emailLog]
                          .filter((emailRow) => emailRow.submission_id === submission.id && (emailRow.status === "sent" || emailRow.status === "failed"))
                          .slice(-1)[0];
                        const sentEmail = sentLog?.recipient || submission.email || "";
                        const scoreColor = overall != null
                          ? overall >= 80 ? "text-emerald-500"
                          : overall >= 60 ? "text-amber-500"
                          : "text-rose-500"
                          : "";
                        const scoreBg = overall != null
                          ? overall >= 80 ? "bg-emerald-500/10"
                          : overall >= 60 ? "bg-amber-500/10"
                          : "bg-rose-500/10"
                          : "";
                        
                        // Helper to get field value from submission data
                        const fieldValueText = (field) => {
                          const rawValue = submissionData[field.label] ?? submissionData[String(field.id)] ?? submissionData[field.id];
                          if (rawValue === undefined || rawValue === null || rawValue === "") return "—";
                          const text = String(rawValue);
                          if (text.startsWith("{") && text.includes('"code"')) {
                            try { const parsedPhone = JSON.parse(text); if (parsedPhone.code && parsedPhone.number) return `${parsedPhone.code} ${parsedPhone.number}`; } catch (_) {}
                          }
                          return text.length > 30 ? text.substring(0, 30) + "..." : text;
                        };
                        
                        return (
                          <tr key={submission.id} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                            <td className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={selectedSet.has(submission.id)}
                                onChange={() => toggleSelect(submission.id)}
                                className="accent-[var(--brand-orange)] w-3.5 h-3.5 align-middle"
                              />
                            </td>
                            {/* S/N — presentation-level row number, continuous across pages and respecting filters */}
                            <td className="px-4 py-3 w-10 text-center text-sm font-bold text-[var(--text-primary)]">
                              {(respSafePage - 1) * perPage + rowIndex + 1}
                            </td>
                            {/* Email — the address the system actually sent to (from the delivery log), falling back to the resolved respondent email */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="text-[10px] font-medium text-[var(--text-secondary)] truncate max-w-[160px] block"
                                  title={sentLog
                                    ? t("platformMisc.runs.emailSentToTooltip", { recipient: sentLog.recipient || "n/a", type: sentLog.email_type, provider: sentLog.provider || "email", status: sentLog.status, date: sentLog.sent_at ? ", " + new Date(sentLog.sent_at).toLocaleString() : "" })
                                    : submission.email || t("platformMisc.runs.noEmailProvided")}
                                >
                                  {sentEmail || t("platformMisc.runs.noEmailProvided")}
                                </span>
                                {submission.email && duplicateEmailSet.has(String(submission.email).trim().toLowerCase()) && (
                                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap", duplicateGroups.keeperIds.has(submission.id) ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                    {duplicateGroups.keeperIds.has(submission.id) ? t("platformMisc.runs.emailKeeper") : t("platformMisc.runs.emailDuplicate")}
                                  </span>
                                )}
                              </div>
                            </td>
                            {runFormFields.slice(0, 2).map(field => (
                              <td key={field.id} className="px-3 py-3 text-[10px] font-medium text-[var(--text-secondary)] max-w-[150px] truncate" title={fieldValueText(field)}>{fieldValueText(field)}</td>
                            ))}
                            <td className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">{submission.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3">
                              {overall != null ? (
                                <div className="flex flex-col">
                                  <span className={cn("text-sm font-bold", scoreColor)}>{overall}%</span>
                                  {ranking && <span className={cn("text-[10px] font-bold uppercase mt-0.5 px-1.5 py-0.5 rounded", scoreColor, scoreBg)}>{ranking}</span>}
                                </div>
                              ) : (
                                <span className="text-[10px] font-medium text-[var(--text-secondary)]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {approvalEmail ? (
                                (() => {
                                  const approvalStatusConfig = EMAIL_STATUS_CONFIG[approvalEmail.status] || { color: "text-slate-500", bg: "bg-slate-500/10", label: "platformMisc.runs.emailPending" };
                                  return (
                                    <span title={approvalEmail.error || t(approvalStatusConfig.label)} className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", approvalStatusConfig.bg, approvalStatusConfig.color)}>
                                      {t(approvalStatusConfig.label)}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span title={t("platformMisc.runs.emailNotSentTitle")} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-500/10 text-slate-400">{t("platformMisc.runs.emailNotSent")}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">
                              {lastReview ? <span>{lastReview.decision} {t("platformMisc.runs.by")} {lastReview.reviewer_name || lastReview.reviewer_id}</span> : "—"}
                            </td>
                            <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", statusConfig.color, statusConfig.bg)}>{t(statusConfig.label)}</span></td>
                            <td className="px-4 py-3">
                              {activationEverSent || activationEmail?.status === "failed" ? (
                                (() => {
                                  const activationStatusConfig = EMAIL_STATUS_CONFIG[activationEmail.status] || { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailPending" };
                                  return (
                                    <span title={activationEmail.error || t(activationStatusConfig.label)} className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", activationStatusConfig.bg, activationStatusConfig.color)}>
                                      {t(activationStatusConfig.label)}
                                    </span>
                                  );
                                })()
                              ) : (
                                <span
                                  title={activationEmail?.error ? `${t("platformMisc.runs.activationNotSentYet")} — ${activationEmail.error}` : t("platformMisc.runs.activationNotSentYet")}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-500/10 text-slate-400"
                                >
                                  {t("platformMisc.runs.emailNotSent")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                const accountStatusConfig = ACCOUNT_STATUS_STYLES[accountStatus] || ACCOUNT_STATUS_STYLES.not_created;
                                const activationHistory = submission.activation_history;
                                // A queued/pending row is NOT "sent" — show it as
                                // not-sent-yet so the column never implies an
                                // activation email went out when it did not.
                                const emailStatusShown =
                                  activationHistory?.email_status && !["pending", "skipped", "cancelled"].includes(activationHistory.email_status)
                                    ? t("platformMisc.runs.activationEmailStatus", { status: t(EMAIL_STATUS_CONFIG[activationHistory.email_status]?.label || "platformMisc.runs.emailPending") })
                                    : null;
                                const historyTitle = [
                                  t(accountStatusConfig.title),
                                  emailStatusShown || t("platformMisc.runs.activationNotSentYet"),
                                  activationHistory?.first_sent_at ? t("platformMisc.runs.activationFirstSent", { date: new Date(activationHistory.first_sent_at).toLocaleString() }) : null,
                                  activationHistory?.last_sent_at ? t("platformMisc.runs.activationLastSent", { date: new Date(activationHistory.last_sent_at).toLocaleString() }) : null,
                                  activationHistory?.token_valid ? t("platformMisc.runs.activationLinkValid", { date: activationHistory.token_expires_at ? new Date(activationHistory.token_expires_at).toLocaleString() : "" }) : (activationHistory?.token_expires_at ? t("platformMisc.runs.activationLinkExpired") : null),
                                ].filter(Boolean).join(" | ");
                                return (
                                  <span title={historyTitle} className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", accountStatusConfig.cls)}>
                                    {t(accountStatusConfig.label)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              {(() => {
                                if (!payment) {
                                  return (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-500/10 text-slate-400">
                                      {t("platformMisc.runs.paymentNone")}
                                    </span>
                                  );
                                }
                                const paymentStyle = PAYMENT_STATUS_STYLES[payment.status] || PAYMENT_STATUS_STYLES.pending;
                                const paymentTitle = [
                                  t("platformMisc.runs.paymentAmountTitle", { amount: `${Number(payment.amount || 0).toLocaleString()} ${payment.currency || ""}`.trim() }),
                                  t("platformMisc.runs.paymentAccessTitle", { status: t(PAYMENT_ACCESS_LABELS[payment.access_status] || PAYMENT_ACCESS_LABELS.pending) }),
                                  t("platformMisc.runs.paymentEmailTitle", { status: t(PAYMENT_EMAIL_LABELS[payment.email_status] || PAYMENT_EMAIL_LABELS.pending) }),
                                  `${t("platformMisc.runs.colPaymentReference")}: ${payment.reference}`,
                                ].join(" | ");
                                return (
                                  <span title={paymentTitle} className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap", paymentStyle.cls)}>
                                    {t(paymentStyle.label)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => setSelectedSubmission(selectedSubmission?.id === submission.id ? null : submission)} className="px-2 py-1 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide hover:bg-brand-orange/10 hover:text-[var(--brand-orange)] flex items-center gap-1">
                                  <History className="w-3 h-3" /> {t("platformMisc.runs.history")}
                                </button>
                                <a href={`/platform/runs/review/${submission.id}`} className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase tracking-wide hover:bg-purple-500/20 flex items-center gap-1">
                                  <Eye className="w-3 h-3" /> {t("platformMisc.runs.full")}
                                </a>
                                {submission.status !== "draft" && evaluatedSubmissionIds.has(submission.id) && (
                                  <button onClick={() => setPreviewSubmission(submission)} className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase tracking-wide hover:bg-sky-500/20 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> {t("platformMisc.runs.previewResult")}
                                  </button>
                                )}
                                {submission.status === "submitted" && (
                                  <button onClick={() => openReview(submission)} className="px-2 py-1 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)] text-[10px] font-bold uppercase tracking-wide hover:bg-brand-orange/20">{t("platformMisc.runs.review")}</button>
                                )}
                                <button onClick={() => handleDeleteSubmission(submission.id)} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20">{t("platformMisc.runs.delete")}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {respTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">Page {respSafePage} of {respTotalPages}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setRespPage(Math.max(1, respSafePage - 1))} disabled={respSafePage === 1} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">Prev</button>
                      {Array.from({ length: Math.min(respTotalPages, 7) }, (_, pageOffset) => {
                        let pageNumber;
                        if (respTotalPages <= 7) pageNumber = pageOffset + 1;
                        else if (respSafePage <= 4) pageNumber = pageOffset + 1;
                        else if (respSafePage >= respTotalPages - 3) pageNumber = respTotalPages - 6 + pageOffset;
                        else pageNumber = respSafePage - 3 + pageOffset;
                        return <button key={pageNumber} onClick={() => setRespPage(pageNumber)} className={cn("w-7 h-7 rounded-lg text-[10px] font-bold", respSafePage === pageNumber ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>{pageNumber}</button>;
                      })}
                      <button onClick={() => setRespPage(Math.min(respTotalPages, respSafePage + 1))} disabled={respSafePage === respTotalPages} className="px-2 py-1 rounded-lg bg-tertiary text-[10px] font-bold text-[var(--text-secondary)] disabled:opacity-30 hover:text-[var(--text-primary)]">Next</button>
                    </div>
                  </div>
                )}
                </>
              )}

              {/* Submission Timeline (expandable per submission) */}
              {selectedSubmission && (
                <SubmissionTimeline submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
              )}

              {/* ─── BULK APPROVE CONFIRM ─── */}
              {bulkConfirmOpen && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-4">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">
                      {t("platformMisc.runs.bulkApproveTitle", { count: selectedIds.length })}
                    </h4>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] leading-relaxed">
                      {t("platformMisc.runs.bulkApproveDesc")}
                    </p>
                    <div className="rounded-xl p-3 bg-primary border border-[var(--border-primary)]">
                      <label className={cn("flex items-start gap-2", allSelectedEvaluated ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                        <input
                          type="checkbox"
                          checked={bulkIncludeResultPdf}
                          disabled={!allSelectedEvaluated}
                          onChange={(event) => setBulkIncludeResultPdf(event.target.checked)}
                          className="mt-0.5 w-3.5 h-3.5 accent-[var(--brand-orange)]"
                        />
                        <span>
                          <span className="block text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.includeResultPdf")}</span>
                          <span className="block text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                            {allSelectedEvaluated ? t("platformMisc.runs.includeResultPdfDesc") : t("platformMisc.runs.bulkIncludeResultPdfNotEvaluated")}
                          </span>
                        </span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setBulkConfirmOpen(false); setBulkIncludeResultPdf(false); }} disabled={bulkProcessing} className="px-4 py-2 rounded-lg bg-tertiary text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{t("platformMisc.runs.cancel")}</button>
                      <button onClick={runBulkApprove} disabled={bulkProcessing} className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide">
                        {t("platformMisc.runs.bulkApproveConfirm", { count: selectedIds.length })}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── SEND ACTIVATION MESSAGES CONFIRM ─── */}
              {activationConfirmOpen && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-4">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">
                      {t(activationForceResend ? "platformMisc.runs.activationResendConfirmTitle" : "platformMisc.runs.activationConfirmTitle")}
                    </h4>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] leading-relaxed">
                      {t(activationForceResend ? "platformMisc.runs.activationResendConfirmDesc" : "platformMisc.runs.activationConfirmDesc", { count: (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length })}
                    </p>
                    {activationForceResend && eligibleResendActivationIds.slice(0, 5).map((id) => {
                      const submission = submissions.find((candidate) => candidate.id === id);
                      const activationHistory = submission?.activation_history;
                      return (
                        <div key={id} className="rounded-lg bg-primary/50 border border-[var(--border-primary)] px-3 py-2 text-[10px] font-medium text-[var(--text-secondary)] space-y-0.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)] truncate">{submission?.display_name || submission?.submitter_name || `#${id}`}</p>
                          {activationHistory?.first_sent_at && <p>{t("platformMisc.runs.activationFirstSent", { date: new Date(activationHistory.first_sent_at).toLocaleString() })}</p>}
                          {activationHistory?.last_sent_at && <p>{t("platformMisc.runs.activationLastSent", { date: new Date(activationHistory.last_sent_at).toLocaleString() })}</p>}
                          <p className={activationHistory?.token_valid ? "text-emerald-500" : "text-rose-500"}>
                            {activationHistory?.token_valid
                              ? t("platformMisc.runs.activationLinkValid", { date: activationHistory.token_expires_at ? new Date(activationHistory.token_expires_at).toLocaleString() : "" })
                              : t("platformMisc.runs.activationLinkExpired")}
                          </p>
                        </div>
                      );
                    })}
                    {activationForceResend && eligibleResendActivationIds.length > 5 && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                        +{eligibleResendActivationIds.length - 5} {t("platformMisc.runs.moreRecipients")}
                      </p>
                    )}
                    {selectedIds.length > (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length && (
                      <p className="text-[10px] font-bold text-amber-500">
                        {t("platformMisc.runs.activationIneligible", { count: selectedIds.length - (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length })}
                      </p>
                    )}
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setActivationConfirmOpen(false)} disabled={activationProcessing} className="px-4 py-2 rounded-lg bg-tertiary text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{t("platformMisc.runs.cancel")}</button>
                      <button onClick={runSendActivationMessages} disabled={activationProcessing || (activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds).length === 0} className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide">
                        {t(activationForceResend ? "platformMisc.runs.resendActivationConfirm" : "platformMisc.runs.sendActivationConfirm")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── ACTIVATION SENDING PROGRESS ─── */}
              {activationProcessing && (
                <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)] mx-auto" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                      {t("platformMisc.runs.messageSending")} {activationProgress.done}/{activationProgress.total}
                    </p>
                  </div>
                </div>
              )}

              {/* ─── SEND RESULT CONFIRM (Actions menu → response PDF email) ─── */}
              {resultConfirmOpen && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-3xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">
                      {t("platformMisc.runs.sendResponseConfirmTitle")}
                    </h4>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] leading-relaxed">
                      {t("platformMisc.runs.sendResponseConfirmDesc", { count: eligibleSendResultIds.length })}
                    </p>
                    {selectedIds.length > eligibleSendResultIds.length && (
                      <p className="text-[10px] font-bold text-amber-500">
                        {t("platformMisc.runs.sendResponseIneligible", { count: selectedIds.length - eligibleSendResultIds.length })}
                      </p>
                    )}

                    {/* READ-ONLY PREVIEW — the exact document each recipient receives */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("platformMisc.runs.previewResultRecipient")}
                      </span>
                      {eligibleSendResultIds.length > 1 ? (
                        <select
                          value={resultPreviewId ?? ""}
                          onChange={(event) => setResultPreviewId(parseInt(event.target.value))}
                          className="bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-1.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                        >
                          {eligibleSendResultIds.map((id) => {
                            const submission = submissions.find((candidate) => candidate.id === id);
                            return (
                              <option key={id} value={id}>
                                {submission?.display_name || submission?.submitter_name || `#${id}`}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">
                          {(() => {
                            const submission = submissions.find((candidate) => candidate.id === resultPreviewId);
                            return submission?.display_name || submission?.submitter_name || `#${resultPreviewId}`;
                          })()}
                        </span>
                      )}
                      <span className="text-[9px] font-medium text-[var(--text-tertiary)]">
                        {t("platformMisc.runs.previewResultReadOnly")}
                      </span>
                    </div>

                    <AppPdfPreview
                      requestKey={resultPreviewId}
                      loadPdf={() => fetchResultPdf(resultPreviewId)}
                      title={t("platformMisc.runs.previewResultTitle")}
                      loadingLabel={t("platformMisc.runs.previewResultLoading")}
                      errorLabel={t("platformMisc.runs.previewResultUnavailable")}
                      className="shrink-0"
                    />

                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={closeSendResultConfirm} disabled={resultProcessing} className="px-4 py-2 rounded-lg bg-tertiary text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{t("platformMisc.runs.cancel")}</button>
                      <button onClick={runSendResultEmails} disabled={resultProcessing || eligibleSendResultIds.length === 0} className="px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide">
                        {t("platformMisc.runs.sendResponseConfirm", { count: eligibleSendResultIds.length })}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── SINGLE RESPONSE PREVIEW (response row → read-only result PDF) ─── */}
              {previewSubmission && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-3xl w-full space-y-4 max-h-[92vh] overflow-y-auto">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">
                          {t("platformMisc.runs.previewResultTitle")}
                        </h4>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                          {previewSubmission.display_name || previewSubmission.submitter_name || `#${previewSubmission.id}`}
                          {" · "}
                          {t("platformMisc.runs.previewResultReadOnly")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Re-roll the AI report — when this run has a brief at all
                            (an instruction, an attached document, or both). */}
                        {((runSettings?.output_instruction || "").trim() || reportFile) ? (
                          <button
                            onClick={() => regenerateReport(previewSubmission.id)}
                            disabled={reportRegenerating === previewSubmission.id}
                            title={t("platformMisc.runs.regenerateReportDesc")}
                            className="px-3 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {reportRegenerating === previewSubmission.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RefreshCw className="w-3 h-3" />}
                            {t("platformMisc.runs.regenerateReport")}
                          </button>
                        ) : null}
                        <button
                          onClick={() => setPreviewSubmission(null)}
                          aria-label={t("common.close")}
                          className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <AppPdfPreview
                      requestKey={`${previewSubmission.id}:${previewNonce}`}
                      loadPdf={() => fetchResultPdf(previewSubmission.id)}
                      title={t("platformMisc.runs.previewResultTitle")}
                      loadingLabel={t("platformMisc.runs.previewResultLoading")}
                      errorLabel={t("platformMisc.runs.previewResultUnavailable")}
                    />

                    <div className="flex justify-end">
                      <button onClick={() => setPreviewSubmission(null)} className="px-4 py-2 rounded-lg bg-tertiary text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                        {t("common.close")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── SEND RESULT PROGRESS ─── */}
              {resultProcessing && (
                <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)] mx-auto" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                      {t("platformMisc.runs.sendResponseSending", { done: resultProgress.done, total: resultProgress.total })}
                    </p>
                  </div>
                </div>
              )}

              {/* ─── BULK PROCESSING ─── */}
              {bulkProcessing && (
                <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)] mx-auto" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                      {t("platformMisc.runs.bulkApproving", { done: bulkProgress.done, total: bulkProgress.total })}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {t("platformMisc.runs.bulkApprovingHint")}
                    </p>
                    <button
                      onClick={() => { bulkAbortRef.current = true; }}
                      className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20"
                    >
                      {t("platformMisc.runs.bulkCancelSending")}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── BULK SUMMARY ─── */}
              {bulkSummary && !bulkProcessing && (
                <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-3">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.bulkComplete")}</h4>
                    <p className="text-[10px] font-bold text-emerald-500">{t("platformMisc.runs.bulkApprovedCount", { count: bulkSummary.approved })}</p>
                    {bulkSummary.already_approved > 0 && (
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">{t("platformMisc.runs.bulkAlreadyApproved", { count: bulkSummary.already_approved })}</p>
                    )}
                    {bulkSummary.cancelled > 0 && (
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">{t("platformMisc.runs.bulkCancelledCount", { count: bulkSummary.cancelled })}</p>
                    )}
                    {bulkSummary.failed.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-rose-500">{t("platformMisc.runs.bulkFailedCount", { count: bulkSummary.failed.length })}</p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {bulkSummary.failed.map((failure, index) => (
                            <p key={index} className="text-[10px] font-medium text-[var(--text-secondary)]">• {failure.name || t("platformMisc.runs.bulkFailedFallback")} — {failure.error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => setBulkSummary(null)} className="w-full py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">{t("platformMisc.runs.done")}</button>
                  </div>
                </div>
              )}

              {/* ─── MESSAGE RESULT SUMMARY ─── */}
              {messageSummary && (
                <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
                  <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-3">
                    <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">{messageSummary.title}</h4>
                    <p className="text-[10px] font-bold text-emerald-500">{t("platformMisc.runs.messageSentCount", { count: messageSummary.sent })}</p>
                    {messageSummary.already_sent > 0 && (
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">{t("platformMisc.runs.messageAlreadySentCount", { count: messageSummary.already_sent })}</p>
                    )}
                    {messageSummary.skipped > 0 && (
                      <p className="text-[10px] font-bold text-amber-500">{t("platformMisc.runs.messageSkippedCount", { count: messageSummary.skipped })}</p>
                    )}
                    {messageSummary.failed > 0 && (
                      <p className="text-[10px] font-bold text-rose-500">{t("platformMisc.runs.messageFailedCount", { count: messageSummary.failed })}</p>
                    )}
                    <button onClick={() => setMessageSummary(null)} className="w-full py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-black uppercase">{t("platformMisc.runs.done")}</button>
                  </div>
                </div>
              )}
            </>
  );
}
