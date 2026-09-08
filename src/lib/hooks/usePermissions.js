"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * usePermissions — Client-side hook for unified role & permission checking.
 *
 * Provides:
 *   - session      => { cid, name, email, role, group_name } | null
 *   - permissions  => { [module]: { [capability]: level } }   | null
 *   - responsibilities => [{ id, name, key, description, icon }]
 *   - loading      => boolean
 *   - error        => string | null
 *   - can(module, capability, minLevel?) => boolean
 *   - hasResponsibility(key)            => boolean
 *   - refresh()    => re-fetches everything
 *
 * Usage:
 *   const { session, can, loading } = usePermissions();
 *   if (can("engineering", "manage_tasks")) { ... }
 *   if (session?.role === "super_admin") { ... }
 */
export default function usePermissions() {
  const [session, setSession] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [responsibilities, setResponsibilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch session
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();

      if (!sessionData.authenticated || !sessionData.user) {
        setSession(null);
        setPermissions(null);
        setResponsibilities([]);
        return;
      }

      const user = sessionData.user;
      setSession(user);

      // 2. Fetch responsibilities
      try {
        const respRes = await fetch(
          `/api/responsibilities?user_cid=${user.cid}`,
        );
        const respData = await respRes.json();
        if (respData.success) {
          setResponsibilities(respData.responsibilities || []);
        }
      } catch {
        setResponsibilities([]);
      }

      // 3. Fetch permissions (V2 profile-based)
      try {
        const permRes = await fetch(
          `/api/engineering/permissions?user_cid=${user.cid}`,
        );
        const permData = await permRes.json();
        if (permData.success) {
          setPermissions(permData.matrix || permData.permissions || null);
        }
      } catch {
        setPermissions(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Check if the current user has a specific capability.
   * Super admin always returns true unless explicitly restricted.
   */
  const can = useCallback(
    (module, capability, minLevel = 1) => {
      if (!permissions) return false;
      if (session?.role === "super_admin") return true;
      const modCaps = permissions[module];
      if (!modCaps) return false;
      const level = modCaps[capability] || 0;
      return level >= minLevel;
    },
    [permissions, session],
  );

  /**
   * Check if the user has a specific responsibility assigned.
   */
  const hasResponsibility = useCallback(
    (key) => {
      return responsibilities.some((r) => r.key === key);
    },
    [responsibilities],
  );

  return {
    session,
    permissions,
    responsibilities,
    loading,
    error,
    can,
    hasResponsibility,
    refresh: fetchAll,
  };
}
