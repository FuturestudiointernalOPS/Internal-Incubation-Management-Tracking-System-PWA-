import db from "@/lib/db";
import { LmsError } from "./errors";
import { getEnrollment } from "./learning";

/**
 * COACHING REQUESTS (Phase 8)
 *
 * A learner, while working through a course, asks for coaching BEFORE, DURING
 * or AFTER that course. This is deliberately a request *queue*, not a
 * scheduling engine:
 *
 *   learner → lms_coaching_requests (status 'pending')
 *           → program staff notified (v2_notifications)
 *           → staff decision recorded on the same row (accepted / declined /
 *             completed) + a response note the learner sees.
 *
 * Rules:
 *   - Access is enrollment-derived, exactly like the rest of the learner
 *     experience: a request can only be created for a course the caller is
 *     actually enrolled in (never from a client-supplied course id alone).
 *   - `program_id` is resolved server-side (enrollment first, then the course's
 *     program requirement). `lms_coaching_requests.program_id` / `.session_id`
 *     style TEXT ids carry no FK — see docs/LMS_ARCHITECTURE.md §8.
 *   - One open request per (learner, course): pressing the button twice while a
 *     request is pending returns the SAME row instead of flooding the queue.
 *   - Notification text is data-bearing (learner, course, timing) and stored on
 *     `v2_notifications`, matching the existing notification convention.
 */

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
  const lessonRes = await db.execute({
    sql: "SELECT id, section_id FROM lms_lessons WHERE id = ?",
    args: [lessonId],
  });
  const lesson = lessonRes.rows[0];
  if (!lesson) throw new LmsError("lms.errors.lessonNotFound", 404);

  const sectionRes = await db.execute({
    sql: "SELECT id, course_id FROM lms_course_sections WHERE id = ?",
    args: [lesson.section_id],
  });
  const section = sectionRes.rows[0];
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
  const res = await db.execute({
    sql: "SELECT program_id FROM lms_program_requirements WHERE course_id = ? ORDER BY position, created_at LIMIT 1",
    args: [courseId],
  });
  return res.rows[0]?.program_id ? String(res.rows[0].program_id) : null;
}

/** Program staff (assigned PM + assigned staff) — the people who can answer. */
export async function getProgramStaffIds(programId) {
  if (!programId) return [];
  const ids = new Set();

  const programRes = await db.execute({
    sql: "SELECT assigned_pm_id FROM v2_programs WHERE id = ?",
    args: [String(programId)],
  });
  const pmId = programRes.rows[0]?.assigned_pm_id;
  if (pmId) ids.add(String(pmId));

  const staffRes = await db.execute({
    // `::text` cast matches the existing v2_program_staff readers (the column's
    // UUID-vs-TEXT form varies across deployments).
    sql: "SELECT staff_id FROM v2_program_staff WHERE program_id::text = ?",
    args: [String(programId)],
  });
  for (const row of staffRes.rows || []) {
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
      await db.execute({
        sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, 'coaching_request', 0, NOW())`,
        args: [cid, title, message],
      });
    }
    return recipients.length;
  } catch (e) {
    console.error("[LMS] coaching notification failed:", e.message);
    return 0;
  }
}

/** Notify the learner that their request moved. Never throws. */
async function notifyLearner(cid, title, message) {
  try {
    await db.execute({
      sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, 'coaching_request', 0, NOW())`,
      args: [String(cid), title, message],
    });
  } catch (e) {
    console.error("[LMS] coaching notification to learner failed:", e.message);
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

  const courseRes = await db.execute({
    sql: "SELECT id, title, status FROM lms_courses WHERE id = ?",
    args: [courseId],
  });
  const course = courseRes.rows[0];
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
  const openRes = await db.execute({
    sql: "SELECT * FROM lms_coaching_requests WHERE user_cid = ? AND course_id = ? AND status = 'pending' LIMIT 1",
    args: [String(cid), courseId],
  });
  if (openRes.rows.length > 0) {
    return { request: parseRequest(openRes.rows[0]), duplicate: true, notified: 0 };
  }

  const ins = await db.execute({
    sql: `INSERT INTO lms_coaching_requests
            (user_cid, program_id, course_id, lesson_id, timing, topic, message, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') RETURNING *`,
    args: [
      String(cid),
      programId,
      courseId,
      lessonId || null,
      resolvedTiming,
      topic ? String(topic).trim() : null,
      message ? String(message).trim() : null,
    ],
  });
  const request = parseRequest(ins.rows[0]);

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
  const res = await db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ? LIMIT 1",
    args: [String(cid)],
  });
  return res.rows[0]?.name || String(cid);
}

async function getCourseTitle(courseId) {
  if (!courseId) return "";
  const res = await db.execute({
    sql: "SELECT title FROM lms_courses WHERE id = ? LIMIT 1",
    args: [courseId],
  });
  return res.rows[0]?.title || String(courseId);
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
  const res = await db.execute({
    sql: `SELECT * FROM lms_coaching_requests${where} ORDER BY created_at DESC`,
    args,
  });
  return res.rows.map(parseRequest);
}

/** Attach learner, course and lesson labels (composed in code — no JOIN). */
async function enrichRequests(requests) {
  if (requests.length === 0) return [];

  const cids = [...new Set(requests.map((r) => String(r.user_cid)))];
  const courseIds = [...new Set(requests.filter((r) => r.course_id).map((r) => String(r.course_id)))];
  const lessonIds = [...new Set(requests.filter((r) => r.lesson_id).map((r) => String(r.lesson_id)))];
  const programIds = [...new Set(requests.filter((r) => r.program_id).map((r) => String(r.program_id)))];

  const [contactsRes, coursesRes, lessonsRes, programsRes] = await Promise.all([
    cids.length > 0
      ? db.execute({
          sql: `SELECT cid, name, email FROM contacts WHERE cid IN (${cids.map(() => "?").join(",")})`,
          args: cids,
        })
      : { rows: [] },
    courseIds.length > 0
      ? db.execute({
          sql: `SELECT id, title FROM lms_courses WHERE id IN (${courseIds.map(() => "?").join(",")})`,
          args: courseIds,
        })
      : { rows: [] },
    lessonIds.length > 0
      ? db.execute({
          sql: `SELECT id, title FROM lms_lessons WHERE id IN (${lessonIds.map(() => "?").join(",")})`,
          args: lessonIds,
        })
      : { rows: [] },
    programIds.length > 0
      ? db.execute({
          sql: `SELECT id, name FROM v2_programs WHERE id IN (${programIds.map(() => "?").join(",")})`,
          args: programIds,
        })
      : { rows: [] },
  ]);

  const byCid = new Map(contactsRes.rows.map((r) => [String(r.cid), r]));
  const byCourse = new Map(coursesRes.rows.map((r) => [String(r.id), r]));
  const byLesson = new Map(lessonsRes.rows.map((r) => [String(r.id), r]));
  const byProgram = new Map(programsRes.rows.map((r) => [String(r.id), r]));

  return requests.map((r) => {
    const contact = byCid.get(String(r.user_cid));
    const course = r.course_id ? byCourse.get(String(r.course_id)) : null;
    const lesson = r.lesson_id ? byLesson.get(String(r.lesson_id)) : null;
    const program = r.program_id ? byProgram.get(String(r.program_id)) : null;
    return {
      ...r,
      learner_name: contact?.name || String(r.user_cid),
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
  return enriched.map((r) => ({
    ...r,
    can_cancel: OPEN_STATUSES.includes(r.status),
  }));
}

/** Program queue for staff (PM workspace). */
export async function listCoachingRequests({ programId, courseId, status } = {}) {
  if (!programId) throw new LmsError("lms.errors.programIdRequired", 400);
  const requests = await selectRequests({ programId, courseId, status });
  return enrichRequests(requests);
}

export async function getCoachingRequest(requestId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_coaching_requests WHERE id = ?",
    args: [requestId],
  });
  return parseRequest(res.rows[0]);
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
  await db.execute({
    sql: `UPDATE lms_coaching_requests SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

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

