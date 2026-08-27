"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import CourseList from "@/components/lms/CourseList";

/**
 * ADMIN — LMS COURSES
 * Course-management list (search, status filter, open, publish, archive).
 * Server-side authorization enforced by the /api/lms/* routes.
 */
export default function LmsCoursesPage() {
  return (
    <DashboardLayout role="super_admin" activeTab="lms">
      <div className="p-6">
        <CourseList />
      </div>
    </DashboardLayout>
  );
}
