import { ClipboardCheck, Eye, FileText, History, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import AppMenu from "@/components/ui/AppMenu";
import {
  ACCOUNT_STATUS_STYLES, EMAIL_STATUS_CONFIG, PAYMENT_ACCESS_LABELS,
  PAYMENT_EMAIL_LABELS, PAYMENT_STATUS_STYLES, SUB_STATUS,
} from "./constants";
import { cn } from "./helpers";
import SubmissionTimeline from "./SubmissionTimeline";

export default function OverviewResponsesTable({ ctx }) {
  const { t } = useI18n();
  const router = useRouter();
  const { allFilteredSelected, duplicateEmailSet, duplicateGroups, emailLog, evaluatedSubmissionIds, evaluations, handleDeleteSubmission, onEditRespondentEmail, openReview, pagedSubmissions, paymentsBySubmission, perPage, respSafePage, respTotalPages, reviews, selectedSet, selectedSubmission, setPreviewSubmission, setRespPage, setSelectedSubmission, subLoading, toggleSelect, toggleSelectAllFiltered } = ctx;
  return (
    <>
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
                        <th className="px-4 py-3">{t("platformMisc.runs.statusSubmitted")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colAiScore")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colApprovalEmail")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colResultEmail")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.review")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colStatus")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colActivationEmail")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colAccountStatus")}</th>
                        <th className="px-4 py-3">{t("platformMisc.runs.colPayment")}</th>
                        <th className="px-4 py-3 text-right">{t("platformMisc.runs.colActions")}</th>
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
                        // The result/report email — the message that carries the
                        // personalised report. Its absence means nothing went out.
                        const resultEmail = emailLog
                          .filter((emailRow) => emailRow.submission_id === submission.id && emailRow.email_type === "result")
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
                            <td className="px-4 py-3">
                              {resultEmail ? (
                                (() => {
                                  const resultStatusConfig = EMAIL_STATUS_CONFIG[resultEmail.status] || { color: "text-amber-500", bg: "bg-amber-500/10", label: "platformMisc.runs.emailPending" };
                                  return (
                                    <span title={resultEmail.error || t(resultStatusConfig.label)} className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", resultStatusConfig.bg, resultStatusConfig.color)}>
                                      {t(resultStatusConfig.label)}
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
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end">
                                <AppMenu
                                  label={t("platformMisc.runs.colActions")}
                                  align="right"
                                  items={[
                                    { key: "history", label: t("platformMisc.runs.history"), icon: History, onSelect: () => setSelectedSubmission(selectedSubmission?.id === submission.id ? null : submission) },
                                    { key: "full", label: t("platformMisc.runs.full"), icon: Eye, onSelect: () => router.push(`/platform/runs/review/${submission.id}`) },
                                    submission.status !== "draft" && evaluatedSubmissionIds.has(submission.id)
                                      ? { key: "preview", label: t("platformMisc.runs.previewResult"), icon: FileText, onSelect: () => setPreviewSubmission(submission) }
                                      : null,
                                    submission.status === "submitted"
                                      ? { key: "review", label: t("platformMisc.runs.review"), icon: ClipboardCheck, onSelect: () => openReview(submission) }
                                      : null,
                                    { key: "edit-email", label: t("platformMisc.runs.editEmail"), icon: Pencil, onSelect: () => onEditRespondentEmail(submission) },
                                    { key: "delete", label: t("platformMisc.runs.delete"), icon: Trash2, danger: true, separator: true, onSelect: () => handleDeleteSubmission(submission.id) },
                                  ].filter(Boolean)}
                                />
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
    </>
  );
}
