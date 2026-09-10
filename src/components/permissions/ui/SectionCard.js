"use client";

import React from "react";

/**
 * UI-1 primitive — titled section container (the standard card used across
 * the redesigned Permission Center screens).
 */
export default function SectionCard({ title, action, children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-3 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
