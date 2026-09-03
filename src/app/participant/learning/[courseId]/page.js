"use client";

import { useParams } from "next/navigation";
import LearnerCourse from "@/components/lms/LearnerCourse";

/**
 * PARTICIPANT — COURSE OVERVIEW (learner view)
 * Progress, sections, lessons and the resume point for an enrolled course.
 */
export default function ParticipantLearningCoursePage() {
  const params = useParams();
  return (
    <>
      <div className="p-6">
        <LearnerCourse courseId={params.courseId} />
      </div>
    </>
  );
}
