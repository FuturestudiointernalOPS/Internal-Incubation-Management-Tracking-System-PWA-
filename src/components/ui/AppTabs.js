"use client";

import { useMemo, useRef } from "react";

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
}) {
  const listRef = useRef(null);
  const variants = useMemo(
    () => ({
      underline: {
        container: "stf-tabs",
        containerBorder: undefined,
        tab: (isActive) => `stf-tab ${isActive ? "on" : ""}`,
        indicator: () => "",
      },
      pills: {
        container: "stf-tabs",
        containerBorder: undefined,
        tab: (isActive) => `stf-tab ${isActive ? "on" : ""}`,
        indicator: () => "",
      },
    }),
    [],
  );

  const style = variants[variant] || variants.underline;

  // ARIA tabs use a roving tabindex: only the selected tab is in the tab order,
  // and the arrow keys (Home/End too) move between them. Without this the strip
  // was announced as a row of plain buttons and could only be driven by Tab.
  const handleKeyDown = (event) => {
    if (!tabs || tabs.length === 0) return;
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === currentIndex || nextIndex < 0) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onTabChange(nextTab.id);
    listRef.current
      ?.querySelector(`[data-tab-id="${nextTab.id}"]`)
      ?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={style.container}
      style={{ borderBottomColor: style.containerBorder }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={style.tab(isActive)}
          >
            <div className="relative flex items-center gap-2">
              {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className="stf-tag"
                >
                  {tab.count}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
