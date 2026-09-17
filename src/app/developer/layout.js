"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  getDashboardSessionUser,
  getStoredUserOnce,
  subscribeDashboardSession,
} from "@/lib/dashboardSession";

/** The roles this section admits. */
const DEVELOPER_ROLES = ["developer", "super_admin"];

/** A group that also admits, whatever the role says. */
const INTERN_GROUPS = ["FUTURE STUDIO INTERNS", "INTERN"];

/** Where each other role belongs. */
const ROLE_DASHBOARDS = {
  staff: "/staff",
  program_manager: "/pm",
  participant: "/participant",
};

const toShellRole = (role) =>
  role === "super_admin" ? "super_admin" : "developer";

const isInternOf = (groups) =>
  (groups || [])
    .map((g) => String(g).toUpperCase())
    .some((g) => INTERN_GROUPS.includes(g));

// The role the BROWSER can already vouch for: the session the shell has published,
// or the stored copy on a cold load. Read as a store snapshot, which is why the
// guard needs no effect to copy it into state — and why entering /developer still
// paints on the first frame. The check below remains the authority, and it is also
// where the intern GROUP is honoured, exactly as before.
const getRestoredDeveloperRole = () => {
  const role = getDashboardSessionUser()?.role;
  return DEVELOPER_ROLES.includes(role) ? toShellRole(role) : null;
};

const getRestoredRoleOnServer = () => null;

/**
 * DEVELOPER LAYOUT — Role + Group Guard and persistent dashboard shell
 *
 * Allows access to:
 *   - Users with role: developer, super_admin
 *   - Users who belong to the "FUTURE STUDIO INTERNS" group (even if role is staff)
 *
 * Redirects everyone else to their appropriate dashboard. Renders the shared
 * DashboardLayout shell here so it mounts once and survives client-side
 * navigation between developer pages.
 */
export default function DeveloperLayout({ children }) {
  const router = useRouter();
  const restoredRole = useSyncExternalStore(
    subscribeDashboardSession,
    getRestoredDeveloperRole,
    getRestoredRoleOnServer,
  );
  // "developer" | "super_admin" — what the SERVER said, once it has answered.
  const [serverRole, setServerRole] = useState(null);
  // The server's word is the authority; the browser's is the first paint.
  const sessionRole = serverRole || restoredRole;

  useEffect(() => {
    async function checkAccess() {
      let answered = false;
      try {
        // Try session API first
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        answered = true;
        if (data.authenticated && data.user) {
          const role = data.user.role;

          // The cached copy restored above is only a first-paint shortcut. Now
          // that the server has answered it is the authority, so refresh the
          // cache with what it says.
          try {
            const cached = JSON.parse(localStorage.getItem("user") || "null");
            if (cached) {
              localStorage.setItem(
                "user",
                JSON.stringify({ ...cached, ...data.user }),
              );
            }
          } catch (_) {}

          // Check group membership for interns
          let userGroups = [];
          try {
            const groupsRes = await fetch(
              `/api/user-groups?user_cid=${data.user.cid}`,
            );
            const groupsData = await groupsRes.json();
            if (groupsData.success) userGroups = groupsData.groups;
          } catch (_) {}

          const isIntern = isInternOf(userGroups);

          if (DEVELOPER_ROLES.includes(role) || isIntern) {
            setServerRole(toShellRole(role));
            return;
          }

          // Redirect non-developer users to their correct dashboard
          router.replace(ROLE_DASHBOARDS[role] || "/login");
          return;
        }
      } catch (_) {}

      if (answered) {
        // Definitively no valid session: drop the cached copy so the fallback
        // below cannot resurrect this shell from stale storage.
        try {
          localStorage.removeItem("user");
        } catch (_) {}
      }

      // Fallback: the stored copy alone, read exactly as the fast path reads it -
      // including the intern group, and including where a non-developer is sent.
      const stored = getStoredUserOnce();
      if (stored) {
        if (DEVELOPER_ROLES.includes(stored.role) || isInternOf(stored.groups)) {
          setServerRole(toShellRole(stored.role));
          return;
        }
        router.replace(ROLE_DASHBOARDS[stored.role] || "/login");
        return;
      }

      router.replace("/login");
    }
    checkAccess();
  }, [router]);

  // Show nothing while checking
  if (!sessionRole) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout role={sessionRole}>{children}</DashboardLayout>
  );
}
