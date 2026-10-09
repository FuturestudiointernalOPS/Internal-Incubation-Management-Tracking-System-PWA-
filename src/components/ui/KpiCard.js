"use client";

/**
 * One figure: its caption, an icon, the value ("…" while loading) and an optional
 * hint. `active` marks the card as the selected one when a row of cards acts as a
 * filter.
 */
export default function KpiCard({ label, value, icon: Icon, loading, hint, badge, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className="stf-card stf-kpi"
      style={{
        ...(onClick ? { textAlign: "left", cursor: "pointer", width: "100%" } : null),
        ...(active ? { borderColor: "var(--brand-orange)", boxShadow: "inset 0 0 0 1px var(--brand-orange)" } : null),
      }}
    >
      <div className="stf-k">
        <span>{label}</span>
        {Icon && <Icon size={15} />}
      </div>
      <div className="big">{loading ? "…" : value}</div>
      {(badge || hint) && !loading && (
        <div className="stf-small" style={{ marginTop: 4 }}>
          {badge && <span className="stf-tag g" style={{ marginRight: 6 }}>{badge}</span>}
          {hint}
        </div>
      )}
    </Tag>
  );
}
