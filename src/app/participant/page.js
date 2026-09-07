"use client";

import ParticipantDashboardHome from "@/components/dashboard/ParticipantDashboardHome";

/**
 * PARTICIPANT DASHBOARD HOME
 *
 * Landing page for participants. Replaces the generic UnifiedDashboard
 * with a purpose-built guided learning platform experience that answers:
 *   - What should I do today?
 *   - How am I progressing?
 *   - What is happening in my program?
 */
export default function ParticipantDashboardPage() {

  return (
    <>
      <div className="p-6">
        <ParticipantDashboardHome />
      </div>
    </>
  );
}
