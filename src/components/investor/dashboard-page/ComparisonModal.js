"use client";

import { GitCompare, X } from "lucide-react";

/**
 * The side-by-side comparison modal.
 * Extracted verbatim from InvestorDashboard.
 */
export default function ComparisonModal({ compareList, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase flex items-center gap-2"><GitCompare className="w-4 h-4 text-[var(--brand-orange)]" />Compare</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--border-primary)]">
              <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] w-32">Metric</th>
              {compareList.map(item => <th key={item.id} className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] uppercase">{item.name}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {[
                { label: "Industry", key: "industry" },
                { label: "Country", key: "country" },
                { label: "Status", key: "status" },
                { label: "Progress", key: "completion_index", fmt: value => value ? Number(value).toFixed(0)+'%' : "—" },
                { label: "Interest", key: "investor_interest_count", fmt: value => (value||0)+' investors' },
                { label: "Description", key: "description", fmt: value => value ? value.substring(0,100)+(value.length>100?'...':'') : "—" },
              ].map((row, index) => (
                <tr key={index}>
                  <td className="px-6 py-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase">{row.label}</td>
                  {compareList.map(item => <td key={item.id} className="px-6 py-3 text-xs font-bold text-[var(--text-primary)]">{row.fmt ? row.fmt(item[row.key]) : (item[row.key]||"—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
