"use client";

import ProfileView from "@/components/dashboard/ProfileView";

/**
 * PARTICIPANT PROFILE — Unified Profile Page
 *
 * All roles share the same ProfileView component.
 */
export default function ParticipantProfilePage() {
  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        <ProfileView />
      </div>
    </>
  );
}
