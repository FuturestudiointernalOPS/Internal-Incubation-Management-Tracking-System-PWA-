"use client";

import { useParams } from "next/navigation";
import CourseEditor from "@/components/lms/CourseEditor";

/**
 * ADMIN — COURSE (view + edit)
 * Opens as a read-only presentation: first-lesson video (click to launch) on
 * the left, course name/description/curriculum on the right. Pressing Edit
 * switches to the authoring workspace (details + sections + lessons + videos +
 * assessments), then Save/Cancel returns to the presentation.
 */
export default function LmsCourseEditorPage() {
  const params = useParams();
  return (
    <>
      <div className="p-6">
        <CourseEditor courseId={params.id} />
      </div>
    </>
  );
}
