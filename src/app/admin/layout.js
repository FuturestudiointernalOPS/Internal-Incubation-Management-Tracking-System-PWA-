"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getDashboardSessionUser, subscribeDashboardSession } from "@/lib/dashboardSession";

/** The roles this section admits. */
const ADMIN_ROLES = ["super_admin"];

// The role the BROWSER can already vouch for: the session the shell has published,
// or the stored copy on a cold load. Read as a store snapshot, which is why the
// guard needs no effect to copy it into state — and why entering /admin still
// paints on the first frame. The check below remains the authority.
const getRestoredAdminRole = () => {
  const role = getDashboardSessionUser()?.role;
  return ADMIN_ROLES.includes(role) ? role : null;
};

const getRestoredRoleOnServer = () => null;

/**
 * ADMIN LAYOUT — Role Guard + persistent dashboard shell
 *
 * Blocks non-super_admin users from accessing /admin/* routes
 * and redirects them to their appropriate dashboard.
 *
 * Renders the shared DashboardLayout shell here — not inside each page — so
 * the sidebar mounts ONCE and survives client-side navigation between admin
 * pages (no remount, no re-fetch of the auth chain on every link click).
 */
export default function AdminLayout({ children }) {
  const router = useRouter();
  const restoredRole = useSyncExternalStore(
    subscribeDashboardSession,
    getRestoredAdminRole,
    getRestoredRoleOnServer,
  );
  // "super_admin" — what the SERVER said, once it has answered.
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
          // The cached copy restored above is only a first-paint shortcut. Now
          // that the server has answered it is the authority, so refresh the
          // cache with what it says: otherwise a role changed server-side keeps
          // resurrecting this shell from stale storage on the next visit.
          try {
            const cached = JSON.parse(localStorage.getItem("user") || "null");
            if (cached) {
              localStorage.setItem(
                "user",
                JSON.stringify({ ...cached, ...data.user }),
              );
            }
          } catch (_) {}
          const role = data.user.role;
          if (ADMIN_ROLES.includes(role)) {
            setServerRole(role);
            return;
          }
          // Redirect non-admin users to their correct dashboard
          const redirectMap = {
            staff: "/staff",
            program_manager: "/pm",
            participant: "/participant",
          };
          const dest = redirectMap[role] || "/login";
          router.replace(dest);
          return;
        }
      } catch (_) {}

      if (answered) {
        // Definitively no valid session: drop the cached copy so the optimistic
        // fast-path can never paint this shell again.
        try {
          localStorage.removeItem("user");
        } catch (_) {}
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
    <DashboardLayout role="super_admin">
      {children}
    </DashboardLayout>
  );
}
