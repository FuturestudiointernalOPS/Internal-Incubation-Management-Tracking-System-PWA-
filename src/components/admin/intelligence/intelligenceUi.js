/**
 * Shared display primitives of the intelligence screen. Extracted from
 * `IntelligenceView.js` without change: the two card shells, the pipeline
 * tooltip, the health badge and the duration formatter.
 */

export function MetricCard({ icon: Icon, label, value, hint, accentClass }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accentClass ?? "bg-brand-orange/10 text-[var(--brand-orange)]"}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black tracking-tighter text-[var(--text-primary)] leading-none">
            {value}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)] truncate">
            {label}
          </p>
        </div>
      </div>
      {hint ? <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">{hint}</p> : null}
    </div>
  );
}

export function SectionCard({ title, subtitle, children, className }) {
  return (
    <div className={`rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function PipelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2 shadow-lg">
      <p className="text-xs font-bold text-[var(--text-primary)]">{label}</p>
      <p className="text-xs" style={{ color: payload[0].fill }}>
        {payload[0].value}
      </p>
    </div>
  );
}

const HEALTH_STYLES = {
  on_track: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  at_risk: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  critical: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export function HealthBadge({ status, t }) {
  const label =
    status === "on_track"
      ? t("adminMisc.intelligence.healthy")
      : status === "at_risk"
        ? t("adminMisc.intelligence.atRisk")
        : t("adminMisc.intelligence.critical");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        HEALTH_STYLES[status] ?? "text-[var(--text-secondary)] bg-surface-3 border-[var(--border-primary)]"
      }`}
    >
      {label}
    </span>
  );
}

export function formatDuration(seconds, t) {
  const value = Number(seconds);
  if (seconds === null || seconds === undefined || Number.isNaN(value)) return "—";
  const totalMin = Math.round(value / 60);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}${t("adminMisc.intelligence.unitDay")} ${hours}${t("adminMisc.intelligence.unitHour")}`;
  if (hours > 0) return `${hours}${t("adminMisc.intelligence.unitHour")} ${minutes}${t("adminMisc.intelligence.unitMinute")}`;
  return `${minutes}${t("adminMisc.intelligence.unitMinute")}`;
}
