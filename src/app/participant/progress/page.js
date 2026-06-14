"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProgressView from "@/components/dashboard/ProgressView";

/**
 * PARTICIPANT PROGRESS PAGE
 *
 * Comprehensive progress hub showing all metrics, milestones,
 * and weekly breakdown across all enrolled programs.
 */
export default function ParticipantProgressPage() {
  const [user, setUser] = useState({});

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(stored);
  }, []);

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6">
        <ProgressView />
      </div>
    </DashboardLayout>
  );
}
