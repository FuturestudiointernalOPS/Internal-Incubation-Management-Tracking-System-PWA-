/**
 * LMS learner experience — the PURE progress logic (unit-tested without a database).
 *
 * `computeCourseProgress` is the single calculation of "how far is this learner"
 * and `findContinueLesson` the resume point. No SQL, no HTTP.
 */

/**
 * Compute course progress.
 *
 * @param {Array<{lessons: Array}>} sections
 * @param {Record<string,string>} progress  lessonId -> status
 * @param {Array<{id, is_required, passed}>} assessments
 * @returns {{percent: number, status: string, complete: boolean,
 *            completedLessons: number, totalLessons: number,
 *            completedRequired: number, totalRequired: number}}
 */
export function computeCourseProgress(sections = [], progress = {}, assessments = []) {
  const lessons = (sections || []).flatMap((section) => section.lessons || []);
  const total = lessons.length;
  const requiredLessons = lessons.filter((lesson) => lesson.is_required !== false);
  const totalRequiredLessons = requiredLessons.length;
  const completedLessons = lessons.filter((lesson) => progress[lesson.id] === "completed").length;
  const completedRequiredLessons = requiredLessons.filter(
    (lesson) => progress[lesson.id] === "completed",
  ).length;

  const requiredAssessments = (assessments || []).filter((assessment) => assessment.is_required !== false);
  const satisfiedRequiredAssessments = requiredAssessments.filter((assessment) => assessment.passed).length;
  const allRequiredAssessmentsPassed = requiredAssessments.every((assessment) => assessment.passed);

  const totalRequired = totalRequiredLessons + requiredAssessments.length;
  const completedRequired = completedRequiredLessons + satisfiedRequiredAssessments;

  let percent;
  if (totalRequired > 0) percent = Math.round((completedRequired / totalRequired) * 100);
  else if (total > 0) percent = completedLessons === total ? 100 : 0;
  else percent = 0;

  const lessonsComplete =
    totalRequiredLessons > 0
      ? completedRequiredLessons === totalRequiredLessons
      : total > 0 && completedLessons === total;
  const complete = lessonsComplete && allRequiredAssessmentsPassed;

  let status = "not_started";
  if (complete) status = "completed";
  else if (completedLessons > 0 || satisfiedRequiredAssessments > 0) status = "in_progress";

  return {
    percent,
    status,
    complete,
    completedLessons,
    totalLessons: total,
    completedRequired,
    totalRequired,
  };
}

/**
 * First lesson (in section/lesson order) that is not completed — the resume
 * point. Returns null when every lesson is complete.
 */
export function findContinueLesson(sections = [], progress = {}) {
  for (const section of sections || []) {
    for (const lesson of section.lessons || []) {
      if (progress[lesson.id] !== "completed") {
        return {
          lessonId: lesson.id,
          sectionId: section.id,
          sectionTitle: section.title,
          lessonTitle: lesson.title,
        };
      }
    }
  }
  return null;
}

/**
 * Whether a learner may take an assessment yet.
 *   - chapter assessment: every required lesson of that chapter is completed;
 *   - course-level (final) assessment: every required lesson of the course is
 *     completed AND every required chapter assessment is passed.
 *
 * @param {{section_id?: string|null}} assessment
 * @param {Array<{id, lessons: Array, assessment?: {id, is_required}|null}>} structure
 * @param {Record<string,string>} progress  lessonId -> status
 * @param {Record<string,boolean>} passedById  assessmentId -> passed
 */
export function isAssessmentUnlocked(assessment, structure = [], progress = {}, passedById = {}) {
  const sectionId = assessment?.section_id ? String(assessment.section_id) : null;
  const scope = sectionId
    ? structure.filter((section) => String(section.id) === sectionId)
    : structure;
  const lessons = scope.flatMap((section) => section.lessons || []);
  const required = lessons.filter((lesson) => lesson.is_required !== false);
  const gate = required.length > 0 ? required : lessons;
  const lessonsDone = gate.every((lesson) => progress[String(lesson.id)] === "completed");
  if (!lessonsDone) return false;
  if (sectionId) return true;
  return structure.every((section) => {
    const chapterAssessment = section.assessment;
    if (!chapterAssessment || chapterAssessment.is_required === false) return true;
    return !!passedById[String(chapterAssessment.id)];
  });
}
