"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const NAV_COUNT_KEY = "impactos_inapp_nav_count";

/**
 * Marks that a client-side in-app navigation occurred.
 * Called by <NavigationTracker /> on every route change.
 */
export function trackInAppNavigation() {
  if (typeof window === "undefined") return;
  try {
    const count = Number(sessionStorage.getItem(NAV_COUNT_KEY) || "0");
    sessionStorage.setItem(NAV_COUNT_KEY, String(count + 1));
  } catch {
    /* storage unavailable — fall back to history.length only */
  }
}

/** True when the user has visited at least 2 pages inside the app. */
export function hasInAppHistory() {
  if (typeof window === "undefined") return false;
  try {
    return Number(sessionStorage.getItem(NAV_COUNT_KEY) || "0") > 1;
  } catch {
    return typeof window !== "undefined" && window.history.length > 1;
  }
}

/**
 * Back to the previous in-app page when possible; otherwise go to a
 * known fallback path so the control never dead-ends.
 */
export function goBack(router, fallbackPath) {
  if (hasInAppHistory() && typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    router.push(fallbackPath);
  }
}

/**
 * Mount once in the root layout. Increments the in-app nav counter on every
 * route change so back buttons know whether browser-back stays in the app.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    trackInAppNavigation();
  }, [pathname]);
  return null;
}
