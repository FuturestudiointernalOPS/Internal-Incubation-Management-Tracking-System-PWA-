"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * GLOBAL NAVIGATION LOADER
 *
 * Shows a slim progress bar at the top of the screen whenever an internal link
 * click starts a route load that is slow. The bar only appears after a short
 * grace period (~250ms) so fast client-side navigations never flash it, and it
 * disappears once the navigation completes (pathname/search change) or after a
 * safety timeout, so it never stays stuck.
 */
export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  // Grace period before the bar shows: quick navigations never display it.
  const pendingRef = useRef(null);
  const safetyRef = useRef(null);
  const animRef = useRef(null);

  const cancelPending = () => {
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = null;
  };

  const finish = () => {
    cancelPending();
    if (safetyRef.current) clearTimeout(safetyRef.current);
    if (animRef.current) clearInterval(animRef.current);
    setProgress(100);
    safetyRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  };

  const show = () => {
    setVisible(true);
    setProgress(15);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    if (animRef.current) clearInterval(animRef.current);
    animRef.current = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 12 : p));
    }, 180);
    // Safety: never leave the bar stuck if the route never changes
    safetyRef.current = setTimeout(finish, 6000);
  };

  const start = () => {
    cancelPending();
    // Only start the animation if the route is still loading after the grace
    // period — otherwise fast navigations flash a meaningless progress bar.
    pendingRef.current = setTimeout(show, 250);
  };

  // Detect internal link clicks → start loading
  useEffect(() => {
    const onClick = (e) => {
      const link = e.target?.closest?.("a");
      if (!link) return;
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      )
        return;
      if (link.target && link.target !== "_self") return;
      const href = link.getAttribute("href") || "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("http://") ||
        href.startsWith("https://")
      )
        return;
      // Skip clicks on the current URL (no navigation happens)
      try {
        const target = new URL(href, window.location.href);
        const current = new URL(window.location.href);
        if (
          target.pathname === current.pathname &&
          target.search === current.search
        )
          return;
      } catch (_) {}
      start();
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      cancelPending();
      if (safetyRef.current) clearTimeout(safetyRef.current);
      if (animRef.current) clearInterval(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation completed (route or query changed) → finish
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1000] h-[3px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-r-full bg-[var(--brand-orange)] shadow-[0_0_8px_rgba(255,102,0,0.6)] transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
