"use client";

import ProfileView from "@/components/dashboard/ProfileView";

/**
 * FACILITATOR PROFILE — Unified Profile Page
 *
 * All roles share the same ProfileView component.
 */
export default function FacilitatorProfilePage() {
  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <ProfileView />
      </div>
    </>
  );
}
