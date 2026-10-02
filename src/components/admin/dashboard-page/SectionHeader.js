"use client";

/**
 * The banner of a dashboard section: its letter, its icon, its title and
 * subtitle, and an optional action.
 * Extracted verbatim from app/admin/page.js.
 */
export default function SectionHeader({
  number,
  title,
  subtitle,
  icon: Icon,
  color,
  action,
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center text-sm font-bold border border-white/10`}
        >
          {number}
        </div>
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-[var(--brand-orange)]" />}
            <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && action}
    </div>
  );
}