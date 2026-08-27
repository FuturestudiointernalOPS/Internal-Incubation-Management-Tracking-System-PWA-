"use client";

import { useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LearnerCourse from "@/components/lms/LearnerCourse";

/**
 * PARTICIPANT — COURSE OVERVIEW (learner view)
 * Progress, sections, lessons and the resume point for an enrolled course.
 */
export default function ParticipantLearningCoursePage() {
  const params = useParams();
  return (
    <DashboardLayout role="participant" activeTab="learning">
      <div className="p-6">
        <LearnerCourse courseId={params.courseId} />
      </div>
    </DashboardLayout>
  );
}
