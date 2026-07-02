"use client";

import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * DEVELOPER DASHBOARD
 *
 * Thin wrapper – delegates all rendering to the role-based UnifiedDashboard.
 * The UnifiedDashboard auto-detects developer role and renders
 * task/project/blocker sections relevant to individual contributors.
 */
export default function DeveloperDashboard() {
  return <UnifiedDashboard />;
}
