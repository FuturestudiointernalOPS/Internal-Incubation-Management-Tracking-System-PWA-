"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AssignmentsView from "@/components/dashboard/AssignmentsView";

/**
 * PARTICIPANT ASSIGNMENTS PAGE
 *
 * Centralized view of all assignments across programs
 * with submission, status tracking, and filtering.
 */
export default function ParticipantAssignmentsPage() {
  const [user, setUser] = useState({});

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(stored);
  }, []);

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6">
        <AssignmentsView />
      </div>
    </DashboardLayout>
  );
}
