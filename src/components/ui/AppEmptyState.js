"use client";

/**
 * AppEmptyState — Consistent empty/placeholder state
 *
 * Replaces inline empty-state markup found across multiple pages.
 *
 * @param {object} props
 * @param {string} [props.title="No data found"]
 * @param {string} [props.description]
 * @param {React.ComponentType} [props.icon]
 * @param {React.ReactNode} [props.action] - Optional action button/component
 * @param {string} [props.className=""]
 * @param {'sm'|'md'|'lg'} [props.size="md"]
 *
 * @example
 *   <AppEmptyState
 *     title="No tasks this week"
 *     description="Create a new task to get started"
 *     icon={ListTodo}
 *     action={<AppButton variant="primary">Create Task</AppButton>}
 *   />
 */
export default function AppEmptyState({
  title = "No data found",
  description,
  icon: Icon,
  action,
  className = "",
  size = "md",
}) {
  const sizeStyles = {
    sm: { padding: "p-8", titleSize: "text-[10px]", iconSize: "w-8 h-8", gap: "gap-3" },
    md: { padding: "p-12", titleSize: "text-xs", iconSize: "w-10 h-10", gap: "gap-4" },
    lg: { padding: "p-16", titleSize: "text-sm", iconSize: "w-12 h-12", gap: "gap-5" },
  };

  const s = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${s.padding} ${s.gap} ${className}`}
    >
      {Icon && (
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            background: "var(--surface-3)",
            width: `calc(${s.iconSize} + 1.5rem)`,
            height: `calc(${s.iconSize} + 1.5rem)`,
          }}
        >
          <Icon
            className={s.iconSize}
            style={{ color: "var(--text-tertiary)" }}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <p
          className={`${s.titleSize} font-bold uppercase tracking-widest`}
          style={{ color: "var(--text-tertiary)" }}
        >
          {title}
        </p>
        {description && (
          <p
            className="text-[10px] leading-relaxed max-w-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
