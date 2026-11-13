import {
  ArrowLeft, Play, StopCircle, XCircle, Archive, RotateCcw, Trash2,
  RefreshCw, Plus, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "./helpers";
import { STATUS_CONFIG } from "./constants";

export default function RunDetailHeader({
  selectedRun, groups, onBack, handleLaunch, handleStatusChange, handleDeleteRun,
  openManualAdd, evalProgress, canReview, handleBatchEvaluate, t,
}) {
  const statusConfig = STATUS_CONFIG[selectedRun.status] || STATUS_CONFIG.draft;
  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-[var(--border-primary)] bg-secondary shrink-0">
      <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft className="w-3 h-3 inline mr-1" /> {t("platformMisc.runs.back")}</button>
      <span className="text-[var(--text-secondary)] opacity-30">|</span>
      <Play className="w-4 h-4 text-[var(--brand-orange)]" />
      <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{selectedRun.name}</h2>
      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", statusConfig.color, statusConfig.bg)}>{t(statusConfig.label)}</span>
      {(() => {
        const group = groups.find((candidate) => (candidate.registration_id || candidate.id) === selectedRun.group_target_id);
        return group ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap text-[var(--brand-orange)] bg-brand-orange/10 border border-brand-orange/30">{t("platformMisc.runs.assignedGroup", { name: group.name })}</span>
        ) : null;
      })()}
      {/* Status action buttons */}
      {selectedRun.status === "draft" && (
        <button onClick={() => handleLaunch(selectedRun.id)} className="px-3 py-1.5 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110">{t("platformMisc.runs.launch")}</button>
      )}
      {selectedRun.status === "active" && (
        <button onClick={() => handleStatusChange(selectedRun.id, "closed")} className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-amber-500/20 flex items-center gap-1"><StopCircle className="w-3 h-3" /> {t("platformMisc.runs.close")}</button>
      )}
      {(selectedRun.status === "active" || selectedRun.status === "closed") && (
        <button onClick={() => handleStatusChange(selectedRun.id, "cancelled")} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20 flex items-center gap-1"><XCircle className="w-3 h-3" /> {t("platformMisc.runs.cancel")}</button>
      )}
      {(selectedRun.status === "closed" || selectedRun.status === "cancelled") && (
        <button onClick={() => handleStatusChange(selectedRun.id, "archived")} className="px-3 py-1.5 rounded-xl bg-slate-500/10 text-slate-500 border border-slate-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-slate-500/20 flex items-center gap-1"><Archive className="w-3 h-3" /> {t("platformMisc.runs.archive")}</button>
      )}
      {selectedRun.status === "archived" && (
        <>
          <button onClick={() => handleStatusChange(selectedRun.id, "draft")} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500/20 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {t("platformMisc.runs.restore")}</button>
          <button onClick={() => handleDeleteRun(selectedRun.id)} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20 flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t("platformMisc.runs.delete")}</button>
        </>
      )}
      {selectedRun.status !== "archived" && (
        <button onClick={() => handleDeleteRun(selectedRun.id)} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20 flex items-center gap-1"><Trash2 className="w-3 h-3" /> {t("platformMisc.runs.delete")}</button>
      )}
      {(selectedRun.status === "closed" || selectedRun.status === "cancelled") && (
        <button onClick={() => handleStatusChange(selectedRun.id, "active")} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500/20 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> {t("platformMisc.runs.reactivate")}</button>
      )}
      <button onClick={openManualAdd} className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-blue-500/20 flex items-center gap-1"><Plus className="w-3 h-3" /> {t("platformMisc.runs.addRespondent")}</button>
      {selectedRun.status === "active" && (
        <div className="ml-auto flex items-center gap-2">
          {evalProgress?.running ? (
            <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold uppercase flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {evalProgress.evaluated}/{evalProgress.total} — {evalProgress.percent}%
            </span>
          ) : (
            <>
              {canReview && evalProgress && evalProgress.failed > 0 && (
                <button onClick={() => handleBatchEvaluate(true)} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> {t("platformMisc.runs.retryFailed", { count: evalProgress.failed })}
                </button>
              )}
              {canReview && (
              <button
                onClick={() => handleBatchEvaluate(false)}
                className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wide hover:bg-purple-500/20 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {evalProgress && evalProgress.remaining > 0 && !evalProgress.stopped
                  ? t("platformMisc.runs.continueEvaluation")
                  : evalProgress && evalProgress.remaining > 0
                  ? t("platformMisc.runs.continueEvaluation")
                  : t("platformMisc.runs.evaluateAll")}
              </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
