"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  BarChart3,
  GitBranch,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  Blocks,
  Upload,
  ArrowLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getActiveModules } from "@/lib/platform/registry";
import { useSafeBack } from "@/lib/useSafeBack";
import { roleHomeHref } from "@/lib/platform/roles";

/**
 * PLATFORM LAYOUT
 * Dedicated workspace for Platform capabilities.
 * Completely isolated from existing Operations layout.
 */

const ICON_MAP = {
  LayoutDashboard,
  FolderKanban,
  FileText,
  BarChart3,
  GitBranch,
  Settings,
  Upload,
  User,
};

const PLATFORM_MODULE_LABELS = {
  "platform-dashboard": "platformMisc.nav.dashboard",
  "platform-forms": "platformMisc.nav.forms",
  "platform-runs": "platformMisc.nav.runs",
  "platform-import": "platformMisc.nav.historicalImport",
  "platform-import-review": "platformMisc.nav.identityReview",
  "platform-scores": "platformMisc.nav.scores",
};

export const dynamic = "force-dynamic";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PlatformLayout({ children }) {
  const { t, switchLang, lang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState({ role: "" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mePerms, setMePerms] = useState(null);

  useEffect(() => {
    // Server session is authoritative; localStorage is only a legacy fallback.
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((sessionData) => {
        if (sessionData.authenticated && sessionData.user) {
          setUser(sessionData.user);
          return;
        }
        const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");
        if (cachedUser.role) setUser(cachedUser);
      })
      .catch(() => {
        const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");
        if (cachedUser.role) setUser(cachedUser);
      });
  }, []);

  // Capability projection for the navigation: modules that declare a
  // `capability` (e.g. Runs → runs.view) are governed by the resolver, not by
  // the session role. Fail closed until the matrix arrives so an unloaded
  // predicate never flashes a module the user cannot open.
  useEffect(() => {
    fetch("/api/me/permissions")
      .then((response) => response.json())
      .then((permissionData) => {
        if (permissionData.success) setMePerms(permissionData);
      })
      .catch(() => {});
  }, []);

  const hasCapability = useCallback(
    ({ module: moduleKey, capability }) => {
      if (!mePerms) return false;
      if (mePerms.isSuperAdmin) return true;
      return Number(mePerms.effective?.[moduleKey]?.[capability] ?? 0) > 0;
    },
    [mePerms],
  );

  const navModules = useMemo(
    () => getActiveModules(user.role, hasCapability),
    [user.role, hasCapability],
  );
  const isActive = (href) => pathname === href;

  // Leave the platform workspace back to wherever the user came from (e.g. the
  // CRM section that links to the Forms tool), falling back to their role home.
  const goBack = useSafeBack(roleHomeHref(user.role) || "/workspaces");

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/session-logout", { method: "POST" });
    } catch (_) {}
    localStorage.clear();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-primary flex">
      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? 64 : 260 }}
        className="hidden md:flex flex-col h-screen sticky top-0 bg-secondary border-r border-[var(--border-primary)] p-4 overflow-hidden min-h-0 z-[100] transition-[width] duration-150"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-6 mt-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--brand-orange)] flex items-center justify-center">
            <Blocks className="w-4 h-4 text-black" />
          </div>
          {!collapsed && (
            <span className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("platformMisc.nav.forms")}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {navModules.map((moduleItem) => {
            const Icon = ICON_MAP[moduleItem.icon] || LayoutDashboard;
            const active = isActive(moduleItem.href);
            return (
              <Link
                key={moduleItem.id}
                href={moduleItem.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[11px] font-bold tracking-wide",
                  active
                    ? "bg-[var(--brand-orange)] text-black"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary",
                )}
                title={!collapsed ? undefined : moduleItem.name}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate">
                    {t(PLATFORM_MODULE_LABELS[moduleItem.id] || "") || moduleItem.name}
                  </span>
                )}
                {!collapsed && moduleItem.future && (
                  <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wide">
                    {t("platformMisc.nav.soon")}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="pt-4 border-t border-[var(--border-primary)] space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 text-[10px] text-[var(--text-secondary)]">
            <User className="w-3.5 h-3.5" />
            {!collapsed && (
              <span className="truncate font-bold uppercase tracking-wider">
                {user.name || "Admin"}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <LogOut className="w-3.5 h-3.5" />
            {!collapsed && <span>{t("navigation.logout") || "Logout"}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[300] md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 w-72 bg-secondary border-l border-[var(--border-primary)] p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                {t("platformMisc.nav.forms")}
              </span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-[var(--text-secondary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navModules.map((moduleItem) => {
                const Icon = ICON_MAP[moduleItem.icon] || LayoutDashboard;
                const active = isActive(moduleItem.href);
                return (
                  <Link
                    key={moduleItem.id}
                    href={moduleItem.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[11px] font-bold tracking-wide ${active ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t(PLATFORM_MODULE_LABELS[moduleItem.id] || "") || moduleItem.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-[var(--border-primary)] mt-4">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all text-[10px] font-black uppercase tracking-widest">
                <LogOut className="w-4 h-4" />
                {t("navigation.logout") || "Logout"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-[100] bg-secondary border-b border-[var(--border-primary)] px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors"
              title={t("common.back")}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t("common.back")}</span>
            </button>
            <span className="h-4 w-px bg-[var(--border-primary)] opacity-60" />
            <button
              onClick={() => switchLang(lang === "en" ? "fr" : "en")}
              className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {lang === "en" ? "FR" : "EN"}
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:block p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
