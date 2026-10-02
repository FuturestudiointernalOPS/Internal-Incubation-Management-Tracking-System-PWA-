"use client";

/** A titled card wrapping a group of profile fields. */
export default function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <div
      className={`bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-5 ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
