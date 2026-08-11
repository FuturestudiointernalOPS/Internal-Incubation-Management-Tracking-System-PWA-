"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StandupRetroView from "@/components/dashboard/StandupRetroView";

export default function StaffTasksPage() {
  const [user, setUser] = useState({});

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(stored);
  }, []);

  return (
    <DashboardLayout role="staff">
      <StandupRetroView
        user={user}
        context={{ context_type: "staff", context_id: null }}
        contextLabel="Future Studio — My Tasks"
      />
    </DashboardLayout>
  );
}
