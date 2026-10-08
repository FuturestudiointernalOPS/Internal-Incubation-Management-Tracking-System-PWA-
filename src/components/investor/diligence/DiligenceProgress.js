"use client";

/**
 * The request-completion progress bar.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function DiligenceProgress({ progress, completedReqs, totalRequests }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Progress</span>
        <span className="text-xs font-bold text-[var(--brand-orange)]">{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--brand-orange)] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{completedReqs}/{totalRequests} items resolved</p>
    </div>
  );
}
