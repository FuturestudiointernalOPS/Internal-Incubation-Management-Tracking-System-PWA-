"use client";

import AssignmentsView from "@/components/dashboard/AssignmentsView";

/**
 * PARTICIPANT ASSIGNMENTS PAGE
 *
 * Centralized view of all assignments across programs
 * with submission, status tracking, and filtering.
 */
export default function ParticipantAssignmentsPage() {
  return (
    <>
      <div className="p-6">
        <AssignmentsView />
      </div>
    </>
  );
}
