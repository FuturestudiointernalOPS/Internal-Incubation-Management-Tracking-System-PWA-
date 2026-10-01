/**
 * LMS COACHING REQUESTS (Phase 8).
 *
 * A learner, while working through a course, asks for coaching BEFORE, DURING or
 * AFTER that course. This is deliberately a request *queue*, not a scheduling
 * engine:
 *
 *   learner → lms_coaching_requests (status 'pending')
 *           → program staff notified (v2_notifications)
 *           → staff decision recorded on the same row (accepted / declined /
 *             completed) + a response note the learner sees.
 *
 * The decisions — the enrollment-derived access, the server-side program
 * resolution, the one-open-request rule, the timing/status validation and the
 * notification fan-out — live here; every statement is in
 * `@/models/lms/coachingStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/lms/coaching` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 */

import { LmsError } from "@/models/lms/errors";
import { getEnrollment } from "@/models/lms/learning";
import {
  selectLesson,
  selectCourseSection,
  selectCourseRow,
  selectCourseTitleRow,
  selectProgramRequirement,
  selectProgramAssignedPm,
  selectProgramStaff,
  insertCoachingNotification,
  selectOpenCoachingRequest,
  insertCoachingRequest,
  selectCoachingRequestById,
  selectCoachingRequests,
  updateCoachingRequestRow,
  selectContactName,
  selectContactsByCids,
  selectCoursesByIds,
  selectLessonsByIds,
  selectProgramsByIds,
} from "@/models/lms/coachingStore";

export const COACHING_TIMINGS = ["before", "during", "after"];
export const COACHING_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
];

/** Statuses that still need a staff decision. */
const OPEN_STATUSES = ["pending", "accepted"];

function parseRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_cid: row.user_cid,
    program_id: row.program_id ?? null,
    course_id: row.course_id ?? null,
    lesson_id: row.lesson_id ?? null,
    timing: row.timing,
    topic: row.topic ?? null,
    message: row.message ?? null,
    status: row.status,
    handled_by: row.handled_by ?? null,
    handled_at: row.handled_at ?? null,
    response_note: row.response_note ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeTiming(value) {
  const timing = String(value ?? "").trim().toLowerCase();
  if (!timing) return null;
  if (!COACHING_TIMINGS.includes(timing)) {
    throw new LmsError("lms.errors.invalidCoachingTiming", 400);
  }
  return timing;
}

function normalizeStatus(value) {
  const status = String(value ?? "").trim().toLowerCase();
  if (!COACHING_STATUSES.includes(status)) {
    throw new LmsError("lms.errors.invalidCoachingStatus", 400);
  }
  return status;
}

/** Lesson (when provided) must belong to the course the learner is enrolled in. */
async function assertLessonBelongsToCourse(lessonId, courseId) {
  const lessonResult = await selectLesson(lessonId);
  const lesson = lessonResult.rows[0];
  if (!lesson) throw new LmsError("lms.errors.lessonNotFound", 404);

  const sectionResult = await selectCourseSection(lesson.section_id);
  const section = sectionResult.rows[0];
  if (!section || String(section.course_id) !== String(courseId)) {
    throw new LmsError("lms.errors.lessonNotFound", 404);
  }
}

/**
 * Resolve the program a request belongs to: the enrollment that granted access
 * first (source 'program' carries it), then the course's program requirement.
 */
async function resolveProgramId(courseId, enrollment) {
  if (enrollment?.program_id) return String(enrollment.program_id);
  const result = await selectProgramRequirement(courseId);
  return result.rows[0]?.program_id ? String(result.rows[0].program_id) : null;
}

/** Program staff (assigned PM + assigned staff) — the people who can answer. */
export async function getProgramStaffIds(programId) {
  if (!programId) return [];
  const ids = new Set();

  const programResult = await selectProgramAssignedPm(programId);
  const pmId = programResult.rows[0]?.assigned_pm_id;
  if (pmId) ids.add(String(pmId));

  const staffResult = await selectProgramStaff(programId);
  for (const row of staffResult.rows || []) {
    if (row.staff_id) ids.add(String(row.staff_id));
  }
  return [...ids];
}

/**
 * Notify program staff. Never throws: a notification failure must not roll back
 * a request the learner already sent.
 */
async function notifyStaff(programId, title, message, excludeCid) {
  try {
    const recipients = (await getProgramStaffIds(programId)).filter(
      (cid) => String(cid) !== String(excludeCid ?? ""),
    );
    for (const cid of recipients) {
      await insertCoachingNotification(cid, title, message);
    }
    return recipients.length;
  } catch (error) {
    console.error("[LMS] coaching notification failed:", error.message);
    return 0;
  }
}

/** Notify the learner that their request moved. Never throws. */
async function notifyLearner(cid, title, message) {
  try {
    await insertCoachingNotification(String(cid), title, message);
  } catch (error) {
    console.error("[LMS] coaching notification to learner failed:", error.message);
  }
}

/**
 * Create (or return the already-open) coaching request for a learner.
 * `duplicate: true` in the result means the open request was returned as-is.
 */
export async function createCoachingRequest({
  cid,
  courseId,
  lessonId,
  timing,
  topic,
  message,
}) {
  if (!cid) throw new LmsError("errors.authRequired", 401);
  if (!courseId) throw new LmsError("lms.errors.courseIdRequired", 400);

  const courseResult = await selectCourseRow(courseId);
  const course = courseResult.rows[0];
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);

  // Enrollment IS the access model for the learner experience.
  const enrollment = await getEnrollment(courseId, cid);
  if (!enrollment || enrollment.status === "suspended") {
    throw new LmsError("lms.errors.notEnrolled", 403);
  }

  if (lessonId) await assertLessonBelongsToCourse(lessonId, courseId);

  const resolvedTiming = normalizeTiming(timing) || "during";
  const programId = await resolveProgramId(courseId, enrollment);

  // Never queue twice: an open request for this course is returned untouched.
  const openResult = await selectOpenCoachingRequest(cid, courseId);
  if (openResult.rows.length > 0) {
    return { request: parseRequest(openResult.rows[0]), duplicate: true, notified: 0 };
  }

  const insertResult = await insertCoachingRequest(
    cid,
    programId,
    courseId,
    lessonId || null,
    resolvedTiming,
    topic ? String(topic).trim() : null,
    message ? String(message).trim() : null,
  );
  const request = parseRequest(insertResult.rows[0]);

  const learnerName = await getLearnerName(cid);
  const notified = await notifyStaff(
    programId,
    "New coaching request",
    `${learnerName} · ${course.title} · ${resolvedTiming}`,
    cid,
  );

  return { request, duplicate: false, notified };
}

async function getLearnerName(cid) {
  const result = await selectContactName(cid);
  return result.rows[0]?.name || String(cid);
}

async function getCourseTitle(courseId) {
  if (!courseId) return "";
  const result = await selectCourseTitleRow(courseId);
  return result.rows[0]?.title || String(courseId);
}

/** Raw rows for one filter set (no enrichment). */
async function selectRequests({ cid, programId, courseId, status } = {}) {
  const clauses = [];
  const args = [];
  if (cid) {
    clauses.push("user_cid = ?");
    args.push(String(cid));
  }
  if (programId) {
    clauses.push("program_id = ?");
    args.push(String(programId));
  }
  if (courseId) {
    clauses.push("course_id = ?");
    args.push(courseId);
  }
  if (status) {
    clauses.push("status = ?");
    args.push(normalizeStatus(status));
  }
  const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  const result = await selectCoachingRequests(where, args);
  return result.rows.map(parseRequest);
}

/** Attach learner, course and lesson labels (composed in code — no JOIN). */
async function enrichRequests(requests) {
  if (requests.length === 0) return [];

  const cids = [...new Set(requests.map((requestRow) => String(requestRow.user_cid)))];
  const courseIds = [...new Set(requests.filter((requestRow) => requestRow.course_id).map((requestRow) => String(requestRow.course_id)))];
  const lessonIds = [...new Set(requests.filter((requestRow) => requestRow.lesson_id).map((requestRow) => String(requestRow.lesson_id)))];
  const programIds = [...new Set(requests.filter((requestRow) => requestRow.program_id).map((requestRow) => String(requestRow.program_id)))];

  const [contactsResult, coursesResult, lessonsResult, programsResult] = await Promise.all([
    cids.length > 0 ? selectContactsByCids(cids) : { rows: [] },
    courseIds.length > 0 ? selectCoursesByIds(courseIds) : { rows: [] },
    lessonIds.length > 0 ? selectLessonsByIds(lessonIds) : { rows: [] },
    programIds.length > 0 ? selectProgramsByIds(programIds) : { rows: [] },
  ]);

  const contactsByCid = new Map(contactsResult.rows.map((contactRow) => [String(contactRow.cid), contactRow]));
  const coursesById = new Map(coursesResult.rows.map((courseRow) => [String(courseRow.id), courseRow]));
  const lessonsById = new Map(lessonsResult.rows.map((lessonRow) => [String(lessonRow.id), lessonRow]));
  const programsById = new Map(programsResult.rows.map((programRow) => [String(programRow.id), programRow]));

  return requests.map((requestRow) => {
    const contact = contactsByCid.get(String(requestRow.user_cid));
    const course = requestRow.course_id ? coursesById.get(String(requestRow.course_id)) : null;
    const lesson = requestRow.lesson_id ? lessonsById.get(String(requestRow.lesson_id)) : null;
    const program = requestRow.program_id ? programsById.get(String(requestRow.program_id)) : null;
    return {
      ...requestRow,
      learner_name: contact?.name || String(requestRow.user_cid),
      learner_email: contact?.email || null,
      course_title: course?.title || null,
      lesson_title: lesson?.title || null,
      program_name: program?.name || null,
    };
  });
}

/** A learner's own requests — the participant surface (status feedback). */
export async function listMyCoachingRequests(cid, { courseId } = {}) {
  if (!cid) throw new LmsError("errors.authRequired", 401);
  const requests = await selectRequests({ cid, courseId });
  const enriched = await enrichRequests(requests);
  return enriched.map((requestRow) => ({
    ...requestRow,
    can_cancel: OPEN_STATUSES.includes(requestRow.status),
  }));
}

/** Program queue for staff (PM workspace). */
export async function listCoachingRequests({ programId, courseId, status } = {}) {
  if (!programId) throw new LmsError("lms.errors.programIdRequired", 400);
  const requests = await selectRequests({ programId, courseId, status });
  return enrichRequests(requests);
}

export async function getCoachingRequest(requestId) {
  const result = await selectCoachingRequestById(requestId);
  return parseRequest(result.rows[0]);
}

/**
 * Staff decision (accept / decline / complete). Records who decided and when,
 * then informs the learner.
 */
export async function updateCoachingRequest(
  requestId,
  { status, responseNote, handledBy } = {},
) {
  const existing = await getCoachingRequest(requestId);
  if (!existing) throw new LmsError("lms.errors.coachingRequestNotFound", 404);

  const sets = [];
  const args = [];

  let nextStatus = existing.status;
  if (status !== undefined) {
    nextStatus = normalizeStatus(status);
    sets.push("status = ?");
    args.push(nextStatus);
  }
  if (responseNote !== undefined) {
    sets.push("response_note = ?");
    args.push(responseNote ? String(responseNote).trim() : null);
  }
  if (handledBy !== undefined || (status !== undefined && nextStatus !== "pending")) {
    sets.push("handled_by = ?");
    args.push(handledBy ? String(handledBy) : null);
    sets.push("handled_at = NOW()");
  }

  if (sets.length === 0) return existing;
  sets.push("updated_at = NOW()");
  args.push(requestId);
  await updateCoachingRequestRow(sets, args);

  const updated = await getCoachingRequest(requestId);
  if (status !== undefined && nextStatus !== existing.status) {
    const courseTitle = await getCourseTitle(updated.course_id);
    await notifyLearner(
      updated.user_cid,
      "Coaching request update",
      `${courseTitle} — ${nextStatus}`,
    );
  }
  return updated;
}

/** A learner withdraws their own open request. */
export async function cancelCoachingRequest(requestId, cid) {
  const existing = await getCoachingRequest(requestId);
  if (!existing) throw new LmsError("lms.errors.coachingRequestNotFound", 404);
  if (String(existing.user_cid) !== String(cid)) {
    throw new LmsError("lms.errors.noCoachingAccess", 403);
  }
  if (!OPEN_STATUSES.includes(existing.status)) {
    throw new LmsError("lms.errors.coachingAlreadyHandled", 409);
  }
  return updateCoachingRequest(requestId, { status: "cancelled" });
}
