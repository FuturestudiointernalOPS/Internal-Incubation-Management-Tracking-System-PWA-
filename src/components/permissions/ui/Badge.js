"use client";

import React from "react";

/**
 * UI-1 primitive — one badge language for the whole Permission Center.
 * Variants carry semantics; colors come from theme variables or the repo's
 * established status palette (emerald / amber) — never hardcoded hex.
 */
const VARIANTS = {
  mapped: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  gap: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  locked: "border-[var(--border-primary)] bg-secondary text-[var(--text-secondary)]",
  verified:
    "border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]",
  neutral: "border-[var(--border-primary)] bg-secondary text-[var(--text-secondary)]",
};

export default function Badge({ variant = "neutral", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-widest ${
        VARIANTS[variant] || VARIANTS.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}

export { VARIANTS as BADGE_VARIANTS };
