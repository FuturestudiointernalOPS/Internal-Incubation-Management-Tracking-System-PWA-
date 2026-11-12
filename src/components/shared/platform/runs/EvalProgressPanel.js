import { Loader2, PauseCircle } from "lucide-react";

export default function EvalProgressPanel({ evalProgress, evalStats, t }) {
  if (!evalProgress || !(evalProgress.running || evalProgress.stopped)) return null;
  return (
    <div className="px-6 py-3 border-b border-purple-500/20 bg-purple-500/5 shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {evalProgress.running ? (
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
          ) : (
            <PauseCircle className="w-4 h-4 text-purple-400" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
            {evalProgress.running ? t("platformMisc.runs.aiEvalInProgress") : t("platformMisc.runs.aiEvalPaused")}
          </span>
        </div>
        <span className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("platformMisc.runs.evalProgressCount", { evaluated: evalProgress.evaluated, total: evalProgress.total })}
        </span>
        <span className="text-[10px] font-bold text-[var(--text-secondary)]">
          {t("platformMisc.runs.evalPercentComplete", { percent: evalProgress.percent })}
        </span>
        {evalProgress.batch > 0 && (
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("platformMisc.runs.batchCount", { batch: evalProgress.batch })}
          </span>
        )}
        {evalProgress.failed > 0 && (
          <span className="text-[10px] font-bold text-rose-500">
            {t("platformMisc.runs.failedCount", { failed: evalProgress.failed })}
          </span>
        )}
        {evalProgress.remaining > 0 && (
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("platformMisc.runs.remainingCount", { remaining: evalProgress.remaining })}
          </span>
        )}
      </div>
      {/* Progress bar */}
      <div className="mt-2 w-full bg-[var(--border-primary)] rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-purple-500 rounded-full transition-all duration-300"
          style={{ width: `${evalProgress.percent}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
        {evalProgress.running
          ? t("platformMisc.runs.evalKeepOpen")
          : t("platformMisc.runs.evalPausedHint")}
      </p>

      {/* Approval + email dashboard */}
      {evalStats && (
        <div className="mt-3 pt-3 border-t border-purple-500/20 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-sm font-black text-emerald-500">{evalStats.approvals?.approved ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.statusApproved")}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-rose-500">{evalStats.approvals?.rejected ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.statusRejected")}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-blue-500">{evalStats.emails?.sent ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.emailsSent")}</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-black ${(evalStats.emails?.failed ?? 0) > 0 ? "text-rose-500" : "text-[var(--text-secondary)]"}`}>{evalStats.emails?.failed ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.emailsFailed")}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-[var(--brand-orange)]">{evalStats.emails?.activation_sent ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.activationSent")}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-black text-emerald-500">{evalStats.emails?.approval_sent ?? 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.approvalEmails")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
