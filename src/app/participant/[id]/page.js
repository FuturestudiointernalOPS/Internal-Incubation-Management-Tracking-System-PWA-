"use client";

import React, { useState, useEffect, use } from "react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProgramDetail from "@/components/dashboard/ProgramDetail";

/**
 * PARTICIPANT PROGRAM DETAIL PAGE
 *
 * Shows full program detail including curriculum, resources, progress,
 * facilitators, and submission history.
 */
export default function ParticipantProgramDetailPage({ params }) {
  const unwrapped = use(params);
  const programId = unwrapped.id;
  const [user, setUser] = useState(null);
  const { t } = useI18n();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(storedUser);
  }, []);

  return (
    <DashboardLayout role={user?.role || "participant"}>
      <div className="p-6">
        <ProgramDetail programId={programId} />
      </div>
    </DashboardLayout>
  );
}
