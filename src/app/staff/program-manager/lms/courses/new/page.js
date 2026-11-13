"use client";

import CourseCreateScreen from "@/components/shared/lms/CourseCreateScreen";

export const dynamic = "force-dynamic";

/**
 * PM — CREATE COURSE.
 * Creates a DRAFT course, then opens its editor inside the PM surface.
 */
export default function PmLmsCourseNewPage() {
  return <CourseCreateScreen basePath="/staff/program-manager/lms/courses" />;
}
