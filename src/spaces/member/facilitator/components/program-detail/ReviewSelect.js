"use client";

/**
 * A labelled select of the weekly review form.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function ReviewSelect({ label, value, onChange, options, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] cursor-pointer text-[var(--text-primary)]"
      >
        <option value="">{placeholder || "Select…"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
