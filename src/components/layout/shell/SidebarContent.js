"use client";

import { useI18n } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import {
  HOVER_CAPABLE_QUERY,
  canUseHoverIntent,
  resolveSectionExpanded,
  nextExplicitState,
} from "@/components/layout/sidebarMenu";
import { tnav } from "./navigation";
import { ChevronsLeft, ChevronsRight, User, LogOut, ChevronDown, Globe } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const SidebarContent = ({
  collapsed,
  setCollapsed,
  role,
  navItems,
  openMenus,
  toggleMenu,
  pathname,
  activePathIds,
  setMobileMenuOpen,
  handleLogout,
  t,
  submissionCount,
  unreadByType,
  hasCommunicationActivity,
}) => {
  const { switchLang } = useI18n();
  const profileHref = `/${role === "super_admin" ? "admin" : role === "program_manager" ? "pm" : role === "facilitator" ? "facilitator" : role === "investor" ? "investor" : "participant"}/profile`;

  const [flyout, setFlyout] = useState(null); // { id, top } — collapsed-rail flyout
  const flyoutTimer = useRef(null);
  // Hover-expand state (expanded sidebar): a SINGLE hover target at a time —
  // hovering the next section collapses the previous one (accordion).
  const [hoverMenu, setHoverMenu] = useState(null);
  const hoverTimer = useRef(null);
  // Sections the user closed by clicking. An explicit close must win over the
  // hover intent until the pointer leaves (otherwise "collapse" looks broken).
  const [closedByClick, setClosedByClick] = useState(null);

  // Touch devices fire mouseenter on tap, so hover intent would re-open a
  // section the user just closed. Unknown capability = keep desktop behaviour.
  const pointerCanHover = () =>
    canUseHoverIntent(
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia(HOVER_CAPABLE_QUERY).matches
        : undefined,
    );

  // Clear pending hover/flyout timers on unmount.
  useEffect(
    () => () => {
      clearTimeout(hoverTimer.current);
      clearTimeout(flyoutTimer.current);
    },
    [],
  );

  const label = (item) =>
    item.id?.startsWith("prog_")
      ? item.name
      : t(tnav(item.id)) || item.name;

  const openFlyout = (event, id) => {
    clearTimeout(flyoutTimer.current);
    setFlyout({ id, top: event.currentTarget.getBoundingClientRect().top });
  };
  const scheduleFlyoutClose = () => {
    clearTimeout(flyoutTimer.current);
    flyoutTimer.current = setTimeout(() => setFlyout(null), 200);
  };
  // Hover intent for the expanded sidebar: open after a short delay (prevents
  // flicker when crossing adjacent items), close after the same 200ms delay
  // used by the collapsed-rail flyout — consistent hover timing everywhere.
  const scheduleHoverOpen = (id) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverMenu(id), 150);
  };
  const scheduleHoverClose = (id) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoverMenu((prev) => (prev === id ? null : prev));
      // The pointer left: a previous explicit close no longer applies.
      setClosedByClick((prev) => (prev === id ? null : prev));
    }, 200);
  };
  // Click on a section header: store the explicit state and remember whether
  // this click was a close, so the hover cannot immediately undo it.
  const toggleSection = (id) => {
    const willOpen = nextExplicitState(openMenus[id]);
    toggleMenu(id);
    setClosedByClick(willOpen ? null : id);
  };
  // A section stays expanded while the hover target is itself or any of its
  // descendants — hovering a nested parent keeps its ancestors open.
  const isHoverTarget = (item, id) => {
    if (!id) return false;
    if (item.id === id) return true;
    const childItems = item.children || item.subItems;
    return !!childItems && childItems.some((childItem) => isHoverTarget(childItem, id));
  };

  // Recursive nav renderer: a node with children renders as an expandable
  // group; a node without children renders as a link (leaf). showLabels forces
  // labels/chevrons visible even when the rail is collapsed (flyout usage).
  const renderNavItem = (item, depth, showLabels) => {
    const childItems = item.children || item.subItems;
    const hasKids = Array.isArray(childItems) && childItems.length > 0;
    const isTop = depth === 0;
    const onPath = activePathIds.has(item.id);
    const show = !collapsed || showLabels;

    if (hasKids) {
      const isOpen = openMenus[item.id] || false;
      const expanded = resolveSectionExpanded({
        open: isOpen,
        hovered: isHoverTarget(item, hoverMenu),
        closedByClick: closedByClick === item.id,
      });
      return (
        <div
          key={item.id}
          className="space-y-1"
          onMouseLeave={
            collapsed ? undefined : () => scheduleHoverClose(item.id)
          }
        >
          <button
            onClick={() => toggleSection(item.id)}
            aria-expanded={expanded}
            aria-label={show ? undefined : label(item)}
            onMouseEnter={
              collapsed && !showLabels
                ? (event) => openFlyout(event, item.id)
                : collapsed
                  ? undefined
                  : () => {
                      if (pointerCanHover()) scheduleHoverOpen(item.id);
                    }
            }
            onMouseLeave={
              collapsed && !showLabels ? scheduleFlyoutClose : undefined
            }
            className={`w-full flex items-center transition-all ${show ? "justify-between" : "justify-center"} ${
              isTop
                ? `${show ? "px-4" : "px-0"} py-3 rounded-xl text-[13px] font-semibold`
                : "px-4 py-2 rounded-lg text-[13px] font-medium"
            } ${
              onPath
                ? "text-[var(--text-primary)] bg-tertiary border border-[var(--border-secondary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                {item.icon && (
                  <item.icon
                    className={`w-4 h-4 flex-shrink-0 ${onPath ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                  />
                )}
                {item.id === "communication" && hasCommunicationActivity && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />
                )}
              </div>
              {show && <span className="truncate">{label(item)}</span>}
            </div>
            {show && item.id === "programs" && submissionCount > 0 && (
              <span className="text-[8px] font-black bg-[var(--brand-orange)] text-black px-1.5 py-0.5 rounded-full mr-2">
                {submissionCount}
              </span>
            )}
            {show && item.id === "communication" && hasCommunicationActivity && (
              <span className="w-2 h-2 rounded-full bg-[var(--brand-orange)] shrink-0" />
            )}
            {show && (
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            )}
          </button>
          {expanded && show && (
            <div className={`space-y-1 py-1 ${isTop ? "pl-8" : "pl-6"}`}>
              {childItems.map((childItem) => renderNavItem(childItem, depth + 1, showLabels))}
            </div>
          )}
        </div>
      );
    }

    const isActive = pathname === item.href;
    return (
      <Link
        key={item.id || item.href}
        href={item.href}
        aria-label={show ? undefined : label(item)}
        onClick={() => {
          setMobileMenuOpen(false);
          setFlyout(null);
        }}
        className={`w-full flex items-center transition-all ${show ? "" : "justify-center"} ${
          isTop
            ? `${show ? "gap-4 px-4" : "px-0"} py-3 rounded-xl text-[13px] font-semibold`
            : "gap-3 px-4 py-2 rounded-lg text-[13px] font-medium"
        } ${
          isActive
            ? "text-[var(--brand-orange)] bg-tertiary border border-[var(--border-secondary)]"
            : onPath
              ? "text-[var(--text-primary)] bg-tertiary border border-[var(--border-secondary)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
        }`}
      >
        {item.icon && (
          <item.icon
            className={`w-4 h-4 flex-shrink-0 ${isActive || onPath ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
          />
        )}
        {show && <span className="truncate">{label(item)}</span>}
        {show && unreadByType && unreadByType[item.id] > 0 && (
          <span className="ml-auto w-5 h-5 rounded-full bg-[var(--brand-orange)] text-black text-[8px] font-black flex items-center justify-center shrink-0">
            {unreadByType[item.id]}
          </span>
        )}
      </Link>
    );
  };
  return (
    <>
      <div
        className={`px-3 mb-14 mt-4 ${
          collapsed ? "flex flex-col items-center gap-3" : "flex items-center gap-4"
        }`}
      >
        {collapsed ? (
          <Image
            src="/icon-192x192.png"
            alt="Future Studio"
            width={192}
            height={192}
            className="w-8 h-8 object-contain"
          />
        ) : (
          <Image
            src="/brand/logo_full.png"
            alt="Future Studio"
            width={1018}
            height={1024}
            className="h-8 w-auto object-contain animate-in fade-in"
          />
        )}
        {/* The rail can always be reopened, so the control is present in both
            widths: beside the logo when open, under the mark when collapsed. */}
        <button
          type="button"
          onClick={() => setCollapsed((previousCollapsed) => !previousCollapsed)}
          aria-label={t(
            collapsed ? "navigation.expandSidebar" : "navigation.collapseSidebar",
          )}
          title={t(
            collapsed ? "navigation.expandSidebar" : "navigation.collapseSidebar",
          )}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-colors ${
            collapsed ? "" : "ml-auto"
          }`}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <ChevronsLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 mb-4">
          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] opacity-40">
            {t("navigation.mainOperations")}
          </p>
        </div>
      )}

      <nav className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1">
        {(navItems || []).map((item) => renderNavItem(item, 0, false))}
      </nav>

      {/* Collapsed-rail flyout: reach a section's children from the icon rail */}
      {collapsed && flyout && (() => {
        const parent = (navItems || []).find((navItem) => navItem.id === flyout.id);
        if (!parent) return null;
        const childItems = parent.children || parent.subItems || [];
        return (
          <div
            className="fixed z-[120] w-64 max-h-[70vh] overflow-y-auto rounded-xl bg-secondary border border-[var(--border-primary)] p-2 shadow-xl"
            style={{ left: 76, top: flyout.top }}
            onMouseEnter={() => clearTimeout(flyoutTimer.current)}
            onMouseLeave={scheduleFlyoutClose}
          >
            <p className="px-3 py-1.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] opacity-40">
              {label(parent)}
            </p>
            {childItems.map((childItem) => renderNavItem(childItem, 1, true))}
          </div>
        );
      })()}

      <div className="mt-auto pt-8 border-t border-[var(--border-secondary)] space-y-3">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] opacity-40">
            {t("navigation.userProtocol")}
          </p>
        )}
        <div className="space-y-1">
          <button
            onClick={() => toggleMenu("profile")}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-semibold text-[13px] ${pathname?.includes("profile") ? "bg-tertiary text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"}`}
          >
            <div className="flex items-center gap-4">
              <User className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{t(tnav("profile"))}</span>}
            </div>
            {!collapsed && (
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMenus["profile"] ? "rotate-180" : ""}`} />
            )}
          </button>
          {openMenus["profile"] && !collapsed && (
            <div className="pl-8 space-y-1 py-1">
              <Link
                href={profileHref}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all font-medium text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
              >
                <span className="truncate">{t(tnav("profile"))}</span>
              </Link>
              <Link
                href={`${profileHref}#timeline`}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all font-medium text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary"
              >
                <span className="truncate">{t(tnav("timeline"))}</span>
              </Link>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (typeof window === "undefined") return;
            const current = localStorage.getItem("impactos_lang") || "en";
            switchLang(current === "en" ? "fr" : "en");
          }}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all font-semibold text-[13px]"
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>FR/EN</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-semibold text-[13px]"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>{t(tnav("logout"))}</span>}
        </button>
      </div>
    </>
  );
};
