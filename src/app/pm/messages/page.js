"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MessagingChat from "@/components/messaging/MessagingChat";

export default function PmMessages() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(u);
  }, []);

  return (
    <DashboardLayout role={user?.role || "program_manager"}>
      <MessagingChat role="program_manager" />
    </DashboardLayout>
  );
}
