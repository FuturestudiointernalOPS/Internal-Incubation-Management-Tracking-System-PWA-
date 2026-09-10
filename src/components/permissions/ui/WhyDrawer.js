"use client";

import React from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * UI-2 primitive — the standard "why" drawer. One place to explain a decision
 * (sources, effective result, scope) so explainability looks the same on every
 * screen instead of living in a view-specific modal.
 */
export default function WhyDrawer({ title, onClose, children }) {
  const { t } = useI18n();
  if (!title) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="w-full max-w-md h-full bg-surface-1 border-l border-[var(--border-primary)] p-6 overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("engineering.permissions.whyClose")}
            className="p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60"
          >
            <X className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
