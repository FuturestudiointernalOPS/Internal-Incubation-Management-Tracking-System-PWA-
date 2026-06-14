"use client";

import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * PARTICIPANT DASHBOARD
 *
 * Thin wrapper – delegates all rendering to the role-based UnifiedDashboard.
 * Shows calendar, upcoming sessions, pending submissions, and enrolled programs.
 */
export default function ParticipantDashboard() {
  return <UnifiedDashboard />;
}
