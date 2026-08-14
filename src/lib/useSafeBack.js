/**
 * useSafeBack — back navigation that always works.
 *
 * `router.back()` is only useful when the previous history entry is an
 * in-app page. Uses `hasInAppHistory()` (a sessionStorage counter maintained
 * by <NavigationTracker /> in the root layout) to detect that; otherwise
 * falls back to a stable destination (the parent menu) so a back control
 * always navigates somewhere.
 *
 * Usage:
 *   const goBack = useSafeBack("/admin/crm");
 *   <button onClick={goBack}>Back</button>
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { hasInAppHistory } from "@/lib/navigation";

export function useSafeBack(fallbackPath) {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (hasInAppHistory() && window.history.length > 1) {
      router.back();
    } else if (fallbackPath) {
      router.push(fallbackPath);
    }
  }, [router, fallbackPath]);

  return goBack;
}

export default useSafeBack;
