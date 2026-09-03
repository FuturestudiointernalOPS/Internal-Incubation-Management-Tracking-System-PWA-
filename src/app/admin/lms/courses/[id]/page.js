"use client";

import { useParams } from "next/navigation";
import CourseEditor from "@/components/lms/CourseEditor";

/**
 * ADMIN — COURSE EDITOR
 * Full authoring workspace for one course (details + sections + lessons +
 * videos + assessments), save draft / preview / publish / archive.
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
