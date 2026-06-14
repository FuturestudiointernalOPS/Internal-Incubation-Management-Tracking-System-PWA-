"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProgramListing from "@/components/dashboard/ProgramListing";

/**
 * PARTICIPANT PROGRAMS PAGE
 *
 * Shows all programs the participant is enrolled in with progress cards.
 * Click on a program to see its full detail view.
 */
export default function ParticipantProgramsPage() {
  const [user, setUser] = useState({});
  const { t } = useI18n();

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(sessionUser);
  }, []);

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6">
        <ProgramListing />
      </div>
    </DashboardLayout>
  );
}
