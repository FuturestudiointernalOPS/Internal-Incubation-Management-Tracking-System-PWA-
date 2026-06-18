"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MessagingChat from "@/components/messaging/MessagingChat";

export default function SuperAdminComms() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  return (
    <DashboardLayout role={user?.role || "super_admin"}>
      <MessagingChat role="super_admin" />
    </DashboardLayout>
  );
}
