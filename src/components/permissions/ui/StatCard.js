"use client";

import React from "react";

/**
 * UI-1 primitive — statistic card used by the Overview screen.
 * `tone` maps to the shared badge palette so status colors stay consistent.
 */
const TONES = {
  neutral: "text-[var(--text-primary)]",
  brand: "text-[var(--brand-orange)]",
  warning: "text-amber-400",
  success: "text-emerald-400",
};

export default function StatCard({ label, value, hint, icon: Icon, tone = "neutral" }) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-surface-1 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {label}
        </p>
        {Icon && <Icon className={`w-4 h-4 ${TONES[tone] || TONES.neutral}`} />}
      </div>
      <p className={`text-2xl font-black tracking-tight ${TONES[tone] || TONES.neutral}`}>
        {value}
      </p>
      {hint && (
        <p className="text-xs font-medium text-[var(--text-secondary)] leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}
