"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Shield, Users, UserRoundCog, ScrollText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PERMISSION_BASE, PERMISSION_NAV, navByKey } from "./permissionNav";
import { defer } from "./effectUtils";

/**
 * PHASE UI-1 — Permission Center shell.
 *
 * One professional frame for every authorization screen: breadcrumb, page
 * header, a four-item primary navigation (each item is a REAL route — deep
 * linkable), and optional sub-tabs. Views are embedded unchanged; the shell
 * owns chrome and navigation only — it never touches authorization logic.
 *
 * Navigation model: ./permissionNav (pure, shared with the route contract
 * tests).
 */

export { PERMISSION_BASE, PERMISSION_NAV, navByKey };

const CONTEXT_TABS = [
  { key: "roles", labelKey: "engineering.permissions.tabContextRoles" },
  { key: "memberships", labelKey: "engineering.permissions.tabMemberships" },
  { key: "policies", labelKey: "engineering.permissions.tabScopePolicies" },
];

const QUESTION_BY_KEY = {
  people: "engineering.permissions.questionPeople",
  templates: "engineering.permissions.questionTemplates",
  rules: "engineering.permissions.questionRules",
  history: "engineering.permissions.questionHistory",
};

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
  const resolvedActive = active === "context" || active === "operations" ? "rules" : active;
  const nav = navByKey(resolvedActive);
  const tabs = active === "context" ? CONTEXT_TABS : nav?.tabs || [];
  const iconByKey = {
    people: Users,
    templates: UserRoundCog,
    rules: BookOpen,
    history: ScrollText,
  };

  return (
    <div className="pb-20">
      <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
        <Link href="/admin/security" className="transition-colors hover:text-[var(--text-primary)]">
          {t("engineering.permissions.breadcrumbSecurity")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[var(--brand-orange)]">{t("engineering.permissions.pageTitle")}</span>
      </div>

      <div className="min-h-[42rem] bg-surface-1 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border-primary)] bg-surface-1 px-2 py-3 lg:border-b-0 lg:border-r lg:px-2.5" aria-label={t("engineering.permissions.shellNavAria")}>
          <div className="mb-3 flex items-center gap-2 px-2 py-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-brand-orange/10">
              <Shield className="h-4 w-4 text-[var(--brand-orange)]" />
            </span>
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {t("engineering.permissions.pageTitle")}
            </span>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            {PERMISSION_NAV.map((item) => {
              const isActive = item.key === resolvedActive;
              const Icon = iconByKey[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${
                    isActive
                      ? "bg-[var(--brand-orange)] text-white"
                      : "text-[var(--text-secondary)] hover:bg-surface-2 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 p-5 sm:p-6">
          <header className="mb-4">
            <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
              {nav ? t(nav.labelKey) : t("engineering.permissions.pageTitle")}
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {nav ? t(QUESTION_BY_KEY[nav.key]) : t("engineering.permissions.pageSubtitle")}
            </p>
          </header>

          {tabs.length > 0 && (
            <div role="tablist" aria-label={t("engineering.permissions.shellSubTabsAria")} className="mb-5 flex overflow-x-auto border-b border-[var(--border-primary)]">
              {tabs.map((tab) => {
                const isActive = tab.key === sub;
                return (
                  <button key={tab.key} role="tab" aria-selected={isActive} onClick={() => onSubChange && onSubChange(tab.key)} className={`shrink-0 border-b-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${isActive ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          )}

          <main className="min-h-[40vh]">{children}</main>
        </section>
      </div>
    </div>
  );
}
