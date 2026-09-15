"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * usePermissions — Client-side hook for unified role & permission checking.
 *
 * Reads the CURRENT user's effective capabilities from /api/me/permissions —
 * the same resolver output the sidebar uses, readable by ANY authenticated
 * session (unlike /api/engineering/permissions, which requires
 * permissions.view_matrix and is therefore admin-only).
 *
 * Provides:
 *   - session      => { cid, name, email, role, group_name } | null
 *   - permissions  => { [module]: { [capability]: level } }   | null
 *   - responsibilities => [{ id, name, key, description, icon }]
 *   - isSuperAdmin => boolean
 *   - loading      => boolean
 *   - error        => string | null
 *   - can(module, capability, minLevel?) => boolean
 *   - hasResponsibility(key)            => boolean
 *   - refresh()    => re-fetches everything
 *
 * UI gating only: the server stays authoritative on every route.
 *
 * Usage:
 *   const { can, loading } = usePermissions();
 *   if (can("lms", "edit")) { ... }   // hide a write affordance
 */
export default function usePermissions() {
  const [session, setSession] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [responsibilities, setResponsibilities] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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
        setIsSuperAdmin(false);
        return;
      }

      const user = sessionData.user;
      setSession(user);

      // 2. Fetch the current user's effective capabilities (self-read).
      try {
        const permRes = await fetch("/api/me/permissions");
        const permData = await permRes.json();
        if (permData.success) {
          setPermissions(permData.effective || null);
          setIsSuperAdmin(Boolean(permData.isSuperAdmin));
        } else {
          setPermissions(null);
        }
      } catch {
        setPermissions(null);
      }

      // 3. Fetch responsibilities
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
   * A Super Admin returns true unless explicitly restricted (the resolver
   * already baked that in: their effective matrix carries the restrictions).
   */
  const can = useCallback(
    (module, capability, minLevel = 1) => {
      if (isSuperAdmin || session?.role === "super_admin") return true;
      if (!permissions) return false;
      const modCaps = permissions[module];
      if (!modCaps) return false;
      return Number(modCaps[capability] || 0) >= minLevel;
    },
    [permissions, session, isSuperAdmin],
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
    isSuperAdmin,
    loading,
    error,
    can,
    hasResponsibility,
    refresh: fetchAll,
  };
}
