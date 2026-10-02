"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

/**
 * Review inbox of an open milestone: what the Venture submitted for the
 * tasks of this milestone, with the review decisions.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function MilestoneReviewInbox({
  decideSubmission,
  milestone,
  milestoneSubmissions,
  setSubmissionComment,
  setSubmissionReview,
  submissionComment,
  submissionReview,
  submissionsBusy,
}) {
  const { t } = useI18n();
  return (
    <div className="mt-2 ml-5 space-y-1.5">
      <p className="text-[8px] font-black uppercase tracking-widest text-amber-400">
        {t("venture.manager.submissionsToReview", { n: (milestoneSubmissions[milestone.id] || []).length })}
      </p>
      {(milestoneSubmissions[milestone.id] || []).map((item) => (
        <div key={item.submission_id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="flex-1 min-w-0 text-[11px] font-bold text-[var(--text-primary)] truncate">{item.task_title}</p>
            <span className="text-[9px] text-slate-500 shrink-0">
              v{item.version} · {item.submitted_by_name || t("venture.manager.theVenture")} · {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
          {item.notes && <p className="text-[10px] text-slate-400">{item.notes}</p>}
          {item.file_url && (
            <a href={item.file_url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-sky-300 hover:underline">
              {item.file_name || t("venture.manager.viewSubmission")}
            </a>
          )}
          {submissionReview?.submission_id === item.submission_id ? (
            <div className="space-y-1.5">
              <textarea
                value={submissionComment}
                onChange={(event) => setSubmissionComment(event.target.value)}
                rows={2}
                placeholder={t("venture.manager.reviewCommentsPlaceholder")}
                className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setSubmissionReview(null); setSubmissionComment(""); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                  {t("common.cancel")}
                </button>
                <button type="button" disabled={submissionsBusy === item.submission_id || !submissionComment.trim()} onClick={() => decideSubmission(milestone.id, item, "changes_requested", submissionComment)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 disabled:opacity-50">
                  {t("venture.manager.requestChanges")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" disabled={submissionsBusy === item.submission_id} onClick={() => decideSubmission(milestone.id, item, "approved")} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 disabled:opacity-50">
                {t("venture.manager.approveDeliverable")}
              </button>
              <button type="button" disabled={submissionsBusy === item.submission_id} onClick={() => { setSubmissionReview({ submission_id: item.submission_id, task_id: item.task_id }); setSubmissionComment(""); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 disabled:opacity-50">
                {t("venture.manager.requestChanges")}
              </button>
              {submissionsBusy === item.submission_id && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
