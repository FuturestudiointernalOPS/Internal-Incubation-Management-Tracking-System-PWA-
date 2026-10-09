"use client";

import React from "react";

/**
 * Permission Center note — the quiet explanatory band.
 *
 * The prototype's `.note`: a sentence that states the rule or the warning before
 * the data, set apart by a single accent hairline on the left rather than a full
 * coloured panel, so it never competes with the numbers below it.
 */
export default function NoteBox({ children, tone = "brand" }) {
  const accent =
    tone === "warning"
      ? "border-l-amber-400"
      : tone === "danger"
        ? "border-l-red-400"
        : "border-l-[var(--brand-orange)]";

  return (
    <div
      className={`rounded-lg border border-[var(--border-primary)] border-l-[3px] ${accent} bg-[var(--surface-2)] px-4 py-3`}
    >
      <p className="text-xs font-medium leading-relaxed text-[var(--text-secondary)]">
        {children}
      </p>
    </div>
  );
}
