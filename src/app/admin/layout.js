"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { responsibilityRequiredForPath } from "@/lib/masterNavigation";

/**
 * ADMIN LAYOUT — Section guard + persistent dashboard shell
 *
 * super_admin and developer can open every /admin/* route.
 *
 * Other roles can open an /admin section ONLY when they hold the
 * responsibility that owns the current page (path → responsibility map in
 * masterNavigation.js, the same map the sidebar uses). Page rendering is
 * therefore aligned with what the sidebar shows, and each page's APIs remain
 * the real authorization boundary (requireAuthorization per module/capability).
 * Users without the required responsibility are redirected to their dashboard.
 *
 * Renders the shared DashboardLayout shell here — not inside each page — so
 * the sidebar mounts ONCE and survives client-side navigation between admin
 * pages (no remount, no re-fetch of the auth chain on every link click).
 */
export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  // The rendered session role when access is granted (super_admin, developer,
  // or the user's real role for responsibility-scoped sections).
  const [sessionRole, setSessionRole] = useState(null);

  // Optimistic fast-path: restore a cached admin session before first paint so
  // entering /admin never flashes a blank screen. checkAccess() below still
  // re-validates against the server and redirects if the session is invalid.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === "super_admin" || u.role === "developer") {
          setSessionRole(u.role);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated && data.user) {
          const role = data.user.role;
          if (role === "super_admin" || role === "developer") {
            setSessionRole(role);
            return;
          }
          // Non-admin roles: wait for the pathname, then allow only when the
          // page's owning responsibility is held by the user.
          if (typeof pathname !== "string") return;
          const required = responsibilityRequiredForPath(pathname);
          if (required) {
            const respRes = await fetch(
              `/api/responsibilities?user_cid=${data.user.cid}`,
            );
            const respData = await respRes.json();
            const keys = (respData.responsibilities || []).map((r) => r.key);
            if (keys.includes(required)) {
              setSessionRole(role);
              return;
            }
          }
          // Redirect non-authorized users to their correct dashboard
          const redirectMap = {
            staff: "/staff",
            program_manager: "/pm",
            teacher: "/teacher",
            participant: "/participant",
            developer: "/developer",
          };
          const dest = redirectMap[role] || "/login";
          router.replace(dest);
          return;
        }
      } catch (_) {}

      router.replace("/login");
    }
    checkAccess();
  }, [router, pathname]);

  // Show nothing while checking
  if (!sessionRole) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div
          className="w-8 h-8 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
          style={{
            borderColor: "rgba(255,102,0,0.15)",
            borderTopColor: "var(--brand-orange)",
          }}
        />
      </div>
    );
  }

  return <DashboardLayout role={sessionRole}>{children}</DashboardLayout>;
}
