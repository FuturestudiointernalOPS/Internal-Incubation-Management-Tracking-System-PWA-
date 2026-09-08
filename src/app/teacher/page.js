"use client";

import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * TEACHER DASHBOARD
 *
 * Thin wrapper – delegates all rendering to the role-based UnifiedDashboard.
 * The UnifiedDashboard auto-detects teacher role and renders
 * relevant sections. Teacher-specific features (sessions, reviews)
 * remain accessible via the sidebar.
 */
export default function TeacherDashboard() {
  return <UnifiedDashboard />;
}
