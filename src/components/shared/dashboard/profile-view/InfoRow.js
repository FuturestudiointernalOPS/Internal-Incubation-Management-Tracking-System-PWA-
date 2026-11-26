"use client";

/** One labelled profile field: an icon + label, then a value or an input. */
export default function InfoRow({ icon: Icon, label, value, editable, onChange }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      {editable ? (
        <input
          defaultValue={value}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg p-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
        />
      ) : (
        <p className="text-[11px] font-bold text-[var(--text-primary)] bg-[var(--surface-2)] rounded-lg p-3 border border-[var(--border-primary)]">
          {value || "—"}
        </p>
      )}
    </div>
  );
}
