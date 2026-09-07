"use client";

import LearnerLearning from "@/components/lms/LearnerLearning";

/**
 * PARTICIPANT — MY LEARNING
 * Learner entry point: enrolled courses with progress + Continue Learning.
 */
export default function ParticipantLearningPage() {
  return (
    <>
      <div className="p-6">
        <LearnerLearning />
      </div>
    </>
  );
}
