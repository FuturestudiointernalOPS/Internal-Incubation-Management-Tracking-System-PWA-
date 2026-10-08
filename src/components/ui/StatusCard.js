"use client";

/** A figure that carries a state: tone "g" (good), "o" (watch) or "r" (critical). */
export default function StatusCard({ tone = "g", icon: Icon, label, value, hint, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`stf-st ${tone}`}
      style={onClick ? { textAlign: "left", cursor: "pointer", width: "100%" } : undefined}
    >
      {Icon && <Icon size={18} />}
      <div>
        <div className="stf-k">{label}</div>
        <div className="stf-num">{value}</div>
        {hint && <div className="stf-small">{hint}</div>}
      </div>
    </Tag>
  );
}
