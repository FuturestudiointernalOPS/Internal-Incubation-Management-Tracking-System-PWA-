"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  getDashboardSession,
  setDashboardSession,
  subscribeDashboardSession,
} from "@/lib/dashboardSession";
import { useApi } from "@/lib/hooks/useApi";

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

// ─── Read shaping (module scope: built once, never per render) ───────────

const EMPTY_PERMISSIONS_READ = { permissions: null, isSuperAdmin: false };

const pickPermissions = (d) =>
  d?.success
    ? {
        permissions: d.effective || null,
        isSuperAdmin: Boolean(d.isSuperAdmin),
      }
    : EMPTY_PERMISSIONS_READ;

// The matrix the shell has already answered with, taken as a snapshot of the
// session cache. That cache IS a store, so reading it needs no effect and no
// copy of its own - and the server snapshot is deliberately null, which is what
// keeps the server's render and the browser's first render identical.
const getCachedCapabilities = () => getDashboardSession()?.capabilities ?? null;
const getCachedCapabilitiesOnServer = () => null;

/** The shared read: the effective matrix + the pure `can` predicate. */
function usePermissionSource(enabled = true) {
  const cached = useSyncExternalStore(
    subscribeDashboardSession,
    getCachedCapabilities,
    getCachedCapabilitiesOnServer,
  );

  const {
    data,
    loading: readLoading,
    error,
    refresh: readRefresh,
  } = useApi(enabled ? "/api/me/permissions" : null, {
    defaultValue: EMPTY_PERMISSIONS_READ,
    transform: pickPermissions,
  });

  // The read's own verdict once it has one, and the shell's cached matrix until
  // then - which is what keeps the sidebar from flashing the fail-open role menu
  // on every navigation. A request that THREW leaves the cached matrix standing,
  // which is what the loader did by not clearing it in its catch.
  const answered = enabled && !readLoading;
  const permissions = !enabled
    ? null
    : answered && !error
      ? data.permissions
      : cached;
  const isSuperAdmin = answered && !error ? data.isSuperAdmin : false;
  const loading = !enabled || !answered;

  // A refresh whose identity does not change from render to render. The read's
  // own refresh is rebuilt by the hook on every render, and a context value that
  // changed with it would re-render every consumer of the matrix - the shell, and
  // every screen that gates an action on a capability - for no reason.
  const readRefreshRef = useRef(readRefresh);
  useEffect(() => {
    readRefreshRef.current = readRefresh;
  });
  const refresh = useCallback(() => readRefreshRef.current(), []);

  // Publish the answer into the shell's session cache, so a remount paints the
  // real matrix immediately instead of the fail-open menu. It writes an EXTERNAL
  // store rather than this provider's state, so it cascades no render here.
  useEffect(() => {
    if (!enabled || !answered || error) return;
    const current = getDashboardSession() || {};
    setDashboardSession({ ...current, capabilities: data.permissions });
  }, [enabled, answered, error, data.permissions]);

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
