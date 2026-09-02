"use client";

import { useState, useEffect } from "react";
import ProfileView from "@/components/dashboard/ProfileView";

/**
 * PM PROFILE — Unified Profile Page
 *
 * All roles share the same ProfileView component.
 */
export default function PMProfilePage() {
  const [role, setRole] = useState("program_manager");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored.role) setRole(stored.role);
    } catch (_) {}
  }, []);

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <ProfileView />
      </div>
    </>
  );
}
