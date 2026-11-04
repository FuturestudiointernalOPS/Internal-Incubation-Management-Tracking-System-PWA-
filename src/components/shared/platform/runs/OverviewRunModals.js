import { Loader2, RefreshCw, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppPdfPreview from "@/components/ui/AppPdfPreview";
import { cn, fetchResultPdf } from "./helpers";

export default function OverviewRunModals({ ctx }) {
  const { t } = useI18n();
  const { activationConfirmOpen, activationForceResend, activationProcessing, activationProgress, allSelectedEvaluated, bulkAbortRef, bulkConfirmOpen, bulkIncludeResultPdf, bulkProcessing, bulkProgress, bulkSummary, closeSendResultConfirm, eligibleResendActivationIds, eligibleSendActivationIds, eligibleSendResultIds, messageSummary, previewNonce, previewSubmission, regenerateReport, reportFile, reportRegenerating, resultConfirmOpen, resultPreviewId, resultProcessing, resultProgress, runBulkApprove, runSendActivationMessages, runSendResultEmails, runSettings, selectedIds, setActivationConfirmOpen, setBulkConfirmOpen, setBulkIncludeResultPdf, setBulkSummary, setMessageSummary, setPreviewSubmission, setResultPreviewId, submissions } = ctx;
  return (
    <>
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
