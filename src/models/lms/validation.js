import { extractYouTubeVideoId } from "./youtube";

/**
 * Publish validation for a course structure (PURE — no DB access).
 *
 * Rules (V1, derived from the Phase 1 schema — deliberately not over-strict):
 *   - course has a title
 *   - at least one section
 *   - at least one lesson across the course
 *   - every section has a title
 *   - every lesson has a title; video lessons have a valid YouTube reference
 *   - every assessment (section or course level) has a title and ≥ 1 question
 *   - every question has text; MC has ≥ 2 options + a correct answer; TF has
 *     a correct answer; pass mark, when set, is 0–100
 *
 * Assessments are optional: a course without assessments still validates.
 *
 * @param {{title: string}} course
 * @param {{sections: Array, courseAssessments: Array}} structure
 *   structure.sections[i] = { id, title, lessons: [...], assessment: {...} | null }
 *   structure.courseAssessments[i] = { id, title, pass_mark, questions: [...] }
 * @returns {{valid: boolean, errors: Array<{field: string, key: string}>}}
 */
export function validateCourseForPublish(course, structure = {}) {
  const errors = [];

  if (!course?.title || !String(course.title).trim()) {
    errors.push({ field: "title", key: "lms.errors.courseTitleRequired" });
  }

  const sections = structure.sections || [];
  if (sections.length === 0) {
    errors.push({ field: "sections", key: "lms.errors.noSections" });
  }

  const allLessons = sections.flatMap((s) => s.lessons || []);
  if (allLessons.length === 0) {
    errors.push({ field: "lessons", key: "lms.errors.noLessons" });
  }

  for (const section of sections) {
    if (!section.title || !String(section.title).trim()) {
      errors.push({
        field: `sections.${section.id}`,
        key: "lms.errors.sectionTitleRequired",
      });
    }
    for (const lesson of section.lessons || []) {
      if (!lesson.title || !String(lesson.title).trim()) {
        errors.push({
          field: `lessons.${lesson.id}`,
          key: "lms.errors.lessonTitleRequired",
        });
      }
      if (
        lesson.content_type === "video" &&
        !extractYouTubeVideoId(lesson.youtube_video_id)
      ) {
        errors.push({
          field: `lessons.${lesson.id}`,
          key: "lms.errors.lessonVideoRequired",
        });
      }
    }
    if (section.assessment) validateAssessment(section.assessment, errors);
  }

  for (const assessment of structure.courseAssessments || []) {
    validateAssessment(assessment, errors);
  }

  return { valid: errors.length === 0, errors };
}

function validateAssessment(assessment, errors) {
  if (!assessment?.title || !String(assessment.title).trim()) {
    errors.push({
      field: `assessments.${assessment?.id}`,
      key: "lms.errors.assessmentTitleRequired",
    });
    return;
  }

  const questions = assessment.questions || [];
  if (questions.length === 0) {
    errors.push({
      field: `assessments.${assessment.id}`,
      key: "lms.errors.assessmentQuestionsRequired",
    });
  }

  for (const q of questions) {
    if (!q.question || !String(q.question).trim()) {
      errors.push({
        field: `questions.${q.id}`,
        key: "lms.errors.questionTextRequired",
      });
    }
    if (q.question_type === "multiple_choice") {
      const options = Array.isArray(q.options) ? q.options : [];
      if (options.length < 2) {
        errors.push({
          field: `questions.${q.id}`,
          key: "lms.errors.mcOptionsRequired",
        });
      }
      if (!Array.isArray(q.correct_answer) || q.correct_answer.length === 0) {
        errors.push({
          field: `questions.${q.id}`,
          key: "lms.errors.correctAnswerRequired",
        });
      }
    } else if (q.question_type === "true_false") {
      if (!Array.isArray(q.correct_answer) || q.correct_answer.length === 0) {
        errors.push({
          field: `questions.${q.id}`,
          key: "lms.errors.correctAnswerRequired",
        });
      }
    }
  }

  if (
    assessment.pass_mark != null &&
    (Number(assessment.pass_mark) < 0 || Number(assessment.pass_mark) > 100)
  ) {
    errors.push({
      field: `assessments.${assessment.id}`,
      key: "lms.errors.invalidPassMark",
    });
  }
}
