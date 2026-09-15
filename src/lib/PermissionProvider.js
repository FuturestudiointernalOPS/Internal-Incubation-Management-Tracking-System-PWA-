"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { getDashboardSession, setDashboardSession } from "@/lib/dashboardSession";

/**
 * PermissionProvider — ONE capability read shared by a whole surface.
 *
 * The effective capability matrix is resolved server-side from the identity,
 * the access profile (or the role's default profile), groups, individual
 * grants and restrictions. Several screens need that same answer — the sidebar,
 * and every action that must be hidden when the capability is missing — so it
 * is read ONCE here and shared, instead of each consumer firing its own request
 * and risking a different answer.
 *
 * It deliberately fetches ONLY the capability matrix: the session and the
 * responsibilities already come from the shell's own boot sequence, and asking
 * for them again here would add requests instead of removing them.
 *
 * UI gating only: every route re-authorizes server-side.
 *
 * Usage:
 *   <PermissionProvider>{children}</PermissionProvider>   // once per surface
 *   const { can, loading } = usePermissions();
 */

const PermissionContext = createContext(null); // null = no provider above

/** The shared read: the effective matrix + the pure `can` predicate. */
function usePermissionSource(enabled = true) {
  const [permissions, setPermissions] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/permissions");
      const data = await res.json();
      if (data.success) {
        const caps = data.effective || null;
        setPermissions(caps);
        setIsSuperAdmin(Boolean(data.isSuperAdmin));
        // Publish to the shell cache so a remount paints the real matrix
        // immediately instead of the fail-open role menu.
        const current = getDashboardSession() || {};
        setDashboardSession({ ...current, capabilities: caps });
      } else {
        setPermissions(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fast path: seed from the cached shell session before first paint, then
  // revalidate — the rule that keeps the sidebar from flashing the fail-open
  // role menu on every navigation.
  useLayoutEffect(() => {
    if (typeof window === "undefined" || !enabled) return;
    const cached = getDashboardSession();
    if (cached?.capabilities) setPermissions(cached.capabilities);
  }, [enabled]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  /**
   * Check if the current user has a specific capability.
   * A Super Admin returns true unless explicitly restricted (the resolver
   * already removed those capabilities from their matrix).
   */
  const can = useCallback(
    (module, capability, minLevel = 1) => {
      if (isSuperAdmin) return true;
      const modCaps = permissions?.[module];
      if (!modCaps) return false;
      return Number(modCaps[capability] || 0) >= minLevel;
    },
    [permissions, isSuperAdmin],
  );

  return useMemo(
    () => ({ permissions, isSuperAdmin, loading, error, can, refresh }),
    [permissions, isSuperAdmin, loading, error, can, refresh],
  );
}

export function PermissionProvider({ children }) {
  const value = usePermissionSource(true);
  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * Read the shared capability context.
 *
 * Outside a provider (a standalone screen) the hook keeps working on its own,
 * and when a provider IS present no second request is made — the disabled
 * source below is never fetched.
 */
export function usePermissions() {
  const ctx = useContext(PermissionContext);
  const standalone = usePermissionSource(ctx === null);
  return ctx ?? standalone;
}
