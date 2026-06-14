"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import ParticipantDashboardHome from "@/components/dashboard/ParticipantDashboardHome";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

  return (
    <DashboardLayout role="participant">
      <div className="p-6">
        <ParticipantDashboardHome />
      </div>
    </DashboardLayout>
  );
}
