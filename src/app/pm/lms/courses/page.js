"use client";

import CourseList from "@/components/lms/CourseList";

export const dynamic = "force-dynamic";

/**
 * PM WORKSPACE — LMS courses (course authoring).
 *
 * The same screen as the admin route, reachable by program managers who hold
 * `lms.view` — the capability that makes the LMS section appear in their
 * sidebar (NAV_CAPABILITY_REQUIREMENTS.lms). Every write is still gated by the
 * /api/lms/* routes (lms.view / create / edit / publish / delete).
 */
export default function PmLmsCoursesPage() {
  return (
    <div className="p-6">
      <CourseList basePath="/pm/lms/courses" />
    </div>
  );
}
