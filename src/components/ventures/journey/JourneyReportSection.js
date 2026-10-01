"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

/**
 * The report a journey is owed: its reports (progress / closing), the
 * missing-closing-report gap, and the report composer.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneyReportSection({
  autoGrow,
  closingMissing,
  openReportComposer,
  reportFor,
  reportForm,
  reportOpenId,
  reportSaving,
  reportStatusLabel,
  reportsByStage,
  saveReport,
  setReportFor,
  setReportForm,
  setReportOpenId,
  stage,
}) {
  const { lang, t } = useI18n();
  return (
    <div className="px-4 pb-3">
      <div className="rounded-xl border border-[var(--border-primary)] p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {t("venture.manager.journeyReport")}
          </p>
            <div className="flex flex-wrap items-center gap-2">
              {(reportsByStage[String(stage.id)] || []).map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setReportOpenId(reportOpenId === report.id ? null : report.id)}
                  className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded transition-colors ${reportOpenId === report.id ? "bg-brand-orange/20 text-[var(--brand-orange)]" : "bg-white/10 text-slate-400 hover:text-[var(--text-primary)]"}`}
                >
                  {report.report_kind === "closing" ? t("venture.manager.closingReport") : t("venture.manager.progressReport")} · {reportStatusLabel(report.status)}
                </button>
              ))}
              {reportFor !== stage.id && (
                <button
                  type="button"
                  onClick={() => openReportComposer(stage, closingMissing ? "closing" : "progress")}
                  className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]"
                >
                  {closingMissing ? t("venture.manager.writeClosingReport") : t("venture.manager.writeReport")}
                </button>
              )}
            </div>
          </div>

          {/* The gap, visible in place: a journey that closed without its
              closing report says so, and the button above writes that
              report. Nothing is blocked; the omission is simply not silent. */}
          {closingMissing && (
            <p className="text-[10px] text-amber-400">{t("venture.manager.closingReportMissing")}</p>
          )}

          {/* Reading a report — what Super Admin comes here for. */}
          {(reportsByStage[String(stage.id)] || [])
            .filter((report) => report.id === reportOpenId)
            .map((report) => (
              <div key={`read-${report.id}`} className="rounded-lg border border-[var(--border-primary)] p-2.5 space-y-1.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-[var(--text-primary)]">{report.title}</p>
                  {report.reporting_period && (
                    <span className="text-[9px] uppercase tracking-widest text-slate-500">
                      {t("venture.manager.reportPeriodLabel")}: {report.reporting_period}
                    </span>
                  )}
                </div>
                {report.summary && <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{report.summary}</p>}
                {[
                  ["completed_items", "reportCompleted"],
                  ["outstanding_items", "reportOutstanding"],
                ].map(([field, key]) =>
                  Array.isArray(report[field]) && report[field].length > 0 ? (
                    <div key={field}>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">{t(`venture.manager.${key}`)}</p>
                      <ul className="list-disc pl-4 text-[var(--text-secondary)]">
                        {report[field].map((item, index) => (<li key={index}>{item}</li>))}
                      </ul>
                    </div>
                  ) : null,
                )}
                {[
                  ["support_delivered", "reportSupport"],
                  ["challenges", "reportChallenges"],
                  ["recommendation", "reportRecommendation"],
                ].map(([field, key]) =>
                  report[field] ? (
                    <div key={field}>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">{t(`venture.manager.${key}`)}</p>
                      <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{report[field]}</p>
                    </div>
                  ) : null,
                )}
                {report.submitted_at && (
                  <p className="text-[9px] text-slate-500">
                    {t("venture.manager.reportSubmittedOn", { date: new Date(report.submitted_at).toLocaleDateString(lang) })}
                  </p>
                )}
              </div>
            ))}

        {reportFor === stage.id && reportForm && (
          <form onSubmit={(event) => { event.preventDefault(); saveReport(stage, false); }} className="space-y-2">
            {reportForm.kind === "closing" && (
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
                {t("venture.manager.closingReport")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                value={reportForm.title}
                onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })}
                required
                placeholder={t("venture.manager.reportTitlePlaceholder")}
                className="flex-1 min-w-[180px] px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <input
                value={reportForm.period}
                onChange={(event) => setReportForm({ ...reportForm, period: event.target.value })}
                placeholder={t("venture.manager.reportPeriodPlaceholder")}
                className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
            </div>
            {[
              ["summary", "reportSummary"],
              ["completed", "reportCompleted"],
              ["outstanding", "reportOutstanding"],
              ["support", "reportSupport"],
              ["challenges", "reportChallenges"],
              ["recommendation", "reportRecommendation"],
            ].map(([field, key]) => (
              <label key={field} className="block space-y-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                  {t(`venture.manager.${key}`)}
                </span>
                <textarea
                  value={reportForm[field]}
                  onChange={(event) => setReportForm({ ...reportForm, [field]: event.target.value })}
                  onInput={autoGrow}
                  rows={2}
                  placeholder={field === "completed" || field === "outstanding" ? t("venture.manager.reportOnePerLine") : undefined}
                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)] resize-none overflow-hidden min-h-[44px]"
                />
              </label>
            ))}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { setReportFor(null); setReportForm(null); }}
                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={reportSaving}
                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border border-[var(--border-primary)] text-[var(--text-primary)] disabled:opacity-50"
              >
                {t("venture.manager.saveDraft")}
              </button>
              <button
                type="button"
                disabled={reportSaving}
                onClick={() => saveReport(stage, true)}
                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-[var(--brand-orange)] text-black disabled:opacity-50"
              >
                {t("venture.manager.submitReport")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
