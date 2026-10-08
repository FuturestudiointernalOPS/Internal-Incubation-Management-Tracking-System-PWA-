"use client";

const VARIANT_STYLES = {
  default: "",
  success: "g",
  warning: "w",
  danger: "r",
  info: "b",
  brand: "o",
};

/** A small state tag — the same `stf-tag` every page uses. */
export default function AppBadge({ children, variant = "default", className = "", dot = false }) {
  const tone = VARIANT_STYLES[variant] ?? "";
  return (
    <span className={`stf-tag ${tone} ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />}
      {children}
    </span>
  );
}
