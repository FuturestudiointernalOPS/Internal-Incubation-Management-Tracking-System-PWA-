/**
 * LMS learner experience — the learner-facing course surfaces (My Learning and
 * one course view). Enrollment is enforced SERVER-side; assessments carry
 * per-learner state but NEVER questions/answers.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, statements in
 * `@/models/lms/learningStore`.
 */

import { LmsError } from "@/models/lms/errors";
import { getCourse } from "@/models/lms/courses";
import { learnerSectionResourcesByCourse } from "@/models/lms/sectionResources";
import { selectUsableEnrollment, selectEnrollmentsByUser, selectCoursesByIds } from "@/models/lms/learningStore";
import { loadStructure, loadEnrollmentProgress, getEnrollment, loadAssessmentStates } from "./structure";
import { computeCourseProgress, findContinueLesson } from "./progress";
import { finalizeCourseCompletion } from "./completion";

function learnerAssessment(state) {
  if (!state) return null;
  return {
    id: state.id,
    title: state.title,
    pass_mark: state.pass_mark,
    is_required: state.is_required,
    passed: state.passed,
    attempted: state.attempted,
    bestPercent: state.bestPercent,
  };
}

/**
 * Whether a learner has at least one usable enrollment (self-subscribed or
 * assigned via admin/program). Suspended enrollments do not grant access, so
 * they do not count. Used by the UI to only surface "My Learning" for
 * learners who actually have courses.
 */
export async function learnerHasEnrollments(userCid) {
  const res = await selectUsableEnrollment(userCid);
  return res.rows.length > 0;
}

/** Enrolled courses + progress + resume point for the learner's My Learning. */
export async function getLearnerCourses(userCid) {
  // Suspended enrollments grant no access (`learnerHasEnrollments` and the
  // `learning_own` scope policy both exclude them), so they must not be listed
  // here either — otherwise the learner sees a course in My Learning that the
  // enrolment-gated routes then refuse to open.
  const enrollRes = await selectEnrollmentsByUser(userCid);
  const enrollments = enrollRes.rows;
  if (enrollments.length === 0) return [];

  const courseIds = [...new Set(enrollments.map((enrollment) => String(enrollment.course_id)))];
  const coursesRes = await selectCoursesByIds(courseIds);
  const courseById = new Map(coursesRes.rows.map((course) => [String(course.id), course]));

  const result = [];
  for (const enrollment of enrollments) {
    const course = courseById.get(String(enrollment.course_id));
    if (!course) continue;
    const structure = await loadStructure(course.id);
    const progress = await loadEnrollmentProgress(enrollment.id);
    const assessmentStates = await loadAssessmentStates(userCid, course.id);
    const assessmentProgress = [...assessmentStates.values()].map((state) => ({
      id: state.id,
      is_required: state.is_required,
      passed: state.passed,
    }));
    const courseProgress = computeCourseProgress(structure, progress, assessmentProgress);
    const certificate = await finalizeCourseCompletion({ course, enrollment, courseProgress });
    result.push({
      enrollment,
      course,
      progress: courseProgress,
      continueLesson: courseProgress.complete ? null : findContinueLesson(structure, progress),
      certificate,
    });
  }
  return result;
}

/**
 * Learner-scoped course view. Enforces enrollment server-side.
 * Assessments carry per-learner state but NEVER questions/answers.
 */
export async function getLearnerCourse(courseId, userCid) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (course.status === "draft") throw new LmsError("lms.errors.notEnrolled", 403);

  const enrollment = await getEnrollment(courseId, userCid);
  if (!enrollment || enrollment.status === "suspended") {
    throw new LmsError("lms.errors.notEnrolled", 403);
  }

  const structure = await loadStructure(courseId);
  const progress = await loadEnrollmentProgress(enrollment.id);
  const assessmentStates = await loadAssessmentStates(userCid, courseId);
  const assessmentProgress = [...assessmentStates.values()].map((state) => ({
    id: state.id,
    is_required: state.is_required,
    passed: state.passed,
  }));
  const courseProgress = computeCourseProgress(structure, progress, assessmentProgress);
  const continueLesson = courseProgress.complete ? null : findContinueLesson(structure, progress);
  const certificate = await finalizeCourseCompletion({ course, enrollment, courseProgress });

  // Section material, signed for the learner (uploads get a short-lived link).
  const resourcesBySection = await learnerSectionResourcesByCourse(courseId);

  const sections = structure.map((section) => {
    const completedInSection = section.lessons.filter((lesson) => progress[String(lesson.id)] === "completed").length;
    return {
      id: section.id,
      title: section.title,
      description: section.description ?? null,
      position: section.position,
      resources: resourcesBySection.get(String(section.id)) || [],
      assessment: section.assessment ? learnerAssessment(assessmentStates.get(String(section.assessment.id))) : null,
      progress: { completed: completedInSection, total: section.lessons.length },
      lessons: section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description ?? null,
        position: lesson.position,
        is_required: lesson.is_required,
        duration_minutes: lesson.duration_minutes,
        youtube_video_id: lesson.youtube_video_id,
        state: progress[String(lesson.id)] === "completed" ? "completed" : "not_started",
      })),
    };
  });
  if (continueLesson) {
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (String(lesson.id) === String(continueLesson.lessonId)) lesson.state = "current";
      }
    }
  }

  const courseAssessments = [...assessmentStates.values()]
    .filter((state) => !state.section_id)
    .map(learnerAssessment);

  return {
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail_url: course.thumbnail_url,
      status: course.status,
    },
    enrollment: {
      id: enrollment.id,
      source: enrollment.source,
      status: enrollment.status,
      enrolled_at: enrollment.enrolled_at,
      completed_at: enrollment.completed_at,
    },
    progress: courseProgress,
    continueLesson,
    certificate,
    sections,
    courseAssessments,
  };
}