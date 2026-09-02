"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";

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
  // "developer" | "super_admin" — the role authorized to view this section.
  const [sessionRole, setSessionRole] = useState(null);

  const toShellRole = (role) =>
    role === "super_admin" ? "super_admin" : "developer";

  // Optimistic fast-path: restore a cached session before first paint so
  // entering /developer never flashes a blank screen. checkAccess() below
  // still re-validates against the server and redirects if invalid.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === "developer" || u.role === "super_admin") {
          setSessionRole(toShellRole(u.role));
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

          // Check group membership for interns
          let userGroups = [];
          try {
            const groupsRes = await fetch(
              `/api/user-groups?user_cid=${data.user.cid}`,
            );
            const groupsData = await groupsRes.json();
            if (groupsData.success) userGroups = groupsData.groups;
          } catch (_) {}

          const isIntern = userGroups.some(
            (g) =>
              g.toUpperCase() === "FUTURE STUDIO INTERNS" ||
              g.toUpperCase() === "INTERN",
          );

          if (role === "developer" || role === "super_admin" || isIntern) {
            setSessionRole(toShellRole(role));
            return;
          }

          // Redirect non-developer users to their correct dashboard
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

      // Fallback: check localStorage
      try {
        const saved = localStorage.getItem("user");
        if (saved) {
          const u = JSON.parse(saved);
          const groups = u.groups || [];
          const isIntern = groups.some(
            (g) =>
              g.toUpperCase() === "FUTURE STUDIO INTERNS" ||
              g.toUpperCase() === "INTERN",
          );

          if (u.role === "developer" || u.role === "super_admin" || isIntern) {
            setSessionRole(toShellRole(u.role));
            return;
          }
          const redirectMap = {
            staff: "/staff",
            program_manager: "/pm",
            teacher: "/teacher",
            participant: "/participant",
          };
          const dest = redirectMap[u.role] || "/login";
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
    <DashboardLayout role={sessionRole}>{children}</DashboardLayout>
  );
}
