"use client";

/** A titled list of programme-history rows. Renders nothing when empty. */
export default function HistoryGroup({ title, rows, roleLabel, activeLabel, completedLabel }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={`${row.program_id}-${row.role}`}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                {row.program_name}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {roleLabel(row.role)}
              </p>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                row.status === "active"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-white/5 text-[var(--text-tertiary)]"
              }`}
            >
              {row.status === "active" ? activeLabel : completedLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
