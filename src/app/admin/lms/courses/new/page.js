"use client";

import CourseCreateScreen from "@/components/shared/lms/CourseCreateScreen";

/**
 * ADMIN — CREATE COURSE
 * Creates a DRAFT course (never auto-published), then opens the editor.
 */
export default function LmsCourseNewPage() {
  return <CourseCreateScreen />;
}
