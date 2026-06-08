"use client";

import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * STAFF DASHBOARD
 *
 * Thin wrapper – delegates all rendering to the role-based UnifiedDashboard.
 * The UnifiedDashboard auto-detects staff/teacher role and renders only
 * the cards/sections relevant to that user's assignments.
 */
export default function StaffDashboard() {
  return <UnifiedDashboard />;
}
