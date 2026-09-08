"use client";

import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * PROGRAM MANAGER DASHBOARD
 *
 * Thin wrapper – delegates all rendering to the role-based UnifiedDashboard.
 * The UnifiedDashboard auto-detects program_manager role and renders
 * program-related widgets alongside project/task/blocker sections.
 */
export default function PMDashboard() {
  return <UnifiedDashboard />;
}
