/**
 * LMS coaching requests — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/lms/coaching`: the course/lesson/section
 * probes, the program-staff reads, the notification writes, the request rows and
 * the label reads that enrich a request list.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/lms/coaching.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Course / lesson / section ────────────────────────────────────────────────

/** One lesson's id + section id. */
export function selectLesson(lessonId) {
  return db.execute({
    sql: "SELECT id, section_id FROM lms_lessons WHERE id = ?",
    args: [lessonId],
  });
}

/** One course section's id + course id. */
export function selectCourseSection(sectionId) {
  return db.execute({
    sql: "SELECT id, course_id FROM lms_course_sections WHERE id = ?",
    args: [sectionId],
  });
}

/** One course's id, title and status. */
export function selectCourseRow(courseId) {
  return db.execute({
    sql: "SELECT id, title, status FROM lms_courses WHERE id = ?",
    args: [courseId],
  });
}

/** One course's title. */
export function selectCourseTitleRow(courseId) {
  return db.execute({
    sql: "SELECT title FROM lms_courses WHERE id = ? LIMIT 1",
    args: [courseId],
  });
}

// ── Program requirements + staff ─────────────────────────────────────────────

/** The first program requirement of a course. */
export function selectProgramRequirement(courseId) {
  return db.execute({
    sql: "SELECT program_id FROM lms_program_requirements WHERE course_id = ? ORDER BY position, created_at LIMIT 1",
    args: [courseId],
  });
}

/** A program's assigned PM id. */
export function selectProgramAssignedPm(programId) {
  return db.execute({
    sql: "SELECT assigned_pm_id FROM v2_programs WHERE id = ?",
    args: [String(programId)],
  });
}

/** A program's staff ids. */
export function selectProgramStaff(programId) {
  return db.execute({
    // `::text` cast matches the existing v2_program_staff readers (the column's
    // UUID-vs-TEXT form varies across deployments).
    sql: "SELECT staff_id FROM v2_program_staff WHERE program_id::text = ?",
    args: [String(programId)],
  });
}

// ── Notifications ────────────────────────────────────────────────────────────

/** Insert one coaching_request notification. */
export function insertCoachingNotification(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
          VALUES (?, ?, ?, 'coaching_request', 0, NOW())`,
    args: [recipientId, title, message],
  });
}

// ── Requests ─────────────────────────────────────────────────────────────────

/** The open (pending) coaching request of a learner for a course, if any. */
export function selectOpenCoachingRequest(cid, courseId) {
  return db.execute({
    sql: "SELECT * FROM lms_coaching_requests WHERE user_cid = ? AND course_id = ? AND status = 'pending' LIMIT 1",
    args: [String(cid), courseId],
  });
}

/** Insert one coaching request, returning the row. */
export function insertCoachingRequest(cid, programId, courseId, lessonId, timing, topic, message) {
  return db.execute({
    sql: `INSERT INTO lms_coaching_requests
            (user_cid, program_id, course_id, lesson_id, timing, topic, message, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING *`,
    args: [String(cid), programId, courseId, lessonId, timing, topic, message],
  });
}

/** One coaching request row. */
export function selectCoachingRequestById(requestId) {
  return db.execute({
    sql: "SELECT * FROM lms_coaching_requests WHERE id = ?",
    args: [requestId],
  });
}

/** Coaching request rows matching a caller-built WHERE clause, newest first. */
export function selectCoachingRequests(where, args) {
  return db.execute({
    sql: `SELECT * FROM lms_coaching_requests${where} ORDER BY created_at DESC`,
    args,
  });
}

/** Apply a computed SET list to a coaching request. */
export function updateCoachingRequestRow(sets, args) {
  return db.execute({
    sql: `UPDATE lms_coaching_requests SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

// ── Label reads (list enrichment) ────────────────────────────────────────────

/** A learner's display name. */
export function selectContactName(cid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ? LIMIT 1",
    args: [String(cid)],
  });
}

/** The contacts (cid, name, email) for a set of cids. */
export function selectContactsByCids(cids) {
  return db.execute({
    sql: `SELECT cid, name, email FROM contacts WHERE cid IN (${cids.map(() => "?").join(",")})`,
    args: cids,
  });
}

/** The courses (id, title) for a set of ids. */
export function selectCoursesByIds(courseIds) {
  return db.execute({
    sql: `SELECT id, title FROM lms_courses WHERE id IN (${courseIds.map(() => "?").join(",")})`,
    args: courseIds,
  });
}

/** The lessons (id, title) for a set of ids. */
export function selectLessonsByIds(lessonIds) {
  return db.execute({
    sql: `SELECT id, title FROM lms_lessons WHERE id IN (${lessonIds.map(() => "?").join(",")})`,
    args: lessonIds,
  });
}

/** The programs (id, name) for a set of ids. */
export function selectProgramsByIds(programIds) {
  return db.execute({
    sql: `SELECT id, name FROM v2_programs WHERE id IN (${programIds.map(() => "?").join(",")})`,
    args: programIds,
  });
}
