"use client";

import { Clock } from "lucide-react";

/**
 * Scheduled-send control — "send the report X hours Y minutes after the
 * submission".
 *
 * The value is ONE number of MINUTES (0 or absent = send by hand). Keeping a
 * single canonical number is what lets the run → form resolution stay a plain
 * comparison; the two inputs are only a friendlier way to enter it, and they
 * are split for display so "90" never has to be read as "1 h 30 min".
 *
 * The switch mirrors the app's other toggles. All wording comes from the caller
 * so each screen keeps its own translation keys.
 */
export default function ResultDelayEditor({
  title,
  description,
  hoursLabel,
  minutesLabel,
  afterLabel = null,
  footnote = null,
  value,
  onChange,
  defaultMinutes = 2880,
  icon: Icon = Clock,
}) {
  const totalMinutes =
    value === undefined || value === null || value === ""
      ? 0
      : Math.max(0, Math.floor(Number(value) || 0));
  const enabled = totalMinutes > 0;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  // Hours are free-form; minutes wrap at 59 so the two fields always mean what
  // they show (90 minutes typed here is "1 h 30 min", never "0 h 90 min").
  const apply = (nextHours, nextMinutes) =>
    onChange(Math.max(0, Math.floor(nextHours)) * 60 + Math.min(59, Math.max(0, Math.floor(nextMinutes))));

  return (
    <div className="space-y-2 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-cyan-400" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">{title}</p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange(enabled ? 0 : totalMinutes > 0 ? totalMinutes : defaultMinutes)}
          className={`ml-auto w-10 h-6 rounded-full transition-colors relative ${enabled ? "bg-[var(--brand-orange)]" : "bg-[var(--surface-3)] border border-[var(--border-primary)]"}`}
        >
          <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${enabled ? "left-5" : "left-1"}`} />
        </button>
      </div>
      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{description}</p>
      {enabled && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            min="0"
            value={hours}
            onChange={(event) => apply(parseInt(event.target.value, 10) || 0, minutes)}
            className="w-20 px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{hoursLabel}</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(event) => apply(hours, parseInt(event.target.value, 10) || 0)}
            className="w-20 px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
          />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{minutesLabel}</span>
          {afterLabel && <span className="text-[10px] font-medium text-[var(--text-secondary)]">{afterLabel}</span>}
        </div>
      )}
      {footnote && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{footnote}</p>}
    </div>
  );
}
