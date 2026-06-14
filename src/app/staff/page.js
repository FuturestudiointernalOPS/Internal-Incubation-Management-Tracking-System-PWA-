"use client";

import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * STAFF DASHBOARD
 *
 * Thin wrapper – delegates all rendering to the role-based UnifiedDashboard.
 * The UnifiedDashboard auto-detects staff role and renders
 * task/project/blocker sections relevant to individual contributors.
 */
export default function StaffDashboard() {
  return <UnifiedDashboard />;
}
