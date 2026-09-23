"use client";

import { STATUS_CONFIG } from "@/lib/constants";

/**
 * AppStatusBadge — Dedicated status badge
 *
 * Replaces 7 inline copies of STATUS_CONFIG rendering across the codebase.
 *
 * @param {object} props
 * @param {string} props.status - Task/project status key
 * @param {'pill'|'dot'|'minimal'} [props.variant='pill']
 * @param {string} [props.className='']
 * @param {boolean} [props.pulse=false] - Animate for attention
 *
 * @example
 *   // Pill (default)
 *   <AppStatusBadge status="in_progress" />
 *
 *   // Dot indicator only
 *   <AppStatusBadge status="blocked" variant="dot" />
 *
 *   // Minimal text-only
 *   <AppStatusBadge status="completed" variant="minimal" />
 */
export default function AppStatusBadge({
  status,
  variant = "pill",
  className = "",
  pulse = false,
}) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  if (variant === "dot") {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${pulse ? "animate-pulse" : ""} ${className}`}
        style={{ background: statusConfig.dot || statusConfig.color.replace("text-", "bg-") }}
        title={statusConfig.label}
      />
    );
  }

  if (variant === "minimal") {
    return (
      <span
        className={`text-[10px] font-bold ${statusConfig.color} ${className}`}
      >
        {statusConfig.label}
      </span>
    );
  }

  // Pill (default)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusConfig.bg} ${statusConfig.color} ${pulse ? "animate-pulse" : ""} ${className}`}
    >
      {statusConfig.dot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: statusConfig.dot }}
        />
      )}
      {statusConfig.label}
    </span>
  );
}
