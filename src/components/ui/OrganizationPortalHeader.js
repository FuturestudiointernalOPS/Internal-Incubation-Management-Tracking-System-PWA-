"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, BookOpen, GraduationCap, BriefcaseBusiness, UserRound, Settings, Palette, ArrowLeftRight, ChevronDown, Menu, X, Moon, Sun, Monitor, LogOut, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/ThemeProvider";
import { clearResponseCache } from "@/lib/hooks/useApi";
import { setDashboardSession } from "@/lib/dashboardSession";
import AppButton from "./AppButton";
import AppImage from "./AppImage";
import OrganizationBrandingEditor from "./OrganizationBrandingEditor";
import { resolveOrganizationPortalBranding } from "./organizationPortalBranding";
import styles from "./organization-sidebar.module.css";

export default function OrganizationPortalHeader({ organization, activePage, onBrandChanged, previewMode = false }) {
  const { t, lang, switchLang } = useI18n();
  const { theme, setTheme, mounted } = useTheme();
  const router = useRouter();
  const [editingBranding, setEditingBranding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const navigationId = useId();
  const themeMenu = useRef(null);
  useEffect(() => {
    const dismiss = (event) => {
      if (!themeMenu.current?.contains(event.target)) themeMenu.current?.removeAttribute("open");
    };
    const escape = (event) => {
      if (event.key === "Escape" && themeMenu.current?.open) {
        themeMenu.current.removeAttribute("open");
        themeMenu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, []);
  const branding = resolveOrganizationPortalBranding(organization);
  const initials = branding.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const brandStyle = branding.primaryColor ? {
    "--brand-orange": branding.primaryColor,
    "--accent": branding.primaryColor,
    "--brand-gradient": branding.primaryColor,
  } : undefined;
  const base = `/o/${encodeURIComponent(organization.code)}`;
  const route = (path) => previewMode ? `${path}?preview=1` : path;
  const items = [
    { key: "home", href: base, icon: Home, label: t("common.organizationPortal.home") },
    ...(organization.modules?.includes("programs") ? [{ key: "programs", href: `${base}/programs`, icon: BookOpen, label: t("common.organizationPortal.programmes") }] : []),
    ...(organization.modules?.includes("lms") ? [{ key: "lms", href: `${base}/lms`, icon: GraduationCap, label: t("common.organizationPortal.module.lms") }] : []),
    ...(organization.modules?.includes("venture") ? [{ key: "venture", href: `${base}/venture`, icon: BriefcaseBusiness, label: t("common.organizationPortal.module.venture") }] : []),
  ];
  const ThemeIcon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutFailed(false);
    try {
      const response = await fetch("/api/auth/session-logout", { method: "POST", cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("Logout refused");
      clearResponseCache();
      setDashboardSession(null);
      try {
        // Remove account/context state while retaining the two display choices.
        localStorage.clear();
        localStorage.setItem("impactos_lang", lang);
        localStorage.setItem("impactos_theme", theme);
      } catch { /* Server session revocation remains authoritative. */ }
      window.location.replace("/login");
    } catch {
      setLogoutFailed(true);
      setLoggingOut(false);
    }
  }

  return <>
    <header className={styles.topbar} style={brandStyle}>
      <div className={styles.breadcrumb}>
        <span className="truncate">{branding.displayName}</span>
        <span aria-hidden="true">/</span>
        <span className="truncate text-[var(--text-primary)]">{items.find((item) => item.key === activePage)?.label || t(activePage === "profile" ? "common.workspaces.profile" : "common.organizationPortal.clientSpace")}</span>
      </div>
      <div className={styles.toolbar}>
        <details ref={themeMenu} className={styles.themeMenu}>
          <summary className={styles.toolButton} aria-label={t("common.organizationPortal.appearance")}
            title={t("common.organizationPortal.appearance")} onClick={(event) => { if (!mounted) event.preventDefault(); }}>
            <ThemeIcon size={17} aria-hidden="true" /><ChevronDown size={12} aria-hidden="true" />
          </summary>
          <div className={styles.themeOptions}>
            {[{ value: "dark", icon: Moon }, { value: "light", icon: Sun }, { value: "system", icon: Monitor }].map(({ value, icon: Icon }) => (
              <button key={value} type="button" className={styles.themeOption} aria-pressed={theme === value}
                onClick={() => { setTheme(value); themeMenu.current?.removeAttribute("open"); themeMenu.current?.querySelector("summary")?.focus(); }}>
                <Icon size={16} aria-hidden="true" /><span>{t(`common.theme.${value}`)}</span>
                {theme === value && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </details>
        <button type="button" className={`${styles.toolButton} ${styles.languageButton}`} onClick={() => switchLang(lang === "fr" ? "en" : "fr")}
          aria-label={`${t("common.language")} : ${t(lang === "fr" ? "common.organizationPortal.english" : "common.organizationPortal.french")}`}
          title={t("common.language")}>
          {lang.toUpperCase()}
        </button>
      </div>
    </header>
    <aside data-organization-sidebar className={styles.sidebar} style={brandStyle} aria-label={t("common.organizationPortal.navigation")}>
      <div className={styles.brand}>
        {branding.logoUrl
          ? <AppImage src={branding.logoUrl} alt={branding.displayName} width={44} height={44} className="h-11 w-11 shrink-0 rounded-lg object-contain" />
          : <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-orange)] text-sm font-black text-white">{initials}</span>}
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[var(--text-primary)]">{branding.displayName}</p>
          <p className="text-xs text-[var(--text-secondary)]">{t("common.organizationPortal.clientSpace")}</p>
        </div>
        <AppButton variant="ghost" className={styles.mobileToggle} aria-expanded={menuOpen} aria-controls={navigationId}
          aria-label={t(menuOpen ? "common.close" : "common.organizationPortal.openNavigation")} onClick={() => setMenuOpen((value) => !value)}>
          {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </AppButton>
      </div>
      <nav id={navigationId} aria-label={t("common.organizationPortal.navigation")} className={`${styles.navigation} ${menuOpen ? styles.menuOpen : ""}`}>
        <div className={styles.primary}>
          {items.map(({ key, href, icon: Icon, label }) => <Link key={key} href={route(href)}
            className={styles.item} aria-current={activePage === key ? "page" : undefined} onClick={() => setMenuOpen(false)}>
            <Icon size={19} aria-hidden="true" /><span>{label}</span>
          </Link>)}
        </div>
        <div className={styles.utility}>
          {!previewMode && <Link href="/o/profile" className={styles.item} aria-current={activePage === "profile" ? "page" : undefined}
            onClick={() => setMenuOpen(false)}><UserRound size={19} aria-hidden="true" /><span>{t("common.workspaces.profile")}</span></Link>}
          {(organization.brandingEditable || !previewMode) && <details className={styles.settings}>
            <summary className={styles.item}><Settings size={19} aria-hidden="true" /><span>{t("common.organizationPortal.settings")}</span><ChevronDown size={16} aria-hidden="true" className={styles.chevron} /></summary>
            <div className={styles.submenu}>
              {organization.brandingEditable && <AppButton variant="ghost" icon={Palette} className={styles.settingAction}
                onClick={() => { setEditingBranding(true); setMenuOpen(false); }}>{t("common.organizationPortal.brandingSettings")}</AppButton>}
              {!previewMode && <AppButton variant="ghost" icon={ArrowLeftRight} className={styles.settingAction}
                onClick={() => { setMenuOpen(false); router.push("/o/select"); }}>{t("common.organizationPortal.change")}</AppButton>}
            </div>
          </details>}
          {!previewMode && <AppButton variant="ghost" icon={LogOut} className={styles.logout}
            loading={loggingOut} onClick={logout}>{t("common.workspaces.logout")}</AppButton>}
          {logoutFailed && <p role="alert" className="px-3 text-sm text-[var(--text-secondary)]">{t("common.organizationPortal.logoutFailed")}</p>}
        </div>
      </nav>
    </aside>
    {editingBranding && <OrganizationBrandingEditor organization={organization} onClose={() => setEditingBranding(false)}
      onSaved={() => { setEditingBranding(false); onBrandChanged(); }} />}
  </>;
}
