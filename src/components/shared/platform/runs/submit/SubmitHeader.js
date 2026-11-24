"use client";

import { ArrowLeft, FileText } from "lucide-react";

export default function SubmitHeader({
  t,
  form,
  goBack,
  isDraft,
  isSubmitted,
  isApproved,
  isRejected,
  needsRevision,
}) {
  return (
    <div className="sticky top-0 z-30 bg-secondary border-b border-[var(--border-primary)]">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> {t("platformMisc.runSubmitDetail.back")}
          </button>
          <span className="text-[var(--text-secondary)] opacity-30">|</span>
          <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
          <h1 className="text-sm font-black uppercase text-[var(--text-primary)]">{form?.name || t("platformMisc.runSubmitDetail.formTitle")}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-500 text-[10px] font-bold uppercase">{t("platformMisc.runSubmitDetail.badgeDraft")}</span>}
          {isSubmitted && <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase">{t("platformMisc.runSubmitDetail.badgeSubmitted")}</span>}
          {isApproved && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">{t("platformMisc.runSubmitDetail.badgeApproved")}</span>}
          {isRejected && <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase">{t("platformMisc.runSubmitDetail.badgeRejected")}</span>}
          {needsRevision && <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase">{t("platformMisc.runSubmitDetail.badgeRevision")}</span>}
        </div>
      </div>
    </div>
  );
}
