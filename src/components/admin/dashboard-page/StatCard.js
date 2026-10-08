"use client";

/**
 * One figure of a dashboard section: the icon, an optional badge, the caption
 * and the value (a placeholder while loading).
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  badge,
  onClick,
  loading,
  subtitle,
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="stf-card stf-kpi"
      style={onClick ? { textAlign: "left", cursor: "pointer", width: "100%" } : undefined}
    >
      <div className="stf-k">
        <span>{title}</span>
        <Icon size={15} />
      </div>
      <div className="big">{loading ? "…" : value}</div>
      {(badge || subtitle) && !loading && (
        <div className="stf-small" style={{ marginTop: 4 }}>
          {badge && <span className="stf-tag g" style={{ marginRight: 6 }}>{badge}</span>}
          {subtitle}
        </div>
      )}
    </Tag>
  );
}
