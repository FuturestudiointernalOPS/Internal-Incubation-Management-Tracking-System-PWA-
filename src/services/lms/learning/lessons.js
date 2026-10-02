/**
 * LMS learner experience — the lesson write path.
 *
 * Layer (see docs/LAYER_SPLIT.md): the decision here, every statement in
 * `@/models/lms/learningStore`.
 */

import { LmsError } from "@/models/lms/errors";
import { getCourse } from "@/models/lms/courses";
import {
  selectLessonById,
  selectSectionById,
  selectLessonProgressRow,
  insertLessonProgress,
  updateLessonProgressCompleted,
} from "@/models/lms/learningStore";
import { getEnrollment } from "./structure";
import { computeEnrollmentProgress } from "./enrollmentProgress";
import { finalizeCourseCompletion } from "./completion";

/**
 * Mark a lesson complete (idempotent). Lesson → section → course is derived
 * server-side; the learner must have a valid enrollment. Marks the enrollment
 * completed when all required components (lessons + passed assessments) are
 * done. Passing assessments NEVER completes lessons and vice versa.
 */
export async function completeLesson(lessonId, userCid) {
  const lessonRes = await selectLessonById(lessonId);
  const lesson = lessonRes.rows[0];
  if (!lesson) throw new LmsError("lms.errors.lessonNotFound", 404);

  const sectionRes = await selectSectionById(lesson.section_id);
  const section = sectionRes.rows[0];
  if (!section) throw new LmsError("lms.errors.lessonNotFound", 404);

  const course = await getCourse(section.course_id);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (course.status === "draft") throw new LmsError("lms.errors.notEnrolled", 403);

  const enrollment = await getEnrollment(course.id, userCid);
  if (!enrollment || enrollment.status === "suspended") {
    throw new LmsError("lms.errors.notEnrolled", 403);
  }

  // Idempotent upsert — never duplicate progress rows.
  const existing = await selectLessonProgressRow(enrollment.id, lessonId);
  if (existing.rows.length === 0) {
    await insertLessonProgress(enrollment.id, lessonId);
  } else {
    await updateLessonProgressCompleted(existing.rows[0].id);
  }

  const courseProgress = await computeEnrollmentProgress(course.id, enrollment, userCid);
  const certificate = await finalizeCourseCompletion({ course, enrollment, courseProgress });
  return {
    success: true,
    lessonId,
    courseProgress,
    courseCompleted: courseProgress.complete,
    certificate,
  };
}