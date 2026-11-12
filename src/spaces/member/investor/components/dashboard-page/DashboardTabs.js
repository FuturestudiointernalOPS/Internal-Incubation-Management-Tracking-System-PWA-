"use client";

import { Search, BarChart3, Bookmark } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The Discover | Pipeline | Watchlist tab strip.
 * Extracted verbatim from InvestorDashboard.
 */
export default function DashboardTabs({ activeTab, onTabChange }) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1 border-b border-[var(--border-primary)]">
      {[
        { id: "discover", label: t("discover"), icon: Search },
        { id: "pipeline", label: t("pipeline"), icon: BarChart3 },
        { id: "watchlist", label: t("watchlist"), icon: Bookmark },
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors relative ${
            activeTab === tab.id
              ? "text-[var(--brand-orange)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <tab.icon className="w-3.5 h-3.5" />
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />
          )}
        </button>
      ))}
    </div>
  );
}
