export default function ReadinessGauge({ readiness, t }) {
  const readinessState = () => {
    if (!readiness) return null;
    if (readiness.is_ready) return { label: t("vadmin.verification.ready"), cls: "text-emerald-400 bg-emerald-500/10" };
    if (readiness.readiness_percent != null) {
      return {
        label: `${t("vadmin.verification.notReady")} · ${readiness.readiness_percent}%`,
        cls: "text-rose-400 bg-rose-500/10",
      };
    }
    return { label: t("vadmin.verification.readinessUndefined"), cls: "text-slate-400 bg-slate-500/10" };
  };

  if (!readiness) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{t("vadmin.verification.readiness")}</h3>
        {(() => { const state = readinessState(); return state ? (
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded ${state.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" /> {state.label}
          </span>
        ) : null; })()}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="min-w-[120px]">
          <p className="text-4xl font-black tracking-tighter text-[var(--brand-orange)]">
            {readiness.readiness_percent != null ? readiness.readiness_percent : "—"}
            {readiness.readiness_percent != null && <span className="text-base font-bold text-[var(--text-tertiary)]">%</span>}
          </p>
          <p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide">
            {t("vadmin.verification.ventureReadiness")}
          </p>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
              style={{ width: `${Math.min(100, readiness.readiness_percent ?? 0)}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">✓ {readiness.verified_count}</span>
          <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded">✕ {readiness.rejected_count}</span>
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">◷ {readiness.pending_count}</span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-500/10 px-2 py-1 rounded">… {readiness.missing_count}</span>
        </div>
      </div>
    </div>
  );
}
