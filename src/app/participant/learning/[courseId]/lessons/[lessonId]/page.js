"use client";

import { useParams } from "next/navigation";
import LearnerPlayer from "@/components/lms/LearnerPlayer";

/**
 * PARTICIPANT — COURSE PLAYER (learner view)
 * Embedded YouTube video, lesson navigation, Mark Lesson Complete,
 * server-side progress persistence.
 */
export default function ParticipantLearningLessonPage() {
  const params = useParams();
  return (
    <>
      <div className="p-6">
        <LearnerPlayer courseId={params.courseId} lessonId={params.lessonId} />
      </div>
    </>
  );
}
