"use client";

import { GitCompare, X } from "lucide-react";

/**
 * The floating comparison bar (selected ventures + Compare/Clear).
 * Extracted verbatim from InvestorDashboard.
 */
export default function ComparisonBar({ compareList, onCompare, onClear }) {
  if (compareList.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-3 px-5 py-3 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
        <GitCompare className="w-4 h-4 text-[var(--brand-orange)]" />
        <span className="text-xs font-bold text-[var(--text-primary)]">{compareList.length} selected</span>
        <div className="flex gap-2">
          {compareList.map(item => (
            <span key={item.id} className="px-2 py-0.5 rounded-lg bg-[var(--surface-3)] text-[10px] font-bold truncate max-w-[100px]">{item.name}</span>
          ))}
        </div>
        {compareList.length >= 2 && (
          <button onClick={onCompare}
            className="px-3 py-1.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-wider rounded-lg">
            Compare
          </button>
        )}
        <button onClick={onClear} className="p-1 text-[var(--text-secondary)] hover:text-rose-400"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
