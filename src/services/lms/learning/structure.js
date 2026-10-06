/**
 * LMS learner experience — the read surface every other learner module builds on.
 *
 * The course structure (sections + lessons + the section-anchored assessment),
 * the enrollment of one learner, the lesson-progress map and the per-learner
 * assessment states. No decision beyond shaping these reads: no SQL, no HTTP.
 *
 * Layer (see docs/LAYER_SPLIT.md): every statement lives in
 * `@/models/lms/learningStore`.
 */

import {
  selectLessonProgressRows,
  selectCourseSections,
  selectLessonsBySectionIds,
  selectAssessmentsByCourse,
  selectEnrollment,
  selectAssessmentAttemptStates,
} from "@/models/lms/learningStore";

export async function loadEnrollmentProgress(enrollmentId) {
  const res = await selectLessonProgressRows(enrollmentId);
  const byLesson = {};
  for (const row of res.rows) byLesson[String(row.lesson_id)] = row.status;
  return byLesson;
}

/** Sections + lessons + section-anchored assessment (NO questions). */
export async function loadStructure(courseId) {
  const sectionsRes = await selectCourseSections(courseId);
  const sections = sectionsRes.rows;
  const sectionIds = sections.map((section) => section.id);

  let lessons = [];
  if (sectionIds.length > 0) {
    lessons = (await selectLessonsBySectionIds(sectionIds)).rows;
  }

  const assessments = (await selectAssessmentsByCourse(courseId)).rows;

  const lessonsBySection = {};
  for (const lesson of lessons) {
    (lessonsBySection[String(lesson.section_id)] ??= []).push(lesson);
  }

  return sections.map((section) => ({
    ...section,
    lessons: lessonsBySection[String(section.id)] || [],
    assessment: assessments.find((assessment) => String(assessment.section_id) === String(section.id)) || null,
  }));
}

export async function getEnrollment(courseId, userCid) {
  const res = await selectEnrollment(courseId, userCid);
  return res.rows[0] || null;
}

/**
 * Per-learner assessment states for a course:
 * { [assessmentId]: { id, title, pass_mark, is_required, section_id,
 *                     passed, attempted, bestPercent } }
 */
export async function loadAssessmentStates(userCid, courseId) {
  const assessmentsRes = await selectAssessmentsByCourse(courseId);
  const byId = new Map();
  for (const assessment of assessmentsRes.rows) {
    byId.set(String(assessment.id), {
      id: assessment.id,
      title: assessment.title,
      pass_mark: assessment.pass_mark,
      is_required: assessment.is_required,
      section_id: assessment.section_id,
      passed: false,
      attempted: false,
      bestPercent: null,
    });
  }

  const ids = [...byId.keys()];
  if (ids.length > 0) {
    const attemptsRes = await selectAssessmentAttemptStates(userCid, ids);
    for (const row of attemptsRes.rows) {
      const state = byId.get(String(row.assessment_id));
      if (!state) continue;
      state.attempted = true;
      const percent =
        row.total_points > 0 ? Math.round((row.score / row.total_points) * 100) : 0;
      if (state.bestPercent == null || percent > state.bestPercent) state.bestPercent = percent;
      if (row.passed) state.passed = true;
    }
  }
  return byId;
}