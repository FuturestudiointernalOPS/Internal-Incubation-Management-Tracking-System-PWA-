"use client";

import React from "react";
import UnifiedDashboard from "@/components/dashboard/UnifiedDashboard";
import ContextCardsPanel from "@/components/dashboard/ContextCardsPanel";

/**
 * STAFF DASHBOARD — the ONE dashboard for this surface.
 *
 * There used to be a second one ("My Dashboard" → /staff/me) with its own
 * calendar, notifications and ventures list, and a third destination for
 * ventures. All of that is gone: this is the dashboard that owns the calendar,
 * and the contexts someone holds are added to it as stat cards.
 *
 *   ContextCardsPanel → only the relationships this person actually has
 *                       (programs, ventures, learning) — nothing when none
 *   UnifiedDashboard  → the calendar and the work sections
 *
 * Personal blocks that would duplicate this page (the personal-mode calendar,
 * the notifications feed — the header bell already covers notifications) are
 * not repeated here. /staff/me redirects into this page.
 */
export default function StaffDashboard() {
  return (
    <div className="space-y-6">
      <ContextCardsPanel />
      <UnifiedDashboard />
    </div>
  );
}
