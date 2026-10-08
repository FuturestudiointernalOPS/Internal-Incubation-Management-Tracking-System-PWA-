"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { PERMISSION_BASE, PERMISSION_NAV, navByKey } from "./permissionNav";
import { defer } from "./effectUtils";

/**
 * PHASE UI-1 — Permission Center shell.
 *
 * One professional frame for every authorization screen: breadcrumb, page
 * header, a six-item primary navigation (each item is a REAL route — deep
 * linkable), and optional sub-tabs. Views are embedded unchanged; the shell
 * owns chrome and navigation only — it never touches authorization logic.
 *
 * Navigation model: ./permissionNav (pure, shared with the route contract
 * tests).
 */

export { PERMISSION_BASE, PERMISSION_NAV, navByKey };

/**
 * Sub-tab state that survives reloads and is shareable: reads `?sub=` on
 * mount, writes it with replaceState on change (no router churn, no Suspense
 * requirement). Falls back to the route's default tab on unknown values.
 */
export function useSubTab(defaultKey) {
  const [sub, setSub] = useState(defaultKey);
  useEffect(() => {
    // Deep-link sync runs after the commit (deferred) so the mount effect
    // performs no synchronous state update — server and client markup match.
    defer(() => {
      try {
        const subParam = new URLSearchParams(window.location.search).get("sub");
        if (subParam) setSub(subParam);
      } catch {
        /* SSR / malformed URL — keep the default */
      }
    });
  }, []);
  const change = useCallback((key) => {
    setSub(key);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("sub", key);
      window.history.replaceState(null, "", url);
    } catch {
      /* URL update is cosmetic; state already switched */
    }
  }, []);
  return [sub, change];
}

export default function PermissionShell({ active, sub, onSubChange, children }) {
  const { t } = useI18n();
  const nav = navByKey(active);
  const tabs = nav?.tabs || [];

  return (
    <div className="space-y-6 pb-20">
      {/* Breadcrumb + header: one trail, one title */}
      <header>
        <nav
          aria-label={t("engineering.permissions.shellBreadcrumbAria")}
          className="mb-3 flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]"
        >
          <Link href="/admin/security" className="transition-colors hover:text-[var(--text-primary)]">
            {t("engineering.permissions.breadcrumbSecurity")}
          </Link>
          <span className="opacity-50">/</span>
          <Link href={PERMISSION_BASE} className="transition-colors hover:text-[var(--text-primary)]">
            {t("engineering.permissions.pageTitle")}
          </Link>
          {active !== "overview" && nav && (
            <>
              <span className="opacity-50">/</span>
              <span className="font-semibold text-[var(--brand-orange)]">{t(nav.labelKey)}</span>
            </>
          )}
        </nav>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[var(--text-primary)]">{t("engineering.permissions.pageTitle")}</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          {t("engineering.permissions.pageSubtitle")}
        </p>
      </header>

      {/* Primary navigation — real routes */}
      <nav aria-label={t("engineering.permissions.shellNavAria")} className="flex w-max max-w-full gap-1 overflow-x-auto rounded-[10px] border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-1">
        {PERMISSION_NAV.map((item) => {
          const isActive = item.key === active;
          return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${isActive ? "bg-[var(--brand-orange)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {t(item.labelKey)}
          </Link>
          );
        })}
      </nav>

      {/* Sub-tabs (URL-reflected, cosmetic navigation) */}
      {tabs.length > 0 && (
        <div role="tablist" aria-label={t("engineering.permissions.shellSubTabsAria")} className="flex flex-wrap gap-6 border-b border-[var(--border-primary)]">
          {tabs.map((tab) => {
            const isActive = tab.key === sub;
            return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSubChange && onSubChange(tab.key)}
              className={`-mb-px border-b-2 px-0.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${isActive ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {t(tab.labelKey)}
            </button>
            );
          })}
        </div>
      )}

      {/* Screen body */}
      <main className="min-h-[40vh]">{children}</main>
    </div>
  );
}
