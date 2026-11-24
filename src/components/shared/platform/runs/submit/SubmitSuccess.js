"use client";

import { CheckCircle2 } from "lucide-react";

export default function SubmitSuccess({ t, run, submission, router }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-lg font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runSubmitDetail.successTitle")}</h1>
          <p className="text-[11px] text-[var(--text-secondary)] mt-2">
            {run?.settings?.confirmation_message || t("platformMisc.runSubmitDetail.confirmationMessage")}
          </p>
        </div>
        {submission && (
          <div className="p-4 rounded-xl bg-secondary border border-[var(--border-primary)] text-left space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runSubmitDetail.submissionDetails")}</p>
            <p className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runSubmitDetail.status")}: <span className="text-[var(--brand-orange)]">{submission.status?.toUpperCase()}</span></p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runSubmitDetail.submittedOn", { date: new Date(submission.submitted_at || submission.updated_at).toLocaleString() })}</p>
          </div>
        )}
        <button onClick={() => router.push("/platform/runs/submit")} className="px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110">
          {t("platformMisc.runSubmitDetail.backToSubmissions")}
        </button>
      </div>
    </div>
  );
}
