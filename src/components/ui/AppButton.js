"use client";

const VARIANTS = {
  primary: {
    background: "var(--brand-orange)",
    color: "#000",
    border: "none",
    hover: "brightness(1.1)",
  },
  secondary: {
    background: "var(--surface-1)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
    hover: "var(--surface-2)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "none",
    hover: "var(--surface-2)",
  },
  danger: {
    background: "rgba(239,68,68,0.1)",
    color: "#EF4444",
    border: "1px solid rgba(239,68,68,0.2)",
    hover: "rgba(239,68,68,0.2)",
  },
  success: {
    background: "rgba(16,185,129,0.1)",
    color: "#10B981",
    border: "1px solid rgba(16,185,129,0.2)",
    hover: "rgba(16,185,129,0.2)",
  },
};

const SIZES = {
  sm: "px-3 py-1.5 text-[10px]",
  md: "px-4 py-2.5 text-xs",
  lg: "px-6 py-3.5 text-sm",
};

export default function AppButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  icon: Icon,
  onClick,
  type = "button",
  ...props
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-bold uppercase tracking-wider
        rounded-[var(--radius-sm)]
        transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${SIZES[size] || SIZES.md}
        ${className}
      `}
      style={{
        background: v.background,
        color: v.color,
        border: v.border,
      }}
      onMouseEnter={(e) => {
        if (v.hover.startsWith("brightness")) {
          e.currentTarget.style.filter = v.hover;
        } else {
          e.currentTarget.style.background = v.hover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "none";
        e.currentTarget.style.background = v.background;
      }}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
}
