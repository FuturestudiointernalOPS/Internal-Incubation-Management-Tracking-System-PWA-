"use client";

import { GitCompare, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The floating comparison bar. On a phone it becomes a bottom bar that spans
 * the width and keeps only the count and the actions; the selected names stay
 * on the wider layout where there is room for them.
 */
export default function ComparisonBar({ compareList, onCompare, onClear }) {
  const { t } = useI18n();
  if (compareList.length === 0) return null;
  return (
    <div className="fixed inset-x-3 bottom-4 z-40 sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-1)] px-4 py-3 shadow-2xl sm:px-5">
        <GitCompare className="h-4 w-4 shrink-0 text-[var(--brand-orange)]" aria-hidden="true" />
        <span className="shrink-0 text-xs font-bold text-[var(--text-primary)]">
          {t("member.investor.browser.compare.selected", { count: compareList.length })}
        </span>
        <div className="hidden max-w-[260px] gap-2 overflow-x-auto sm:flex">
          {compareList.map((item) => (
            <span
              key={item.id}
              className="max-w-[110px] shrink-0 truncate rounded-lg bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]"
            >
              {item.name}
            </span>
          ))}
        </div>
        {compareList.length >= 2 && (
          <button type="button" onClick={onCompare} className="stf-btn sm pr shrink-0">
            {t("member.investor.browser.compare.action")}
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          aria-label={t("member.investor.browser.compare.clear")}
          className="shrink-0 rounded-lg p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-rose-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
