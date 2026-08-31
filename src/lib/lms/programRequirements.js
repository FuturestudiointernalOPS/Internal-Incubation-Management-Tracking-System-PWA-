import db from "@/lib/db";
import { LmsError } from "./errors";
import { getCourse } from "./courses";
import {
  getEnrollment,
  loadStructure,
  loadEnrollmentProgress,
  loadAssessmentStates,
  computeCourseProgress,
  findContinueLesson,
} from "./learning";

/**
 * PROGRAM → LMS LEARNING REQUIREMENTS (Phase 6)
 *
 * Bridges the existing Program architecture (v2_programs) and the LMS course
 * catalogue. The course stays an LMS entity — a Program only REFERENCES it via
 * `lms_program_requirements` (UNIQUE(program_id, course_id), with optional
 * week_number / session_id context and is_required semantics).
 *
 * Design rules:
 *   - A course is never duplicated per program; many programs may reference the
 *     same course (reusable recorded content).
 *   - Learner progress stays keyed to the learner's enrollment in the LMS —
 *     the Program NEVER maintains a second progress counter. This module only
 *     READS LMS state (lms_lesson_progress / lms_assessment_attempts).
 *   - Program enrollment → automatic LMS enrollment (server-side, idempotent):
 *     `ensureProgramEnrollments(programId, cids)` inserts lms_enrollments rows
 *     with source='program' for every PUBLISHED required course. Draft/archived
 *     courses never auto-enroll new learners (draft content is never accessible
 *     to learners; archived courses stop new enrollments).
 *   - Enrollment is independent of the requirement: detaching a course does NOT
 *     silently revoke existing learners' access (their enrollment remains valid
 *     per its own terms).
 */

function parseRequirement(row) {
  if (!row) return null;
  return {
    id: row.id,
    program_id: row.program_id,
    course_id: row.course_id,
    title: row.title,
    description: row.description,
    position: row.position,
    is_required: row.is_required !== false,
    week_number: row.week_number,
    session_id: row.session_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** All learning requirements for a program, ordered by week then position. */
export async function getProgramRequirements(programId, { weekNumber, sessionId } = {}) {
  if (!programId) throw new LmsError("lms.errors.programIdRequired", 400);

  const clauses = ["program_id = ?"];
  if (weekNumber != null && weekNumber !== "") clauses.push("week_number = ?");
  if (sessionId) clauses.push("session_id = ?");
  const sql = `SELECT * FROM lms_program_requirements WHERE ${clauses.join(
    " AND ",
  )} ORDER BY week_number NULLS LAST, position, created_at`;
  const args = [String(programId)];
  if (weekNumber != null && weekNumber !== "") args.push(Number(weekNumber));
  if (sessionId) args.push(String(sessionId));

  const res = await db.execute({ sql, args });
  const requirements = res.rows.map(parseRequirement);
  if (requirements.length === 0) return [];

  // Attach course info (no JOIN — matches the codebase convention of composing
  // rows in service code).
  const courseIds = [...new Set(requirements.map((r) => String(r.course_id)))];
  const coursesRes = await db.execute({
    sql: `SELECT id, title, description, thumbnail_url, status, visibility, is_free, price
          FROM lms_courses WHERE id IN (${courseIds.map(() => "?").join(",")})`,
    args: courseIds,
  });
  const courseById = new Map(coursesRes.rows.map((c) => [String(c.id), c]));
  return requirements.map((r) => ({
    ...r,
    course: courseById.get(String(r.course_id)) || null,
  }));
}

/** Attach a course to a program (idempotent). Validates the course exists. */
export async function attachCourseToProgram({
  programId,
  courseId,
  weekNumber,
  sessionId,
  title,
  description,
  isRequired,
  position,
}) {
  if (!programId) throw new LmsError("lms.errors.programIdRequired", 400);
  if (!courseId) throw new LmsError("lms.errors.courseIdRequired", 400);

  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);

  // Program must exist (v2_programs; TEXT id — validated in service code, no FK).
  const progRes = await db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [String(programId)],
  });
  if (progRes.rows.length === 0) {
    throw new LmsError("lms.errors.programNotFound", 404);
  }

  await db.execute({
    sql: `INSERT INTO lms_program_requirements
            (program_id, course_id, title, description, position, is_required, week_number, session_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (program_id, course_id) DO NOTHING`,
    args: [
      String(programId),
      courseId,
      title || course.title || null,
      description != null ? description : course.description || null,
      position != null ? Number(position) : 0,
      isRequired !== false,
      weekNumber != null && weekNumber !== "" ? Number(weekNumber) : null,
      sessionId || null,
    ],
  });

  const list = await getProgramRequirements(String(programId), {
    weekNumber,
    sessionId,
  });
  return list.find((r) => String(r.course_id) === String(courseId)) || list[list.length - 1];
}

/** Update a learning requirement (title, required flag, week/session context). */
export async function updateProgramRequirement(requirementId, fields = {}) {
  const existing = await getRequirement(requirementId);
  if (!existing) throw new LmsError("lms.errors.requirementNotFound", 404);

  const sets = [];
  const args = [];
  if (fields.title !== undefined) {
    sets.push("title = ?");
    args.push(fields.title || null);
  }
  if (fields.description !== undefined) {
    sets.push("description = ?");
    args.push(fields.description || null);
  }
  if (fields.is_required !== undefined) {
    sets.push("is_required = ?");
    args.push(fields.is_required !== false);
  }
  if (fields.position !== undefined) {
    sets.push("position = ?");
    args.push(Number(fields.position) || 0);
  }
  if (fields.week_number !== undefined) {
    sets.push("week_number = ?");
    args.push(fields.week_number != null && fields.week_number !== "" ? Number(fields.week_number) : null);
  }
  if (fields.session_id !== undefined) {
    sets.push("session_id = ?");
    args.push(fields.session_id || null);
  }
  if (sets.length === 0) return existing;

  sets.push("updated_at = NOW()");
  args.push(requirementId);
  await db.execute({
    sql: `UPDATE lms_program_requirements SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return getRequirement(requirementId);
}

/** Detach a course from a program. Existing learner enrollments are kept. */
export async function detachCourseFromProgram(requirementId) {
  const existing = await getRequirement(requirementId);
  if (!existing) throw new LmsError("lms.errors.requirementNotFound", 404);
  await db.execute({
    sql: "DELETE FROM lms_program_requirements WHERE id = ?",
    args: [requirementId],
  });
  return { success: true, id: requirementId };
}

async function getRequirement(requirementId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_program_requirements WHERE id = ?",
    args: [requirementId],
  });
  return parseRequirement(res.rows[0]);
}

/**
 * Auto-enroll participants into every PUBLISHED required course of a program.
 * Server-side, idempotent (UNIQUE(course_id, user_cid) + ON CONFLICT). Runs
 * whenever a participant is added to a program, and whenever a course is
 * attached to a program.
 */
export async function ensureProgramEnrollments(programId, cids) {
  const participantIds = Array.isArray(cids)
    ? cids.map((c) => String(c).trim()).filter(Boolean)
    : [];
  if (participantIds.length === 0) return { enrolled: 0, skipped: 0 };

  const requirements = await getProgramRequirements(programId);
  const published = requirements.filter(
    (r) => r.course && r.course.status === "published",
  );
  if (published.length === 0) return { enrolled: 0, skipped: participantIds.length };

  let enrolled = 0;
  let skipped = 0;
  for (const req of published) {
    for (const cid of participantIds) {
      await db.execute({
        sql: `INSERT INTO lms_enrollments (course_id, user_cid, source, program_id)
              VALUES (?, ?, 'program', ?)
              ON CONFLICT (course_id, user_cid) DO NOTHING`,
        args: [req.course_id, cid, String(programId)],
      });
      // A conflict (already enrolled via admin/self/purchase) still counts as
      // access present; a suspended enrollment is left untouched.
      enrolled += 1;
    }
  }
  return { enrolled, skipped };
}

/**
 * The program's learning items for ONE participant, with LMS-derived progress.
 *
 * This is the single read surface used by the participant Program experience:
 *   Program → Learning Requirement → LMS Course → (LMS progress, read-only)
 *
 * The Program never stores progress; every field below is computed from LMS
 * state on request.
 */
export async function getProgramLearningForParticipant(programId, cid) {
  const requirements = await getProgramRequirements(programId);
  const items = [];
  for (const req of requirements) {
    if (!req.course) continue;
    const progress = await courseProgressForUser(req.course, cid);
    items.push({
      id: req.id,
      program_id: req.program_id,
      week_number: req.week_number,
      session_id: req.session_id,
      is_required: req.is_required,
      title: req.title || req.course.title,
      description: req.description || req.course.description,
      course: {
        id: req.course.id,
        title: req.course.title,
        thumbnail_url: req.course.thumbnail_url,
        status: req.course.status,
      },
      progress,
    });
  }
  return items;
}

/** LMS-derived progress for one course + learner (never throws on non-enrollment). */
export async function courseProgressForUser(course, cid) {
  if (course.status !== "published") {
    return {
      percent: 0,
      status: "unavailable",
      completedLessons: 0,
      totalLessons: 0,
      continueLesson: null,
      enrollment: null,
    };
  }

  const enrollment = await getEnrollment(course.id, cid);
  if (!enrollment || enrollment.status === "suspended") {
    return {
      percent: 0,
      status: "not_started",
      completedLessons: 0,
      totalLessons: 0,
      continueLesson: null,
      enrollment: null,
    };
  }

  const structure = await loadStructure(course.id);
  const progress = await loadEnrollmentProgress(enrollment.id);
  const assessmentStates = await loadAssessmentStates(cid, course.id);
  const assessmentProgress = [...assessmentStates.values()].map((s) => ({
    id: s.id,
    is_required: s.is_required,
    passed: s.passed,
  }));
  const cp = computeCourseProgress(structure, progress, assessmentProgress);

  return {
    percent: cp.percent,
    status: cp.complete ? "completed" : cp.status,
    completedLessons: cp.completedLessons,
    totalLessons: cp.totalLessons,
    continueLesson: cp.complete ? null : findContinueLesson(structure, progress),
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      source: enrollment.source,
      completed_at: enrollment.completed_at,
    },
  };
}

/** All program participants (participant_programs is authoritative membership). */
export async function getProgramParticipantIds(programId) {
  const res = await db.execute({
    sql: "SELECT participant_id FROM participant_programs WHERE program_id = ?",
    args: [String(programId)],
  });
  return res.rows.map((r) => String(r.participant_id).trim()).filter(Boolean);
}

/**
 * PM visibility (spec §17): per attached course, how many of the program's
 * participants are enrolled and how many have completed it. Counts come from
 * lms_enrollments only — the Program never stores progress. Used by the PM
 * workspace Learning panel; this is deliberately NOT a new analytics platform.
 */
export async function getProgramLearningSummary(programId) {
  const [requirements, participantIds] = await Promise.all([
    getProgramRequirements(programId),
    getProgramParticipantIds(programId),
  ]);
  if (participantIds.length === 0) {
    return requirements.map((r) => ({
      requirement_id: r.id,
      course_id: r.course_id,
      enrolled: 0,
      completed: 0,
    }));
  }

  const courseIds = [...new Set(requirements.map((r) => String(r.course_id)))];
  const byCourse = new Map();
  if (courseIds.length > 0) {
    const res = await db.execute({
      sql: `SELECT course_id, status FROM lms_enrollments
            WHERE course_id IN (${courseIds.map(() => "?").join(",")})
              AND user_cid IN (${participantIds.map(() => "?").join(",")})`,
      args: [...courseIds, ...participantIds],
    });
    for (const r of res.rows) {
      const key = String(r.course_id);
      const cur = byCourse.get(key) || { enrolled: 0, completed: 0 };
      cur.enrolled += 1;
      if (r.status === "completed") cur.completed += 1;
      byCourse.set(key, cur);
    }
  }

  return requirements.map((r) => {
    const s = byCourse.get(String(r.course_id)) || { enrolled: 0, completed: 0 };
    return { requirement_id: r.id, course_id: r.course_id, ...s };
  });
}
