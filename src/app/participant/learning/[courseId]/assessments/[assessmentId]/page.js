"use client";

import { useParams } from "next/navigation";
import AssessmentTake from "@/components/lms/AssessmentTake";

/**
 * PARTICIPANT — ASSESSMENT (learner view)
 * Entry → questions → submit → server-side score → PASS/FAIL → retry/continue.
 * Access is enrollment-gated server-side (assessment → course → enrollment).
 */
export default function ParticipantLearningAssessmentPage() {
  const params = useParams();
  return (
    <>
      <div className="p-6">
        <AssessmentTake courseId={params.courseId} assessmentId={params.assessmentId} />
      </div>
    </>
  );
}
