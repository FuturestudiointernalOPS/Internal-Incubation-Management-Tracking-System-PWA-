"use client";

import { useState, useEffect } from "react";
import ProfileView from "@/components/dashboard/ProfileView";
import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * ADMIN PROFILE — Unified Profile Page
 *
 * All roles share the same ProfileView component.
 * The component auto-detects the user from localStorage
 * and adapts its display accordingly.
 */
export default function AdminProfilePage() {
  const [role, setRole] = useState("super_admin");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored.role) setRole(stored.role);
    } catch (_) {}
  }, []);

  return (
    <DashboardLayout role={role} activeTab="profile">
      <div className="p-6 max-w-5xl mx-auto">
        <ProfileView />
      </div>
    </DashboardLayout>
  );
}
