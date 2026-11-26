import { Search, RefreshCw, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EMAIL_STATUS_ORDER, EMAIL_STATUS_CONFIG, RETRYABLE_EMAIL_STATUSES, EMAIL_PAGE_SIZE } from "./constants";
import { cn } from "./helpers";

const STATUS_BADGE = {
  sent: "bg-emerald-500/10 text-emerald-500",
  delivered: "bg-emerald-400/10 text-emerald-400",
  opened: "bg-sky-500/10 text-sky-500",
  clicked: "bg-indigo-500/10 text-indigo-500",
  delayed: "bg-amber-500/10 text-amber-500",
  complained: "bg-rose-500/10 text-rose-500",
  failed: "bg-rose-500/10 text-rose-500",
  bounced: "bg-amber-500/10 text-amber-500",
  cancelled: "bg-slate-500/10 text-slate-400",
  skipped: "bg-slate-500/10 text-slate-400",
  pending: "bg-amber-500/10 text-amber-400",
};

// Each email type keeps its own colour chip so approval, report and the rest
// read apart at a glance, and each carries the label used by the filter tabs.
const EMAIL_TYPE_BADGE = {
  acknowledgement: { label: "platformMisc.runs.emailTypeConfirmation", cls: "bg-cyan-500/10 text-cyan-400" },
  approval: { label: "platformMisc.runs.emailTypeApproval", cls: "bg-violet-500/10 text-violet-400" },
  activation: { label: "platformMisc.runs.emailTypeActivation", cls: "bg-purple-500/10 text-purple-400" },
  result: { label: "platformMisc.runs.emailTypeReport", cls: "bg-emerald-500/10 text-emerald-400" },
};

export default function EmailsTab({
  allEmailRows, visibleEmailRows, pagedEmailRows, retryableVisible, retrySelectedSet, emailStatusSets, emailSummary,
  emailTypeFilter, setEmailTypeFilter, emailStatusFilter, setEmailStatusFilter,
  emailSearch, setEmailSearch, emailDateFrom, setEmailDateFrom, emailDateTo, setEmailDateTo, setEmailPage,
  retrySelected, setRetrySelected, retryProcessing, runRetryEmails, toggleRetrySelect,
  safeEmailPage, emailTotalPages, retryProgress, retrySummary, setRetrySummary, retryAbortRef,
}) {
  const { t } = useI18n();
  const allRetryableSelected = retryableVisible.length > 0 && retryableVisible.every((emailRow) => retrySelectedSet.has(`${emailRow.submission_id}:${emailRow.email_type}`));

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Email stats — clickable status filters per category */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { key: "acknowledgement", label: t("platformMisc.runs.emailSummaryConfirmation") },
          { key: "approval", label: t("platformMisc.runs.emailSummaryApproval") },
          { key: "activation", label: t("platformMisc.runs.emailSummaryActivation") },
          { key: "result", label: t("platformMisc.runs.emailSummaryReport") },
        ].map((category) => {
          const categoryTotal = allEmailRows.filter((emailRow) => emailRow.email_type === category.key).length;
          return (
            <div key={category.key} className="rounded-xl border border-[var(--border-primary)] bg-tertiary p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{category.label}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => { setEmailTypeFilter(category.key); setEmailStatusFilter("all"); setEmailPage(1); }}
                  className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase border transition-all",
                    emailTypeFilter === category.key && emailStatusFilter === "all"
                      ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                      : "bg-secondary text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]")}
                >
                  {t("platformMisc.runs.emailStatusAll")} ({categoryTotal})
                </button>
                {EMAIL_STATUS_ORDER.map((statusKey) => {
                  const statusConfig = EMAIL_STATUS_CONFIG[statusKey];
                  const count = emailSummary.stats[category.key][statusKey];
                  const active = emailTypeFilter === category.key && emailStatusFilter === statusKey;
                  return (
                    <button
                      key={statusKey}
                      onClick={() => { setEmailTypeFilter(category.key); setEmailStatusFilter(statusKey); setEmailPage(1); }}
                      className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase border transition-all",
                        active ? "bg-[var(--brand-orange)] text-black border-[var(--brand-orange)]"
                               : "bg-secondary text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]")}
                    >
                      <span className={active ? "text-black" : statusConfig.color}>{count}</span> {t(statusConfig.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Email rows — stats/dropdown/search/date filters + retryable table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category tabs */}
            {[
              { key: "all", label: t("platformMisc.runs.emailTypeAll") },
              { key: "acknowledgement", label: t("platformMisc.runs.emailTypeConfirmation") },
              { key: "approval", label: t("platformMisc.runs.emailTypeApproval") },
              { key: "activation", label: t("platformMisc.runs.emailTypeActivation") },
              { key: "result", label: t("platformMisc.runs.emailTypeReport") },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setEmailTypeFilter(tab.key); setEmailPage(1); }}
                className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                  emailTypeFilter === tab.key
                    ? "bg-[var(--brand-orange)] text-black"
                    : "bg-tertiary text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={emailSearch}
                onChange={(event) => { setEmailSearch(event.target.value); setEmailPage(1); }}
                placeholder={t("platformMisc.runs.emailSearchPlaceholder")}
                className="w-56 pl-9 pr-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)]"
              />
            </div>
            <input
              type="date"
              value={emailDateFrom}
              onChange={(event) => { setEmailDateFrom(event.target.value); setEmailPage(1); }}
              className="px-2 py-1 rounded-lg bg-tertiary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
            />
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runs.emailDateTo")}</span>
            <input
              type="date"
              value={emailDateTo}
              onChange={(event) => { setEmailDateTo(event.target.value); setEmailPage(1); }}
              className="px-2 py-1 rounded-lg bg-tertiary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
            />
            <select
              value={emailStatusFilter}
              onChange={(event) => { setEmailStatusFilter(event.target.value); setEmailPage(1); }}
              className="px-2 py-1 rounded-lg bg-tertiary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="all">{t("platformMisc.runs.emailAllStatuses")}</option>
              {EMAIL_STATUS_ORDER.map((statusKey) => (
                <option key={statusKey} value={statusKey}>{t(EMAIL_STATUS_CONFIG[statusKey].label)}</option>
              ))}
            </select>
            {(emailDateFrom || emailDateTo || emailStatusFilter !== "all" || emailSearch || emailTypeFilter !== "all") && (
              <button
                onClick={() => { setEmailStatusFilter("all"); setEmailDateFrom(""); setEmailDateTo(""); setEmailSearch(""); setEmailTypeFilter("all"); setEmailPage(1); setRetrySelected([]); }}
                className="px-2 py-1 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide border border-[var(--border-primary)] hover:text-[var(--text-primary)]"
              >
                {t("platformMisc.runs.emailResetFilters")}
              </button>
            )}
          </div>
          {retrySelected.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[var(--brand-orange)]">{t("platformMisc.runs.emailSelectedCount", { count: retrySelected.length })}</span>
              <button
                onClick={() => setRetrySelected([])}
                disabled={retryProcessing}
                title={t("platformMisc.runs.emailDeselectTitle")}
                className="px-3 py-1.5 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                {t("platformMisc.runs.cancel")}
              </button>
              <button
                onClick={runRetryEmails}
                disabled={retryProcessing}
                className="px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> {t("platformMisc.runs.emailRetrySelected")}
              </button>
            </div>
          )}
        </div>

        {allEmailRows.length === 0 ? (
          <div className="py-12 text-center bg-secondary rounded-2xl border border-[var(--border-primary)] border-dashed">
            <Mail className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
            <p className="text-sm text-[var(--text-secondary)] mt-3">{t("platformMisc.runs.emailNoEmailsYet")}</p>
          </div>
        ) : visibleEmailRows.length === 0 ? (
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            {emailStatusFilter !== "all"
              ? `${t("platformMisc.runs.emailNoMatchStatus", { label: t(EMAIL_STATUS_CONFIG[emailStatusFilter].label).toLowerCase() })} — ${t("platformMisc.runs.emailNoMatchStatusHint", { label: t(EMAIL_STATUS_CONFIG[emailStatusFilter].label).toLowerCase() })}`
              : t("platformMisc.runs.emailNoneMatchFilter")}
          </p>
        ) : (
          <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
            <table className="w-full text-left">
              <thead className="bg-tertiary">
                <tr className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allRetryableSelected}
                      onChange={() =>
                        setRetrySelected(allRetryableSelected ? [] : retryableVisible.map((emailRow) => `${emailRow.submission_id}:${emailRow.email_type}`))
                      }
                      className="accent-[var(--brand-orange)] w-3.5 h-3.5"
                    />
                  </th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailColRespondent")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailColType")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.colStatus")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailColRecipient")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailSent")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailDelivered")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailOpened")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailClicked")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailColReason")}</th>
                  <th className="px-3 py-3">{t("platformMisc.runs.emailColDate")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {pagedEmailRows.map((emailRow) => {
                  const key = `${emailRow.submission_id}:${emailRow.email_type}`;
                  const isRetryable = RETRYABLE_EMAIL_STATUSES.includes(emailRow.status);
                  const statusSet = emailStatusSets.get(key) || new Set();
                  const had = (status) => statusSet.has(status);
                  const milestoneSent = had("sent") || ["delivered", "opened", "clicked", "delayed", "bounced", "failed", "complained"].some(had);
                  const milestoneDelivered = had("delivered") || had("opened") || had("clicked");
                  const milestoneOpened = had("opened") || had("clicked");
                  const milestoneClicked = had("clicked");
                  return (
                    <tr key={key} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                      <td className="px-4 py-3 w-10">
                        {isRetryable && (
                          <input
                            type="checkbox"
                            checked={retrySelectedSet.has(key)}
                            onChange={() => toggleRetrySelect(key)}
                            className="accent-[var(--brand-orange)] w-3.5 h-3.5"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{emailRow.name}</td>
                      <td className="px-3 py-3">
                        {(() => {
                          const typeBadge = EMAIL_TYPE_BADGE[emailRow.email_type];
                          return (
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap", typeBadge?.cls || "bg-cyan-500/10 text-cyan-400")}>
                              {typeBadge ? t(typeBadge.label) : emailRow.email_type}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", STATUS_BADGE[emailRow.status] || STATUS_BADGE.failed)}>
                          {t(EMAIL_STATUS_CONFIG[emailRow.status]?.label || "platformMisc.runs.emailPending")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] truncate max-w-[180px]" title={emailRow.email}>
                        {emailRow.email || "—"}
                      </td>
                      <td className="px-3 py-3 text-center">{milestoneSent ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                      <td className="px-3 py-3 text-center">{milestoneDelivered ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                      <td className="px-3 py-3 text-center">{milestoneOpened ? <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                      <td className="px-3 py-3 text-center">{milestoneClicked ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 inline" /> : <span className="text-[var(--text-secondary)] opacity-40">—</span>}</td>
                      <td className="px-3 py-3 text-[10px] text-rose-400 max-w-[260px] truncate" title={emailRow.error || "Unknown reason"}>
                        {emailRow.error || "Unknown reason"}
                      </td>
                      <td className="px-3 py-3 text-[10px] text-[var(--text-secondary)] whitespace-nowrap">
                        {emailRow.sent_at ? new Date(emailRow.sent_at).toLocaleDateString() : (emailRow.created_at ? new Date(emailRow.created_at).toLocaleDateString() : "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">
              {t("platformMisc.runs.emailShowingRange", { start: (safeEmailPage - 1) * EMAIL_PAGE_SIZE + 1, end: Math.min(safeEmailPage * EMAIL_PAGE_SIZE, visibleEmailRows.length), total: visibleEmailRows.length })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEmailPage(safeEmailPage - 1)}
                disabled={safeEmailPage <= 1}
                className="px-3 py-1.5 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide border border-[var(--border-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                {t("platformMisc.runs.emailPagePrev")}
              </button>
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">{safeEmailPage} / {emailTotalPages}</span>
              <button
                onClick={() => setEmailPage(safeEmailPage + 1)}
                disabled={safeEmailPage >= emailTotalPages}
                className="px-3 py-1.5 rounded-lg bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide border border-[var(--border-primary)] hover:text-[var(--text-primary)] disabled:opacity-40"
              >
                {t("platformMisc.runs.emailPageNext")}
              </button>
            </div>
          </div>
          </>
        )}
      </div>
      {/* ─── RETRY PROCESSING ─── */}
      {retryProcessing && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-sm w-full text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)] mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
              Retrying {retryProgress.done} of {retryProgress.total} emails...
            </p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">
              Already-sent emails are kept. Stopping leaves the remaining rows unchanged — select them again later.
            </p>
            <button
              onClick={() => { retryAbortRef.current = true; }}
              className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20"
            >
              Cancel Sending
            </button>
          </div>
        </div>
      )}

      {/* ─── RETRY SUMMARY ─── */}
      {retrySummary && !retryProcessing && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 max-w-md w-full space-y-3">
            <h4 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.emailRetryComplete")}</h4>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">
              {t("platformMisc.runs.emailRetryCount", { count: retrySummary.retried })}
            </p>
            <p className="text-[10px] font-bold text-emerald-500">{t("platformMisc.runs.emailRetrySent", { count: retrySummary.sent })}</p>
            {retrySummary.already_sent > 0 && (
              <p className="text-[10px] font-bold text-[var(--text-secondary)]">{t("platformMisc.runs.emailRetryAlready", { count: retrySummary.already_sent })}</p>
            )}
            {retrySummary.cancelled > 0 && (
              <p className="text-[10px] font-bold text-[var(--text-secondary)]">{t("platformMisc.runs.bulkCancelledCount", { count: retrySummary.cancelled })}</p>
            )}
            {retrySummary.failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-rose-500">{t("platformMisc.runs.emailRetryFailedCount", { count: retrySummary.failed.length })}</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {retrySummary.failed.map((failure, index) => (
                    <p key={index} className="text-[10px] font-medium text-[var(--text-secondary)]">• {failure.name || t("platformMisc.runs.emailFallback")} — {failure.error}</p>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setRetrySummary(null)} className="w-full py-2 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide">{t("platformMisc.runs.done")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
