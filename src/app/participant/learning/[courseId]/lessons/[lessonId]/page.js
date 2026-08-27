"use client";

import { useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LearnerPlayer from "@/components/lms/LearnerPlayer";

/**
 * PARTICIPANT — COURSE PLAYER (learner view)
 * Embedded YouTube video, lesson navigation, Mark Lesson Complete,
 * server-side progress persistence.
 */
export default function ParticipantLearningLessonPage() {
  const params = useParams();
  return (
    <DashboardLayout role="participant" activeTab="learning">
      <div className="p-6">
        <LearnerPlayer courseId={params.courseId} lessonId={params.lessonId} />
      </div>
    </DashboardLayout>
  );
}
