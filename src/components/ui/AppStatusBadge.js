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
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  if (variant === "dot") {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${pulse ? "animate-pulse" : ""} ${className}`}
        style={{ background: cfg.dot || cfg.color.replace("text-", "bg-") }}
        title={cfg.label}
      />
    );
  }

  if (variant === "minimal") {
    return (
      <span
        className={`text-[10px] font-bold ${cfg.color} ${className}`}
      >
        {cfg.label}
      </span>
    );
  }

  // Pill (default)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} ${pulse ? "animate-pulse" : ""} ${className}`}
    >
      {cfg.dot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: cfg.dot }}
        />
      )}
      {cfg.label}
    </span>
  );
}
