"use client";

/**
 * One figure of a dashboard section: the icon, an optional badge, the caption
 * and the value (a skeleton while loading).
 * Extracted verbatim from app/admin/page.js.
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  color,
  badge,
  onClick,
  loading,
  subtitle,
}) {
  return (
    <div
      onClick={onClick}
      className={`card group transition-all ${onClick ? "cursor-pointer hover:border-[var(--brand-orange)]" : ""}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-3 rounded-xl bg-primary border border-[var(--border-primary)] ${color} group-hover:scale-110 transition-transform`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {badge && (
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
        {title}
      </p>
      {loading ? (
        <div className="h-8 w-16 bg-divider/20 animate-pulse rounded-lg" />
      ) : (
        <>
          <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            {value}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{subtitle}</p>
          )}
        </>
      )}
    </div>
  );
}