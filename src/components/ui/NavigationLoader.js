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
 *
 * The navigation in flight is recorded as the address it STARTED from, and "it
 * has finished" is then DERIVED during render by comparing that address with
 * the current one. The completion therefore costs no state write and cannot
 * cascade a render. What is left in an effect is the two things an effect is
 * for: clearing the timers, and letting the completed bar linger for its exit
 * animation.
 */
export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() || "";
  const address = query ? `${pathname}?${query}` : pathname;

  // The address the in-flight navigation started from, or null when there is
  // none. Read from the browser rather than from the render, because the click
  // that starts a navigation is handled by a listener that outlives a render.
  const [startedFrom, setStartedFrom] = useState(null);
  const [progress, setProgress] = useState(0);
  // Grace period before the bar shows: quick navigations never display it.
  const pendingRef = useRef(null);
  const safetyRef = useRef(null);
  const animRef = useRef(null);

  // Detect internal link clicks → start loading. The three helpers live INSIDE
  // this effect because it is their only caller: the listener is attached once,
  // and they read the timers through refs and write state through the stable
  // setters, so there is nothing here for a dependency list to watch.
  useEffect(() => {
    const cancelPending = () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      pendingRef.current = null;
    };

    const show = (from) => {
      setStartedFrom(from);
      setProgress(15);
      if (safetyRef.current) clearTimeout(safetyRef.current);
      if (animRef.current) clearInterval(animRef.current);
      animRef.current = setInterval(() => {
        setProgress((currentProgress) => (currentProgress < 85 ? currentProgress + 12 : currentProgress));
      }, 180);
      // Safety: never leave the bar stuck if the route never changes.
      safetyRef.current = setTimeout(() => {
        cancelPending();
        setStartedFrom(null);
        setProgress(0);
      }, 6000);
    };

    const start = () => {
      cancelPending();
      const from = `${window.location.pathname}${window.location.search}`;
      // Only start the animation if the route is still loading after the grace
      // period — otherwise fast navigations flash a meaningless progress bar.
      pendingRef.current = setTimeout(() => {
        // A navigation that completed inside the grace period shows nothing.
        if (`${window.location.pathname}${window.location.search}` !== from) return;
        show(from);
      }, 250);
    };

    const onClick = (event) => {
      const link = event.target?.closest?.("a");
      if (!link) return;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
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
  }, []);

  // The navigation is over the moment the address it started from stops being
  // the address on screen. Derived, so arriving costs no render of its own.
  const arrived = startedFrom !== null && startedFrom !== address;

  // Completion: let the bar linger for its exit animation, then clear it. The
  // 100% it shows meanwhile is derived above, not written here.
  useEffect(() => {
    if (!arrived) return;
    if (pendingRef.current) clearTimeout(pendingRef.current);
    pendingRef.current = null;
    if (safetyRef.current) clearTimeout(safetyRef.current);
    if (animRef.current) clearInterval(animRef.current);
    const id = setTimeout(() => {
      setStartedFrom(null);
      setProgress(0);
    }, 250);
    return () => clearTimeout(id);
  }, [arrived]);

  if (startedFrom === null) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1000] h-[3px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full rounded-r-full bg-[var(--brand-orange)] shadow-[0_0_8px_rgba(255,102,0,0.6)] transition-all duration-200 ease-out"
        style={{ width: `${arrived ? 100 : progress}%` }}
      />
    </div>
  );
}
