"use client";

import CourseList from "@/components/lms/CourseList";

/**
 * ADMIN — LMS COURSES
 * Course-management list (search, status filter, open, publish, archive).
 * Server-side authorization enforced by the /api/lms/* routes.
 */
export default function LmsCoursesPage() {
  return (
    <>
      <div className="p-6">
        <CourseList />
      </div>
    </>
  );
}
