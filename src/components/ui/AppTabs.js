"use client";

import { useMemo } from "react";

/**
 * AppTabs — Reusable tab navigation
 *
 * Consolidates the hand-rolled tab patterns found across 5+ pages.
 *
 * @param {Array<{id: string, label: string, icon?: React.ComponentType, count?: number}>} tabs
 * @param {string} activeTab - Currently active tab ID
 * @param {(tabId: string) => void} onTabChange
 * @param {object} [options]
 * @param {'underline'|'pills'} [options.variant='underline']
 * @param {boolean} [options.scrollable=false] - Allow horizontal scroll
 * @param {string} [options.className='']
 *
 * @example
 *   <AppTabs
 *     tabs={[
 *       { id: "feed", label: "Feed", icon: Activity },
 *       { id: "monthly", label: "Monthly", count: 3 },
 *       { id: "tasks", label: "Tasks" },
 *     ]}
 *     activeTab={activeTab}
 *     onTabChange={setActiveTab}
 *     variant="underline"
 *   />
 */
export default function AppTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = "underline",
  scrollable = false,
  className = "",
}) {
  const variants = useMemo(
    () => ({
      underline: {
        container: `flex ${scrollable ? "overflow-x-auto scrollbar-none" : ""} border-b`,
        containerBorder: "var(--border-primary)",
        tab: (isActive) => `
          relative px-4 py-3 text-[10px] font-bold uppercase tracking-wider
          whitespace-nowrap transition-all duration-150 cursor-pointer
          ${isActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}
        `,
        indicator: (isActive) =>
          isActive
            ? "absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]"
            : "",
      },
      pills: {
        container: `flex gap-1 ${scrollable ? "overflow-x-auto scrollbar-none" : ""}`,
        tab: (isActive) => `
          px-4 py-2 text-[10px] font-bold uppercase tracking-wider
          whitespace-nowrap rounded-[var(--radius-sm)] transition-all duration-150 cursor-pointer
          ${
            isActive
              ? "bg-[var(--brand-orange)] text-white"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
          }
        `,
        indicator: () => "",
      },
    }),
    [scrollable],
  );

  const style = variants[variant] || variants.underline;

  return (
    <div
      className={style.container}
      style={{ borderBottomColor: style.containerBorder }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={style.tab(isActive)}
          >
            <div className="relative flex items-center gap-2">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                      : "bg-[var(--surface-3)] text-[var(--text-tertiary)]"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {style.indicator(isActive)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
