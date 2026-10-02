"use client";

/**
 * The same compact result tile as OperationsView's `Stat` — the Operations
 * screen uses this small variant rather than ui/StatCard so a row of four still
 * fits the section.
 */
export default function Stat({ label, value, tone = "neutral" }) {
  const toneClass =
    tone === "warn"
      ? "text-amber-400"
      : tone === "good"
        ? "text-[var(--brand-orange)]"
        : "text-[var(--text-primary)]";
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
