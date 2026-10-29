/**
 * LMS learner experience — statements (REPOSITORY layer).
 *
 * Every statement behind the learner experience: structure and progress loads,
 * enrollment access, lesson completion, assessment attempts (inside a
 * transaction) and the admin enrollment helpers. The decisions (access model,
 * progress rules, completion, certificate finalisation) live in
 * `@/services/lms/learning`.
 *
 * SQL is byte-identical to what used to sit inline in `models/lms/learning.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { PLATFORM_ORGANIZATION_ID } from "@/models/organizations/programScope";

const PLATFORM_ORGANIZATION = `'${PLATFORM_ORGANIZATION_ID}'::uuid`;

// ─── Completion finaliser ────────────────────────────────────────────────────

/** Move an enrollment to 'completed', preserving the first completed_at. */
export function updateEnrollmentCompleted(enrollmentId) {
  return db.execute({
    sql: `UPDATE lms_enrollments SET status = 'completed', completed_at = COALESCE(completed_at, NOW())
          WHERE id = ? AND organization_id = ${PLATFORM_ORGANIZATION}`,
    args: [enrollmentId],
  });
}

// ─── Structure + progress reads ──────────────────────────────────────────────

/** Every lesson-progress row of an enrollment. */
export function selectLessonProgressRows(enrollmentId) {
  return db.execute({
    sql: `SELECT progress.* FROM lms_lesson_progress progress
          JOIN lms_enrollments enrollment ON enrollment.id = progress.enrollment_id
          WHERE progress.enrollment_id = ? AND enrollment.organization_id = ${PLATFORM_ORGANIZATION}`,
    args: [enrollmentId],
  });
}

/** A course's sections, in display order. */
export function selectCourseSections(courseId) {
  return db.execute({
    sql: `SELECT section.* FROM lms_course_sections section
          JOIN lms_courses course ON course.id = section.course_id
          WHERE section.course_id = ? AND course.owner_organization_id = ${PLATFORM_ORGANIZATION}
          ORDER BY section.position, section.created_at`,
    args: [courseId],
  });
}

/** The lessons of the given sections, in display order. */
export function selectLessonsBySectionIds(sectionIds) {
  return db.execute({
    sql: `SELECT lesson.* FROM lms_lessons lesson
          JOIN lms_course_sections section ON section.id = lesson.section_id
          JOIN lms_courses course ON course.id = section.course_id
          WHERE lesson.section_id IN (${sectionIds
      .map(() => "?")
      .join(",")}) AND course.owner_organization_id = ${PLATFORM_ORGANIZATION}
          ORDER BY lesson.position, lesson.created_at`,
    args: sectionIds,
  });
}

/** A course's assessments, in display order. */
export function selectAssessmentsByCourse(courseId) {
  return db.execute({
    sql: `SELECT assessment.* FROM lms_assessments assessment
          JOIN lms_courses course ON course.id = assessment.course_id
          WHERE assessment.course_id = ? AND course.owner_organization_id = ${PLATFORM_ORGANIZATION}
          ORDER BY assessment.position, assessment.created_at`,
    args: [courseId],
  });
}

/** One learner's enrollment for a course (or none). */
export function selectEnrollment(courseId, userCid) {
  return db.execute({
    sql: `SELECT * FROM lms_enrollments WHERE course_id = ? AND user_cid = ?
          AND organization_id = ${PLATFORM_ORGANIZATION} LIMIT 1`,
    args: [courseId, userCid],
  });
}

/** This learner's attempts on the given assessments. */
export function selectAssessmentAttemptStates(userCid, assessmentIds) {
  return db.execute({
    sql: `SELECT assessment_id, score, total_points, passed FROM lms_assessment_attempts
            WHERE user_cid = ? AND organization_id = ${PLATFORM_ORGANIZATION}
              AND assessment_id IN (${assessmentIds.map(() => "?").join(",")})`,
    args: [userCid, ...assessmentIds],
  });
}

/** Whether the learner has at least one usable (non-suspended) enrollment. */
export function selectUsableEnrollment(userCid) {
  return db.execute({
    sql: `SELECT 1 FROM lms_enrollments
          WHERE user_cid = ? AND organization_id = ${PLATFORM_ORGANIZATION}
            AND status <> 'suspended'
          LIMIT 1`,
    args: [userCid],
  });
}

/** The learner's usable enrollments, newest first. */
export function selectEnrollmentsByUser(userCid) {
  return db.execute({
    sql: `SELECT * FROM lms_enrollments
          WHERE user_cid = ? AND organization_id = ${PLATFORM_ORGANIZATION}
            AND status <> 'suspended'
          ORDER BY enrolled_at DESC`,
    args: [userCid],
  });
}

/** The courses with the given ids. */
export function selectCoursesByIds(courseIds) {
  return db.execute({
    sql: `SELECT * FROM lms_courses WHERE owner_organization_id = ${PLATFORM_ORGANIZATION}
          AND id IN (${courseIds.map(() => "?").join(",")})`,
    args: courseIds,
  });
}

// ─── Lesson completion ───────────────────────────────────────────────────────

/** One lesson by id (or none). */
export function selectLessonById(lessonId) {
  return db.execute({
    sql: `SELECT lesson.* FROM lms_lessons lesson
          JOIN lms_course_sections section ON section.id = lesson.section_id
          JOIN lms_courses course ON course.id = section.course_id
          WHERE lesson.id = ? AND course.owner_organization_id = ${PLATFORM_ORGANIZATION}`,
    args: [lessonId],
  });
}

/** One section by id (or none). */
export function selectSectionById(sectionId) {
  return db.execute({
    sql: `SELECT section.* FROM lms_course_sections section
          JOIN lms_courses course ON course.id = section.course_id
          WHERE section.id = ? AND course.owner_organization_id = ${PLATFORM_ORGANIZATION}`,
    args: [sectionId],
  });
}

/** The existing progress row for an enrollment + lesson (or none). */
export function selectLessonProgressRow(enrollmentId, lessonId) {
  return db.execute({
    sql: `SELECT progress.* FROM lms_lesson_progress progress
          JOIN lms_enrollments enrollment ON enrollment.id = progress.enrollment_id
          WHERE progress.enrollment_id = ? AND progress.lesson_id = ?
            AND enrollment.organization_id = ${PLATFORM_ORGANIZATION}`,
    args: [enrollmentId, lessonId],
  });
}

/** Insert a completed lesson-progress row. */
export function insertLessonProgress(enrollmentId, lessonId) {
  return db.execute({
    sql: "INSERT INTO lms_lesson_progress (enrollment_id, lesson_id, status, completed_at) VALUES (?, ?, 'completed', NOW())",
    args: [enrollmentId, lessonId],
  });
}

/** Mark an existing progress row completed, preserving the first completed_at. */
export function updateLessonProgressCompleted(progressId) {
  return db.execute({
    sql: "UPDATE lms_lesson_progress SET status = 'completed', completed_at = COALESCE(completed_at, NOW()) WHERE id = ?",
    args: [progressId],
  });
}

// ─── Assessments ─────────────────────────────────────────────────────────────

/** The questions of an assessment, in display order. */
export function selectAssessmentQuestions(assessmentId) {
  return db.execute({
    sql: `SELECT question.* FROM lms_assessment_questions question
          JOIN lms_assessments assessment ON assessment.id = question.assessment_id
          JOIN lms_courses course ON course.id = assessment.course_id
          WHERE question.assessment_id = ? AND course.owner_organization_id = ${PLATFORM_ORGANIZATION}
          ORDER BY question.position, question.created_at`,
    args: [assessmentId],
  });
}

/** A learner's attempt history for an assessment, oldest first. */
export function selectAssessmentAttempts(userCid, assessmentId) {
  return db.execute({
    sql: `SELECT attempt_number, score, total_points, passed, completed_at
          FROM lms_assessment_attempts WHERE user_cid = ? AND assessment_id = ?
            AND organization_id = ${PLATFORM_ORGANIZATION}
          ORDER BY attempt_number ASC`,
    args: [userCid, assessmentId],
  });
}

/**
 * Persist one attempt. The attempt number is derived INSIDE the transaction: the
 * UNIQUE(user_cid, assessment_id, attempt_number) constraint makes concurrent
 * double-submissions safe.
 */
export function insertAssessmentAttempt(userCid, assessmentId, result, passed, submittedAnswers) {
  return db.transaction(async (query) => {
    const maxRes = await query(
      `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next
       FROM lms_assessment_attempts WHERE user_cid = ? AND assessment_id = ?
         AND organization_id = ${PLATFORM_ORGANIZATION}`,
      [userCid, assessmentId],
    );
    const attemptNumber = maxRes.rows[0].next;
    const ins = await query(
      `INSERT INTO lms_assessment_attempts
         (organization_id, user_cid, assessment_id, attempt_number, score, total_points, passed, answers, completed_at)
       VALUES (${PLATFORM_ORGANIZATION}, ?, ?, ?, ?, ?, ?, ?::jsonb, NOW()) RETURNING *`,
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

// ─── Admin enrollment ────────────────────────────────────────────────────────

/** The cid of the contact with this email (or none). */
export function selectContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) LIMIT 1",
    args: [email],
  });
}

/** Enroll a learner (idempotent). */
export function insertEnrollment(courseId, cid, source) {
  return db.execute({
    sql: `INSERT INTO lms_enrollments (course_id, user_cid, source, organization_id)
          VALUES (?, ?, ?, ${PLATFORM_ORGANIZATION})
          ON CONFLICT (organization_id, course_id, user_cid) DO NOTHING`,
    args: [courseId, cid, source || "admin"],
  });
}

/** A course's enrollments, newest first. */
export function selectEnrollmentsByCourse(courseId) {
  return db.execute({
    sql: `SELECT * FROM lms_enrollments WHERE course_id = ?
          AND organization_id = ${PLATFORM_ORGANIZATION} ORDER BY enrolled_at DESC`,
    args: [courseId],
  });
}

/** Name + email for the given cids. */
export function selectContactsByCids(cids) {
  return db.execute({
    sql: `SELECT cid, name, email FROM contacts WHERE cid IN (${cids.map(() => "?").join(",")})`,
    args: cids,
  });
}
