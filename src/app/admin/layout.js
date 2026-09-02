"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * ADMIN LAYOUT — Role Guard + persistent dashboard shell
 *
 * Blocks non-super_admin / non-developer users from accessing /admin/* routes
 * and redirects them to their appropriate dashboard.
 *
 * Renders the shared DashboardLayout shell here — not inside each page — so
 * the sidebar mounts ONCE and survives client-side navigation between admin
 * pages (no remount, no re-fetch of the auth chain on every link click).
 */
export default function AdminLayout({ children }) {
  const router = useRouter();
  // "super_admin" | "developer" — the role authorized to view this section.
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
        // Try session API first
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated && data.user) {
          const role = data.user.role;
          if (role === "super_admin" || role === "developer") {
            setSessionRole(role);
            return;
          }
          // Redirect non-admin users to their correct dashboard
          const redirectMap = {
            staff: "/staff",
            program_manager: "/pm",
            teacher: "/teacher",
            participant: "/participant",
          };
          const dest = redirectMap[role] || "/login";
          router.replace(dest);
          return;
        }
      } catch (_) {}

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
    <DashboardLayout
      role={sessionRole === "developer" ? "developer" : "super_admin"}
    >
      {children}
    </DashboardLayout>
  );
}
