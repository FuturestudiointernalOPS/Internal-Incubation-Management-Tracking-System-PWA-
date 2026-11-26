"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function SubmissionNotices({
  t,
  isSubmitted,
  needsRevision,
  isApproved,
  isRejected,
  submission,
}) {
  return (
    <>
      {isSubmitted && !needsRevision && (
        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">{t("platformMisc.runSubmitDetail.alreadySubmitted")}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {t("platformMisc.runSubmitDetail.submittedNotice", { date: new Date(submission.submitted_at || submission.updated_at).toLocaleString() })}
              {isApproved && ` ${t("platformMisc.runSubmitDetail.approvedNotice")}`}
              {isRejected && ` ${t("platformMisc.runSubmitDetail.rejectedNotice")}`}
            </p>
          </div>
        </div>
      )}

      {needsRevision && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">{t("platformMisc.runSubmitDetail.revisionTitle")}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              {t("platformMisc.runSubmitDetail.revisionNotice")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
