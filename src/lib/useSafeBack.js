/**
 * useSafeBack — back navigation that always works.
 *
 * Uses the in-app page stack (see src/lib/navigation.js, maintained by
 * <NavigationTracker /> in the root layout): goes to the previously visited
 * in-app page when one exists, otherwise to a stable fallback (the parent
 * menu) — the control never dead-ends and never leaves the app.
 */
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { getPreviousPath } from "@/lib/navigation";

export function useSafeBack(fallbackPath) {
  const router = useRouter();
  const pathname = usePathname();

  const goBack = useCallback(() => {
    if (typeof window === "undefined") return;
    const prev = getPreviousPath(pathname);
    if (prev && prev !== pathname) {
      router.push(prev);
    } else if (fallbackPath) {
      router.push(fallbackPath);
    }
  }, [router, pathname, fallbackPath]);

  return goBack;
}

export default useSafeBack;
