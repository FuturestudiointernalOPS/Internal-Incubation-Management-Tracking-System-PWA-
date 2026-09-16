"use client";

import RitualsView from "@/components/dashboard/RitualsView";

/**
 * PARTICIPANT RITUALS PAGE
 *
 * Standups, check-ins, retrospectives, and reflections.
 */
export default function ParticipantRitualsPage() {
  return (
    <>
      <div className="p-6">
        <RitualsView />
      </div>
    </>
  );
}
