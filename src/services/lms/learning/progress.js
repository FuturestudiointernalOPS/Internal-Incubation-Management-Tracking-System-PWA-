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