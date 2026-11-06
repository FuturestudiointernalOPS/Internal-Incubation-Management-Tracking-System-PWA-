"use client";

import { GitCompare, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The side-by-side comparison modal.
 * Extracted verbatim from InvestorDashboard.
 */
export default function ComparisonModal({ compareList, onClose }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="investor-compare-title">
        <div className="sticky top-0 bg-[var(--surface-1)] flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 id="investor-compare-title" className="text-sm font-black text-[var(--text-primary)] uppercase flex items-center gap-2"><GitCompare aria-hidden="true" className="w-4 h-4 text-[var(--brand-orange)]" />{t("investor.compare")}</h3>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-[var(--border-primary)]">
              <th scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] w-32">{t("dashboardV2.comparisonField")}</th>
              {compareList.map(item => <th key={item.id} scope="col" className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">{item.name}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {[
                { label: t("investor.industry"), key: "industry" },
                { label: t("investor.country"), key: "country" },
                { label: t("dashboardV2.foundersLabel"), key: "founders", fmt: value => value ?? "—" },
                { label: t("dashboardV2.founderCountries"), key: "founders_countries", fmt: value => value?.join(", ") || "—" },
                { label: t("dashboardV2.raiseAmount"), key: "raise_amount", fmt: (value, item) => value == null ? "—" : `${item.currency || ""} ${Number(value).toLocaleString()}` },
                { label: t("dashboardV2.description"), key: "description", fmt: value => value ? value.substring(0, 160) : "—" },
              ].map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="px-6 py-3 text-left text-[10px] font-bold text-[var(--text-secondary)] uppercase">{row.label}</th>
                  {compareList.map(item => <td key={item.id} className="px-6 py-3 text-xs font-bold text-[var(--text-primary)]">{row.fmt ? row.fmt(item[row.key], item) : (item[row.key] || "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
