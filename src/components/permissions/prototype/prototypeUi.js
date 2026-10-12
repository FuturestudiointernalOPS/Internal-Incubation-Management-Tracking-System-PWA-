/**
 * Permission Centre — the shared presentational kit of the approved prototype.
 *
 * Every screen of the centre (People, Profiles, Rules, Journal) is built from
 * these blocks, so the whole centre reads as one surface: the same table, the
 * same KPI card, the same help note, the same tabs. Pure presentation — no
 * data, no i18n keys of its own (the caller passes translated strings).
 */

import { ACCESS_LEVEL_KEYS } from "../levelChips";

export function PrototypeTable({ children, minWidth = "42rem" }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-1">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function HeadCell({ children }) {
  return (
    <th className="border-b border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
      {children}
    </th>
  );
}

export function Cell({ children, className = "" }) {
  return (
    <td className={`border-b border-[var(--border-secondary)] px-3 py-2.5 text-sm text-[var(--text-primary)] ${className}`}>
      {children}
    </td>
  );
}

/** A clickable table row (the prototype's `tr.cl`). */
export function ClickRow({ onClick, children }) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      {children}
    </tr>
  );
}

/** Empty state inside a table body. */
export function EmptyRow({ colSpan, label }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-[var(--text-secondary)]">
        {label}
      </td>
    </tr>
  );
}

export function Kpi({ value, label }) {
  return (
    <div className="min-w-[7rem] rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-1 px-3.5 py-2.5">
      <b className="block text-xl font-black text-[var(--text-primary)]">{value}</b>
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

export function KpiRow({ children }) {
  return <div className="mb-3 flex flex-wrap gap-2.5">{children}</div>;
}

/** The quiet help note (left accent border) that introduces a screen. */
export function Note({ children }) {
  return (
    <div className="mb-3 rounded-[var(--radius-sm)] border-l-2 border-[var(--brand-orange)] bg-surface-1 px-3 py-2 text-xs text-[var(--text-secondary)]">
      {children}
    </div>
  );
}

export function Toolbar({ children }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2">{children}</div>;
}

/**
 * Tab bar. `items` is `[{key, label}]`, `value` the current key — the caller
 * owns the labels (the centre translates its own).
 */
export function Tabs({ items = [], value, onChange }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-[var(--border-primary)]">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
              active
                ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

const PILL_TONES = {
  neutral: "border-[var(--border-primary)] text-[var(--text-secondary)]",
  accent: "border-[var(--brand-orange)]/40 text-[var(--brand-orange)]",
  ok: "border-emerald-500/40 text-emerald-500",
  warn: "border-amber-500/40 text-amber-500",
  crit: "border-rose-500/40 text-rose-500",
};

/** Small bordered pill — the source labels (Profile / Group / Direct / …). */
export function Pill({ children, tone = "neutral" }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${PILL_TONES[tone] || PILL_TONES.neutral}`}>
      {children}
    </span>
  );
}

/** "View" / "Edit" / … for a stored access level (0 = none). */
export function levelLabel(level, t) {
  return t(ACCESS_LEVEL_KEYS[Number(level) || 0]);
}

/** The three gate cards of the "Why" tab (eligibility → capacity → scope). */
export function Gate({ index, title, state, detail }) {
  const border =
    state === "yes"
      ? "border-emerald-500/60"
      : state === "no"
        ? "border-rose-500/60"
        : "border-[var(--border-primary)] opacity-60";
  const icon = state === "yes" ? "✓" : state === "no" ? "✕" : "—";
  return (
    <div className={`min-w-[10rem] flex-1 rounded-[var(--radius-sm)] border bg-surface-1 p-2.5 ${border}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
        {index} {title}
      </div>
      <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">
        <span className="mr-1">{icon}</span>
        {detail}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block text-xs text-[var(--text-secondary)]">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest">{label}</span>
      {children}
    </label>
  );
}

/** The compact control the centre uses inside toolbars and drawers. */
export const CONTROL_CLASS =
  "rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-surface-1 px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60";
