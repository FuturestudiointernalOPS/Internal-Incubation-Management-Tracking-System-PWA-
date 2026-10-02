/**
 * LMS learner experience — assessment taking (Phase 4).
 *
 * Server-side scoring: the learner's answers are validated against the
 * configured questions, scored, and the attempt numbered inside a transaction.
 * The client is never trusted for the score or the pass verdict.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, every statement in
 * `@/models/lms/learningStore`.
 */

import { LmsError } from "@/models/lms/errors";
import { getCourse } from "@/models/lms/courses";
import { getAssessment } from "@/models/lms/assessments";
import { scoreAssessment, DEFAULT_PASS_MARK } from "@/models/lms/scoring";
import {
  selectAssessmentQuestions,
  selectAssessmentAttempts,
  insertAssessmentAttempt,
} from "@/models/lms/learningStore";
import { getEnrollment } from "./structure";
import { computeEnrollmentProgress } from "./enrollmentProgress";
import { finalizeCourseCompletion } from "./completion";

function parseJson(value, fallback = []) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

async function assertAssessmentAccess(assessment, userCid) {
  const course = await getCourse(assessment.course_id);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (course.status === "draft") throw new LmsError("lms.errors.assessmentUnavailable", 403);
  const enrollment = await getEnrollment(course.id, userCid);
  if (!enrollment || enrollment.status === "suspended") {
    throw new LmsError("lms.errors.notEnrolled", 403);
  }
  return { course, enrollment };
}

async function loadAssessmentQuestions(assessmentId) {
  const res = await selectAssessmentQuestions(assessmentId);
  return res.rows;
}

/**
 * Learner view of an assessment: metadata + questions (options only, NEVER
 * correct answers) + attempt history. Enrollment-gated.
 */
export async function getAssessmentForTake(assessmentId, userCid) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new LmsError("lms.errors.assessmentNotFound", 404);
  await assertAssessmentAccess(assessment, userCid);

  const questions = await loadAssessmentQuestions(assessmentId);
  const attemptsRes = await selectAssessmentAttempts(userCid, assessmentId);

  return {
    assessment: {
      id: assessment.id,
      course_id: assessment.course_id,
      section_id: assessment.section_id,
      title: assessment.title,
      description: assessment.description,
      pass_mark: assessment.pass_mark,
      is_required: assessment.is_required,
    },
    questions: questions.map((question) => ({
      id: question.id,
      question: question.question,
      question_type: question.question_type,
      options: parseJson(question.options),
      points: question.points,
      position: question.position,
    })),
    attempts: attemptsRes.rows,
    passed: attemptsRes.rows.some((attempt) => attempt.passed),
  };
}

/**
 * Submit an assessment attempt. The server:
 *   1. verifies the learner's enrollment for the owning course,
 *   2. validates every submitted answer against the configured questions,
 *   3. computes score + pass/fail (never trusts the client),
 *   4. derives attempt_number inside a transaction (UNIQUE constraint guards
 *      concurrent submissions; one retry on conflict),
 *   5. returns the result + refreshed course progress.
 */
export async function submitAssessment(assessmentId, userCid, submittedAnswers) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) throw new LmsError("lms.errors.assessmentNotFound", 404);
  const { course, enrollment } = await assertAssessmentAccess(assessment, userCid);

  const questionRows = await loadAssessmentQuestions(assessmentId);
  const questions = questionRows.map((question) => ({
    ...question,
    options: parseJson(question.options),
    correct_answer: parseJson(question.correct_answer, []),
  }));

  const result = scoreAssessment(questions, submittedAnswers);
  if (!result.valid) throw new LmsError(result.error, 400);

  const passMark = assessment.pass_mark != null ? Number(assessment.pass_mark) : DEFAULT_PASS_MARK;
  const passed = result.percent >= passMark;

  // Attempt number + insert, inside a transaction. The Phase 1
  // UNIQUE(user_cid, assessment_id, attempt_number) constraint makes concurrent
  // double-submissions safe; retry once on a unique violation.
  let attempt;
  try {
    attempt = await insertAssessmentAttempt(userCid, assessmentId, result, passed, submittedAnswers);
  } catch (error) {
    if (!/unique/i.test(String(error.message))) throw error;
    attempt = await insertAssessmentAttempt(userCid, assessmentId, result, passed, submittedAnswers);
  }

  const courseProgress = await computeEnrollmentProgress(assessment.course_id, enrollment, userCid);
  const certificate = await finalizeCourseCompletion({ course, enrollment, courseProgress });

  return {
    success: true,
    attempt: {
      id: attempt.id,
      attempt_number: attempt.attempt_number,
      score: attempt.score,
      total_points: attempt.total_points,
      percent: result.percent,
      passed,
    },
    courseProgress,
    courseCompleted: courseProgress.complete,
    certificate,
  };
}