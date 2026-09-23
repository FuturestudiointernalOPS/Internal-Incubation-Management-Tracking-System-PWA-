import db from "@/lib/db";
import { LmsError } from "./errors";
import { getCourse } from "./courses";
import { getAssessment } from "./assessments";
import { scoreAssessment, DEFAULT_PASS_MARK } from "./scoring";
import { ensureCertificateForEnrollment } from "./certificates";
import { learnerSectionResourcesByCourse } from "./sectionResources";

/**
 * LMS learner experience services.
 *
 * Access model (server-side, never trust client IDs):
 *   User → valid lms_enrollment → Course → Access
 *
 * Progress model (Phase 1 schema):
 *   - lessons:  lms_lesson_progress (one row per enrollment+lesson, idempotent)
 *   - progress = completed required components / total required components × 100
 *     where a required assessment counts when the learner has PASSED it
 *     (Phase 4). Optional components never block completion.
 *
 * Assessment flow (Phase 4):
 *   start → answer → submit → server-side scoring → attempt row → PASS/FAIL
 *   Unlimited retries; every attempt is persisted; attempt numbers are derived
 *   server-side inside a transaction (UNIQUE(user_cid, assessment_id,
 *   attempt_number) guards concurrent submissions).
 *
 * Certificate flow (Phase 5):
 *   The completion decision stays HERE (single authoritative engine). When a
 *   course becomes complete, the enrollment is marked completed (first
 *   `completed_at` wins) and a certificate is issued idempotently — one
 *   certificate per completed enrollment, server-side only.
 */

// ─── Completion + certificate (single authoritative path) ───────────────────

/**
 * Persist course completion and issue the certificate — the ONLY place where
 * an enrollment transitions to completed. Both mutation entry points
 * (completeLesson, submitAssessment) and the read surfaces funnel through the
 * same completion engine + this finalizer, so there is never a second,
 * conflicting completion calculation (spec §5).
 *
 * - Completion never moves backwards: the enrollment is only ever updated to
 *   'completed' and the original completed_at is preserved (COALESCE).
 * - The persisted enrollment status is authoritative: an enrollment completed
 *   before this phase shipped receives its certificate lazily (idempotent),
 *   even if current content edits would change the computed progress.
 * - Certificate issuance is idempotent (one per completed enrollment).
 */
async function finalizeCourseCompletion({ course, enrollment, courseProgress }) {
  if (courseProgress.complete && enrollment.status !== "completed") {
    await db.execute({
      sql: "UPDATE lms_enrollments SET status = 'completed', completed_at = COALESCE(completed_at, NOW()) WHERE id = ?",
      args: [enrollment.id],
    });
    enrollment = { ...enrollment, status: "completed" };
  }
  // Null while the enrollment is not completed; existing certificate otherwise.
  return ensureCertificateForEnrollment({ course, enrollment });
}

// ─── Pure progress logic (unit-tested) ─────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────

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

export async function loadEnrollmentProgress(enrollmentId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_lesson_progress WHERE enrollment_id = ?",
    args: [enrollmentId],
  });
  const byLesson = {};
  for (const row of res.rows) byLesson[String(row.lesson_id)] = row.status;
  return byLesson;
}

/** Sections + lessons + section-anchored assessment (NO questions). */
export async function loadStructure(courseId) {
  const sectionsRes = await db.execute({
    sql: "SELECT * FROM lms_course_sections WHERE course_id = ? ORDER BY position, created_at",
    args: [courseId],
  });
  const sections = sectionsRes.rows;
  const sectionIds = sections.map((section) => section.id);

  let lessons = [];
  if (sectionIds.length > 0) {
    lessons = (
      await db.execute({
        sql: `SELECT * FROM lms_lessons WHERE section_id IN (${sectionIds
          .map(() => "?")
          .join(",")}) ORDER BY position, created_at`,
        args: sectionIds,
      })
    ).rows;
  }

  const assessments = (
    await db.execute({
      sql: "SELECT * FROM lms_assessments WHERE course_id = ? ORDER BY position, created_at",
      args: [courseId],
    })
  ).rows;

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
  const res = await db.execute({
    sql: "SELECT * FROM lms_enrollments WHERE course_id = ? AND user_cid = ? LIMIT 1",
    args: [courseId, userCid],
  });
  return res.rows[0] || null;
}

/**
 * Per-learner assessment states for a course:
 * { [assessmentId]: { id, title, pass_mark, is_required, section_id,
 *                     passed, attempted, bestPercent } }
 */
export async function loadAssessmentStates(userCid, courseId) {
  const assessmentsRes = await db.execute({
    sql: "SELECT * FROM lms_assessments WHERE course_id = ? ORDER BY position, created_at",
    args: [courseId],
  });
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
    const attemptsRes = await db.execute({
      sql: `SELECT assessment_id, score, total_points, passed FROM lms_assessment_attempts
            WHERE user_cid = ? AND assessment_id IN (${ids.map(() => "?").join(",")})`,
      args: [userCid, ...ids],
    });
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

// ─── Learner-facing services ───────────────────────────────────────────────

/**
 * Whether a learner has at least one usable enrollment (self-subscribed or
 * assigned via admin/program). Suspended enrollments do not grant access, so
 * they do not count. Used by the UI to only surface "My Learning" for
 * learners who actually have courses.
 */
export async function learnerHasEnrollments(userCid) {
  const res = await db.execute({
    sql: `SELECT 1 FROM lms_enrollments
          WHERE user_cid = ? AND status <> 'suspended'
          LIMIT 1`,
    args: [userCid],
  });
  return res.rows.length > 0;
}

/** Enrolled courses + progress + resume point for the learner's My Learning. */
export async function getLearnerCourses(userCid) {
  // Suspended enrollments grant no access (`learnerHasEnrollments` and the
  // `learning_own` scope policy both exclude them), so they must not be listed
  // here either — otherwise the learner sees a course in My Learning that the
  // enrolment-gated routes then refuse to open.
  const enrollRes = await db.execute({
    sql: `SELECT * FROM lms_enrollments
          WHERE user_cid = ? AND status <> 'suspended'
          ORDER BY enrolled_at DESC`,
    args: [userCid],
  });
  const enrollments = enrollRes.rows;
  if (enrollments.length === 0) return [];

  const courseIds = [...new Set(enrollments.map((enrollment) => String(enrollment.course_id)))];
  const coursesRes = await db.execute({
    sql: `SELECT * FROM lms_courses WHERE id IN (${courseIds.map(() => "?").join(",")})`,
    args: courseIds,
  });
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

/**
 * Mark a lesson complete (idempotent). Lesson → section → course is derived
 * server-side; the learner must have a valid enrollment. Marks the enrollment
 * completed when all required components (lessons + passed assessments) are
 * done. Passing assessments NEVER completes lessons and vice versa.
 */
export async function completeLesson(lessonId, userCid) {
  const lessonRes = await db.execute({
    sql: "SELECT * FROM lms_lessons WHERE id = ?",
    args: [lessonId],
  });
  const lesson = lessonRes.rows[0];
  if (!lesson) throw new LmsError("lms.errors.lessonNotFound", 404);

  const sectionRes = await db.execute({
    sql: "SELECT * FROM lms_course_sections WHERE id = ?",
    args: [lesson.section_id],
  });
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
  const existing = await db.execute({
    sql: "SELECT * FROM lms_lesson_progress WHERE enrollment_id = ? AND lesson_id = ?",
    args: [enrollment.id, lessonId],
  });
  if (existing.rows.length === 0) {
    await db.execute({
      sql: "INSERT INTO lms_lesson_progress (enrollment_id, lesson_id, status, completed_at) VALUES (?, ?, 'completed', NOW())",
      args: [enrollment.id, lessonId],
    });
  } else {
    await db.execute({
      sql: "UPDATE lms_lesson_progress SET status = 'completed', completed_at = COALESCE(completed_at, NOW()) WHERE id = ?",
      args: [existing.rows[0].id],
    });
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

/** Course progress for one enrollment (lessons + assessment satisfaction). */
async function computeEnrollmentProgress(courseId, enrollment, userCid) {
  const structure = await loadStructure(courseId);
  const progress = await loadEnrollmentProgress(enrollment.id);
  const assessmentStates = await loadAssessmentStates(userCid, courseId);
  const assessmentProgress = [...assessmentStates.values()].map((state) => ({
    id: state.id,
    is_required: state.is_required,
    passed: state.passed,
  }));
  return computeCourseProgress(structure, progress, assessmentProgress);
}

// ─── Assessment taking (Phase 4) ───────────────────────────────────────────

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
  const res = await db.execute({
    sql: "SELECT * FROM lms_assessment_questions WHERE assessment_id = ? ORDER BY position, created_at",
    args: [assessmentId],
  });
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
  const attemptsRes = await db.execute({
    sql: `SELECT attempt_number, score, total_points, passed, completed_at
          FROM lms_assessment_attempts WHERE user_cid = ? AND assessment_id = ?
          ORDER BY attempt_number ASC`,
    args: [userCid, assessmentId],
  });

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
    attempt = await insertAttemptTransaction(userCid, assessmentId, result, passed, submittedAnswers);
  } catch (error) {
    if (!/unique/i.test(String(error.message))) throw error;
    attempt = await insertAttemptTransaction(userCid, assessmentId, result, passed, submittedAnswers);
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

async function insertAttemptTransaction(userCid, assessmentId, result, passed, submittedAnswers) {
  return db.transaction(async (query) => {
    const maxRes = await query(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next
       FROM lms_assessment_attempts WHERE user_cid = ? AND assessment_id = ?`,
      [userCid, assessmentId],
    );
    const attemptNumber = maxRes.rows[0].next;
    const ins = await query(
      `INSERT INTO lms_assessment_attempts
         (user_cid, assessment_id, attempt_number, score, total_points, passed, answers, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, NOW()) RETURNING *`,
      [
        userCid,
        assessmentId,
        attemptNumber,
        result.correctCount,
        result.total,
        passed,
        JSON.stringify(submittedAnswers),
      ],
    );
    return ins.rows[0];
  });
}

// ─── Admin enrollment enabler ──────────────────────────────────────────────

export async function enrollLearner({ courseId, userCid, userEmail, source }) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);

  let cid = userCid;
  if (!cid && userEmail) {
    const res = await db.execute({
      sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) LIMIT 1",
      args: [userEmail],
    });
    if (res.rows.length === 0) throw new LmsError("lms.errors.userNotFound", 404);
    cid = res.rows[0].cid;
  }
  if (!cid) throw new LmsError("lms.errors.userNotFound", 400);

  await db.execute({
    sql: "INSERT INTO lms_enrollments (course_id, user_cid, source) VALUES (?, ?, ?) ON CONFLICT (course_id, user_cid) DO NOTHING",
    args: [courseId, cid, source || "admin"],
  });
  return { success: true, courseId, userCid: cid };
}

export async function listEnrollments(courseId) {
  const enrollRes = await db.execute({
    sql: "SELECT * FROM lms_enrollments WHERE course_id = ? ORDER BY enrolled_at DESC",
    args: [courseId],
  });
  const enrollments = enrollRes.rows;
  const cids = [...new Set(enrollments.map((enrollment) => enrollment.user_cid))];
  const byCid = new Map();
  if (cids.length > 0) {
    const contactsRes = await db.execute({
      sql: `SELECT cid, name, email FROM contacts WHERE cid IN (${cids.map(() => "?").join(",")})`,
      args: cids,
    });
    for (const contact of contactsRes.rows) byCid.set(String(contact.cid), contact);
  }
  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    user_cid: enrollment.user_cid,
    source: enrollment.source,
    status: enrollment.status,
    enrolled_at: enrollment.enrolled_at,
    completed_at: enrollment.completed_at,
    learner: byCid.get(String(enrollment.user_cid)) || null,
  }));
}
