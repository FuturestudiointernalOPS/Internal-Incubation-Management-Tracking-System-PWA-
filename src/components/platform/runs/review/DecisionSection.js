"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/components/admin/dashboard-page/constants";

const DECISION_LABEL_KEYS = {
  approved: "platformMisc.runReview.decisionApprove",
  rejected: "platformMisc.runReview.decisionReject",
  revision_requested: "platformMisc.runReview.decisionRevision",
};

export default function DecisionSection({
  isReviewLocked,
  reviewData,
  setReviewData,
  workflow,
  statusLabel,
  statusColor,
  saving,
  onSubmit,
  decisionLabel,
  t,
}) {
  return (
    <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-[var(--brand-orange)]" />
        <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runReview.decisionTitle")}</h2>
      </div>
      <div className="px-6 py-4 space-y-4">
        {isReviewLocked ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-500/5 border border-slate-500/20">
            <Lock className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)] uppercase">{t("platformMisc.runReview.decisionLocked")}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {t("platformMisc.runReview.decisionLockedPart1")}{" "}
                <strong className={statusColor}>{statusLabel}</strong>{" "}
                {t("platformMisc.runReview.decisionLockedPart2")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              {workflow.decisions.map(decision => (
                <button key={decision.id} onClick={() => setReviewData({ ...reviewData, decision: decision.id })}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide border transition-all text-center",
                    reviewData.decision === decision.id
                      ? `bg-${decision.color}-500/10 border-${decision.color}-500 text-${decision.color}-400`
                      : "bg-tertiary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]"
                  )}>
                  {t(DECISION_LABEL_KEYS[decision.id] || "") || decision.label}
                </button>
              ))}
            </div>
            <textarea value={reviewData.comment} onChange={event => setReviewData({ ...reviewData, comment: event.target.value })} rows={2}
              placeholder={t("platformMisc.runReview.commentPlaceholder")}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
            <textarea value={reviewData.internal_note} onChange={event => setReviewData({ ...reviewData, internal_note: event.target.value })} rows={2}
              placeholder={t("platformMisc.runReview.internalNotePlaceholder")}
              className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
            <button onClick={onSubmit} disabled={saving}
              className="w-full py-3 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 transition-all">
              {saving ? t("platformMisc.runReview.saving") : t("platformMisc.runReview.submitReview", { decision: decisionLabel })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
