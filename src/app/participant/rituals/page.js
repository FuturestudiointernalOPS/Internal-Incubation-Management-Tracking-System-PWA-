"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import RitualsView from "@/components/dashboard/RitualsView";

/**
 * PARTICIPANT RITUALS PAGE
 *
 * Standups, check-ins, retrospectives, and reflections.
 */
export default function ParticipantRitualsPage() {
  const [user, setUser] = useState({});

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(stored);
  }, []);

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6">
        <RitualsView />
      </div>
    </DashboardLayout>
  );
}
