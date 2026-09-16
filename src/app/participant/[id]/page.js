"use client";

import { use } from "react";
import ProgramDetail from "@/components/dashboard/ProgramDetail";

/**
 * PARTICIPANT PROGRAM DETAIL PAGE
 *
 * Shows full program detail including curriculum, resources, progress,
 * facilitators, and submission history.
 */
export default function ParticipantProgramDetailPage({ params }) {
  const unwrapped = use(params);
  const programId = unwrapped.id;
  return (
    <>
      <div className="p-6">
        <ProgramDetail programId={programId} />
      </div>
    </>
  );
}
