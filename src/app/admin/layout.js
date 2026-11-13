"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getDashboardSessionUser, subscribeDashboardSession } from "@/lib/dashboardSession";
import { spaceForRole, spaceHomeForRole } from "@/spaces/registry";
import { roleHomeHref } from "@/models/platform/roles";

// The role the BROWSER can already vouch for: the session the shell has published,
// or the stored copy on a cold load. Read as a store snapshot, which is why the
// guard needs no effect to copy it into state — and why entering /admin still
// paints on the first frame. The check below remains the authority.
//
// Which identity belongs to the admin space is a REGISTRY question, not a list
// kept here: `spaceForRole` is the one mapping, and the platform owner is simply
// the identity that map sends to `admin`.
const getRestoredAdminRole = () => {
  const role = getDashboardSessionUser()?.role;
  return spaceForRole(role) === "admin" ? role : null;
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
        const response = await fetch("/api/auth/session");
        const data = await response.json();
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
          if (spaceForRole(role) === "admin") {
            setServerRole(role);
            return;
          }
          // Redirect identities that do not belong to the admin space to their
          // own home. The destination is the one the login already computed
          // (role home, then the space home); the neutral hub is the last resort,
          // so a signed-in person is never sent back to the login form.
          const dest =
            roleHomeHref(role) || spaceHomeForRole(role) || (role ? "/member" : "/login");
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
