"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
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
 * The legacy tab bar inside PermissionManager stays available (embedded=false)
 * but every route renders it embedded, so there is exactly one navigation.
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
        const s = new URLSearchParams(window.location.search).get("sub");
        if (s) setSub(s);
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
      {/* Breadcrumb + header */}
      <header className="space-y-3">
        <nav
          aria-label={t("engineering.permissions.shellBreadcrumbAria")}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]"
        >
          <Link
            href="/admin/security"
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            {t("engineering.permissions.breadcrumbSecurity")}
          </Link>
          <span className="opacity-50">/</span>
          <Link
            href={PERMISSION_BASE}
            className="hover:text-[var(--text-primary)] transition-colors"
          >
            {t("engineering.permissions.pageTitle")}
          </Link>
          {active !== "overview" && nav && (
            <>
              <span className="opacity-50">/</span>
              <span className="text-[var(--brand-orange)]">{t(nav.labelKey)}</span>
            </>
          )}
        </nav>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
            <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest">
              {t("engineering.permissions.authorization")}
            </span>
          </div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
            {t("engineering.permissions.pageTitle")}
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {t("engineering.permissions.pageSubtitle")}
          </p>
        </div>
      </header>

      {/* Primary navigation — real routes */}
      <nav
        aria-label={t("engineering.permissions.shellNavAria")}
        className="flex flex-wrap items-center gap-1 border-b border-[var(--border-primary)]"
      >
        {PERMISSION_NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`px-4 py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60 rounded-sm ${
                isActive
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* Sub-tabs (URL-reflected, cosmetic navigation) */}
      {tabs.length > 0 && (
        <div
          role="tablist"
          aria-label={t("engineering.permissions.shellSubTabsAria")}
          className="flex flex-wrap items-center gap-2"
        >
          {tabs.map((tab) => {
            const isActive = tab.key === sub;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSubChange && onSubChange(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60 ${
                  isActive
                    ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                    : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
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
