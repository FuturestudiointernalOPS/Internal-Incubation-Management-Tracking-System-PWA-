"use client";

/**
 * A labelled optional free-text field of the weekly review form.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function ReviewField({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        placeholder="Optional…"
        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
      />
    </div>
  );
}
