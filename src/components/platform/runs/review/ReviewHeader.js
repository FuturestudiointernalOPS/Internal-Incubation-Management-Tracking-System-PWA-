"use client";

import { ArrowLeft, Lock, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/components/admin/dashboard-page/constants";

export default function ReviewHeader({
  goBack,
  submission,
  evaluation,
  computedOverall,
  t,
  canReview,
  saving,
  isReviewLocked,
  onReRunAI,
  statusLabel,
  statusColor,
}) {
  return (
    <div className="sticky top-0 z-[100] flex items-center gap-4 px-6 py-3 border-b border-[var(--border-primary)] bg-secondary">
      <button onClick={goBack} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><ArrowLeft className="w-3 h-3 inline mr-1" /> {t("platformMisc.runReview.back")}</button>
      <span className="text-[var(--text-secondary)] opacity-20">|</span>
      <h2 className="text-sm font-black uppercase text-[var(--text-primary)] truncate">{submission?.submitter_name || t("platformMisc.runReview.reviewTitle")}</h2>
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", statusColor)}>{statusLabel}</span>
      {isReviewLocked && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 text-[10px] font-bold uppercase border border-slate-500/20">
          <Lock className="w-2.5 h-2.5" /> {t("platformMisc.runReview.locked")}
        </span>
      )}
      <div className="flex-1" />
      {evaluation && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="text-xs font-black text-purple-400">{computedOverall ?? evaluation.overall_score}%</span>
          {computedOverall !== null && computedOverall !== evaluation.overall_score && (
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runReview.adjusted")}</span>
          )}
        </div>
      )}
      {canReview && (
      <button onClick={onReRunAI} disabled={saving || isReviewLocked} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wide hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
        <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} /> {evaluation ? t("platformMisc.runReview.rerunAi") : t("platformMisc.runReview.runAi")}
      </button>
      )}
    </div>
  );
}
