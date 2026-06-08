"use client";

import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * ADMIN / SUPER ADMIN DASHBOARD
 *
 * Thin wrapper – delegates all rendering to the role-based UnifiedDashboard.
 * The UnifiedDashboard auto-detects the user's role from the session and
 * renders the appropriate sections.
 */
export default function AdminDashboard() {
  return <UnifiedDashboard />;
}
