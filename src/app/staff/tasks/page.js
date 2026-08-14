"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StandupRetroView from "@/components/dashboard/StandupRetroView";
import { useI18n } from "@/lib/i18n";

export default function StaffTasksPage() {
  const { t } = useI18n();
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
        contextLabel={t("staffMisc.standupRetro.contextLabel")}
      />
    </DashboardLayout>
  );
}
