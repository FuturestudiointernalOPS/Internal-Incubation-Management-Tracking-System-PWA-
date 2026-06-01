"use client";

const VARIANT_STYLES = {
  default: { bg: "var(--surface-3)", text: "var(--text-secondary)" },
  success: { bg: "rgba(16,185,129,0.1)", text: "#10B981" },
  warning: { bg: "rgba(245,158,11,0.1)", text: "#F59E0B" },
  danger: { bg: "rgba(239,68,68,0.1)", text: "#EF4444" },
  info: { bg: "rgba(99,102,241,0.1)", text: "#818CF8" },
  brand: { bg: "rgba(255,102,0,0.1)", text: "var(--brand-orange)" },
};

export default function AppBadge({ children, variant = "default", className = "", dot = false }) {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}
      style={{ background: style.bg, color: style.text }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.text }} />}
      {children}
    </span>
  );
}
