"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MessagingChat from "@/components/messaging/MessagingChat";

export default function StaffMessages() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  return (
    <DashboardLayout role={user?.role || "staff"}>
      <MessagingChat role="staff" />
    </DashboardLayout>
  );
}
