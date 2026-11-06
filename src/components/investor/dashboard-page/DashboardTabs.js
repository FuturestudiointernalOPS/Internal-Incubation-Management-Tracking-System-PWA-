"use client";

import { Search, BarChart3, Bookmark, Handshake, CalendarClock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The Discover | Pipeline | Watchlist tab strip.
 * Extracted verbatim from InvestorDashboard.
 */
export default function DashboardTabs({
  activeTab,
  onTabChange,
  introductions = false,
  introductionCount = 0,
  meetings = false,
}) {
  const { t } = useI18n();
  const tabs = [
        { id: "discover", label: t("discover"), icon: Search },
        { id: "pipeline", label: t("pipeline"), icon: BarChart3 },
        { id: "watchlist", label: t("watchlist"), icon: Bookmark },
        ...(introductions ? [{ id: "introductions", label: t("dashboardV2.introductions"), icon: Handshake, count: introductionCount }] : []),
        ...(meetings ? [{ id: "meetings", label: t("meetings"), icon: CalendarClock }] : []),
      ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-primary)]" role="tablist" aria-label={t("dashboardV2.tabs")}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          id={`investor-tab-${tab.id}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls="investor-tabpanel"
          onClick={() => onTabChange(tab.id)}
          className={`flex min-h-11 shrink-0 items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors relative ${
            activeTab === tab.id
              ? "text-[var(--brand-orange)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <tab.icon className="w-3.5 h-3.5" />
          {tab.label}
          {tab.count > 0 && <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 tabular-nums">{tab.count}</span>}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />
          )}
        </button>
      ))}
    </div>
  );
}
