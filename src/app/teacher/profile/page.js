"use client";

import { useState, useEffect } from "react";
import ProfileView from "@/components/dashboard/ProfileView";
import DashboardLayout from "@/components/layout/DashboardLayout";

/**
 * TEACHER PROFILE — Unified Profile Page
 *
 * All roles share the same ProfileView component.
 */
export default function TeacherProfilePage() {
  const [role, setRole] = useState("teacher");

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
