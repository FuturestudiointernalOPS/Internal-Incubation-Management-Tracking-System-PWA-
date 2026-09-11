"use client";

import React from "react";
import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";

/**
 * STAFF DASHBOARD — the ONE dashboard for this surface.
 *
 * The calendar page. There used to be a second dashboard ("My Dashboard" →
 * /staff/me) with its own calendar, notifications and ventures list; it is gone
 * (/staff/me forwards here). Contexts do NOT add cards to this page either:
 * navigation is a SIDEBAR addition (see DashboardLayout), so clicking "My
 * Ventures" opens ALL ventures on its own page.
 *
 *   sidebar  → the doors (My Ventures, Programs, …) — added when assigned
 *   dashboard → the calendar and the work
 */
export default function StaffDashboard() {
  return <UnifiedDashboard />;
}
