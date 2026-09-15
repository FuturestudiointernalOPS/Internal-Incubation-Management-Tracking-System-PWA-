"use client";

import CourseCreateScreen from "@/components/lms/CourseCreateScreen";

export const dynamic = "force-dynamic";

/**
 * PM — CREATE COURSE.
 * Creates a DRAFT course, then opens its editor inside the PM surface.
 */
export default function PmLmsCourseNewPage() {
  return <CourseCreateScreen basePath="/pm/lms/courses" />;
}
