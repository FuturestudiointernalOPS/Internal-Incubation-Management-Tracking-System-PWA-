"use client";

import ProgressView from "@/spaces/member/participant/components/ProgressView";

/**
 * PARTICIPANT PROGRESS PAGE
 *
 * Comprehensive progress hub showing all metrics, milestones,
 * and weekly breakdown across all enrolled programs.
 */
export default function ParticipantProgressPage() {
  return (
    <>
      <div className="p-6">
        <ProgressView />
      </div>
    </>
  );
}
