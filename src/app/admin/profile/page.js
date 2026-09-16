"use client";

import ProfileView from "@/components/dashboard/ProfileView";

/**
 * ADMIN PROFILE — Unified Profile Page
 *
 * All roles share the same ProfileView component.
 * The component auto-detects the user from localStorage
 * and adapts its display accordingly.
 */
export default function AdminProfilePage() {
  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <ProfileView />
      </div>
    </>
  );
}
