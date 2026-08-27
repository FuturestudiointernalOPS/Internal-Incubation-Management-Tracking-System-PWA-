"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import LearnerLearning from "@/components/lms/LearnerLearning";

/**
 * PARTICIPANT — MY LEARNING
 * Learner entry point: enrolled courses with progress + Continue Learning.
 */
export default function ParticipantLearningPage() {
  return (
    <DashboardLayout role="participant" activeTab="learning">
      <div className="p-6">
        <LearnerLearning />
      </div>
    </DashboardLayout>
  );
}
