"use client";

import { useState, useEffect } from "react";
import ProfileView from "@/components/dashboard/ProfileView";

/**
 * DEVELOPER PROFILE — Unified Profile Page
 *
 * All roles share the same ProfileView component.
 */
export default function DeveloperProfilePage() {
  const [role, setRole] = useState("developer");

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
