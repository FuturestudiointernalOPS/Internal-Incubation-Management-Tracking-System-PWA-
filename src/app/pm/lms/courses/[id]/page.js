"use client";

import { useParams } from "next/navigation";
import CourseEditor from "@/components/lms/CourseEditor";

export const dynamic = "force-dynamic";

/**
 * PM — COURSE (view + edit).
 * Same workspace as the admin route, kept inside the PM surface so Back and
 * the post-delete redirect never point at an admin page the PM cannot open.
 */
export default function PmLmsCourseEditorPage() {
  const params = useParams();
  return (
    <div className="p-6">
      <CourseEditor courseId={params.id} basePath="/pm/lms/courses" />
    </div>
  );
}
