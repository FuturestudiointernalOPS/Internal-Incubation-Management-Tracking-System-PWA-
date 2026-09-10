"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PERMISSION_BASE, PERMISSION_NAV, navByKey } from "./permissionNav";

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
    try {
      const s = new URLSearchParams(window.location.search).get("sub");
      if (s) setSub(s);
    } catch {
      /* SSR / malformed URL — keep the default */
    }
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
        <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
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
      <nav className="flex flex-wrap items-center gap-1 border-b border-[var(--border-primary)]">
        {PERMISSION_NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`px-4 py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
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
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const isActive = tab.key === sub;
            return (
              <button
                key={tab.key}
                onClick={() => onSubChange && onSubChange(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-colors ${
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
