"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  BarChart3,
  GitBranch,
  Settings,
  ChevronDown,
  LogOut,
  User,
  Menu,
  X,
  Blocks,
  Activity,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getActiveModules } from "@/lib/platform/registry";

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
};

export const dynamic = "force-dynamic";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function PlatformLayout({ children }) {
  const { t, switchLang, lang } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState({ role: "super_admin" });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    if (u.role) setUser(u);
  }, []);

  const navModules = useMemo(() => getActiveModules(user.role), [user.role]);
  const isActive = (href) => pathname === href;

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
              Forms
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {navModules.map((mod) => {
            const Icon = ICON_MAP[mod.icon] || LayoutDashboard;
            const active = isActive(mod.href);
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-[11px] font-bold tracking-wide",
                  active
                    ? "bg-[var(--brand-orange)] text-black"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary",
                )}
                title={!collapsed ? undefined : mod.name}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate">{mod.name}</span>
                )}
                {!collapsed && mod.future && (
                  <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[7px] font-black uppercase tracking-wider">
                    Soon
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

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-[100] bg-secondary border-b border-[var(--border-primary)] px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <Link
              href="/admin/crm"
              className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors"
            >
              ← Back to CRM
            </Link>
          </div>

          <div className="flex items-center gap-3">
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
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
