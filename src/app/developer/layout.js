"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * DEVELOPER LAYOUT — Role Guard
 *
 * Blocks non-developer/intern users from accessing /developer/* routes
 * and redirects them to their appropriate dashboard.
 */
export default function DeveloperLayout({ children }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      try {
        // Try session API first
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated && data.user) {
          const role = data.user.role;
          if (role === "developer" || role === "intern" || role === "super_admin") {
            setAuthorized(true);
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
          if (u.role === "developer" || u.role === "intern" || u.role === "super_admin") {
            setAuthorized(true);
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
  if (!authorized) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
