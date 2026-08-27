import db from "@/lib/db";
import { LmsError } from "./errors";
import { getCourse } from "./courses";

/**
 * LMS learner experience services.
 *
 * Access model (server-side, never trust client IDs):
 *   User → valid lms_enrollment → Course → Access
 *
 * Progress model (Phase 1 schema — lms_lesson_progress):
 *   progress = completed required lessons / total required lessons × 100
 *   Optional lessons never block completion.
 *   One progress row per (enrollment, lesson) — completion is idempotent.
 */

// ─── Pure progress logic (unit-tested) ─────────────────────────────────────

/**
 * Compute course progress from the structure and per-lesson progress.
 *
 * @param {Array<{lessons: Array}>} sections
 * @param {Record<string,string>} progress  lessonId -> status
 * @returns {{percent: number, status: string, complete: boolean,
 *            completedLessons: number, totalLessons: number,
 *            completedRequired: number, totalRequired: number}}
 */
export function computeCourseProgress(sections = [], progress = {}) {
  const lessons = (sections || []).flatMap((s) => s.lessons || []);
  const total = lessons.length;
  const required = lessons.filter((l) => l.is_required !== false);
  const totalRequired = required.length;
  const completed = lessons.filter((l) => progress[l.id] === "completed").length;
  const completedRequired = required.filter((l) => progress[l.id] === "completed").length;

  let percent;
  if (totalRequired > 0) percent = Math.round((completedRequired / totalRequired) * 100);
  else if (total > 0) percent = completed === total ? 100 : 0;
  else percent = 0;

  const complete =
    totalRequired > 0
      ? completedRequired === totalRequired
      : total > 0 && completed === total;

  let status = "not_started";
  if (complete) status = "completed";
  else if (completed > 0) status = "in_progress";

  return {
    percent,
    status,
    complete,
    completedLessons: completed,
    totalLessons: total,
    completedRequired,
    totalRequired,
  };
}

/**
 * First lesson (in section/lesson order) that is not completed — the resume
 * point. Returns null when the course learning content is complete.
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

// ─── Data loaders ──────────────────────────────────────────────────────────

async function loadEnrollmentProgress(enrollmentId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_lesson_progress WHERE enrollment_id = ?",
    args: [enrollmentId],
  });
  const byLesson = {};
  for (const row of res.rows) byLesson[String(row.lesson_id)] = row.status;
  return byLesson;
}

/** Sections + lessons + assessments (NO questions/answers — learner-safe). */
async function loadStructure(courseId) {
  const sectionsRes = await db.execute({
    sql: "SELECT * FROM lms_course_sections WHERE course_id = ? ORDER BY position, created_at",
    args: [courseId],
  });
  const sections = sectionsRes.rows;
  const sectionIds = sections.map((s) => s.id);

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
  for (const l of lessons) {
    (lessonsBySection[String(l.section_id)] ??= []).push(l);
  }

  return sections.map((s) => ({
    ...s,
    lessons: lessonsBySection[String(s.id)] || [],
    assessment: assessments.find((a) => String(a.section_id) === String(s.id)) || null,
  }));
}

async function getEnrollment(courseId, userCid) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_enrollments WHERE course_id = ? AND user_cid = ? LIMIT 1",
    args: [courseId, userCid],
  });
  return res.rows[0] || null;
}

function learnerAssessment(a) {
  if (!a) return null;
  return { id: a.id, title: a.title, pass_mark: a.pass_mark, is_required: a.is_required };
}

// ─── Learner-facing services ───────────────────────────────────────────────

/** Enrolled courses + progress + resume point for the learner's My Learning. */
export async function getLearnerCourses(userCid) {
  const enrollRes = await db.execute({
    sql: "SELECT * FROM lms_enrollments WHERE user_cid = ? ORDER BY enrolled_at DESC",
    args: [userCid],
  });
  const enrollments = enrollRes.rows;
  if (enrollments.length === 0) return [];

  const courseIds = [...new Set(enrollments.map((e) => String(e.course_id)))];
  const coursesRes = await db.execute({
    sql: `SELECT * FROM lms_courses WHERE id IN (${courseIds.map(() => "?").join(",")})`,
    args: courseIds,
  });
  const courseById = new Map(coursesRes.rows.map((c) => [String(c.id), c]));

  const result = [];
  for (const enrollment of enrollments) {
    const course = courseById.get(String(enrollment.course_id));
    if (!course) continue;
    const structure = await loadStructure(course.id);
    const progress = await loadEnrollmentProgress(enrollment.id);
    const courseProgress = computeCourseProgress(structure, progress);
    result.push({
      enrollment,
      course,
      progress: courseProgress,
      continueLesson: courseProgress.complete ? null : findContinueLesson(structure, progress),
    });
  }
  return result;
}

/**
 * Learner-scoped course view. Enforces enrollment server-side.
 * Assessments are exposed WITHOUT questions/answers.
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
  const courseProgress = computeCourseProgress(structure, progress);
  const continueLesson = courseProgress.complete ? null : findContinueLesson(structure, progress);

  const sections = structure.map((s) => {
    const completedInSection = s.lessons.filter((l) => progress[String(l.id)] === "completed").length;
    return {
      id: s.id,
      title: s.title,
      position: s.position,
      assessment: learnerAssessment(s.assessment),
      progress: { completed: completedInSection, total: s.lessons.length },
      lessons: s.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        position: l.position,
        is_required: l.is_required,
        duration_minutes: l.duration_minutes,
        youtube_video_id: l.youtube_video_id,
        state: progress[String(l.id)] === "completed" ? "completed" : "not_started",
      })),
    };
  });
  // Mark the resume lesson as the "current" one.
  if (continueLesson) {
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (String(lesson.id) === String(continueLesson.lessonId)) lesson.state = "current";
      }
    }
  }

  const courseLevel = await db.execute({
    sql: "SELECT * FROM lms_assessments WHERE course_id = ? AND section_id IS NULL ORDER BY position, created_at",
    args: [courseId],
  });

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
    sections,
    courseAssessments: courseLevel.rows.map(learnerAssessment),
  };
}

/**
 * Mark a lesson complete (idempotent). The lesson → section → course chain is
 * derived server-side, so a learner can never target lessons outside their
 * enrolled course. Marks the enrollment completed when all required lessons
 * are done (course-completion state for Phase 5; no certificates here).
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

  // Recompute course progress + completion state.
  const structure = await loadStructure(course.id);
  const progress = await loadEnrollmentProgress(enrollment.id);
  const courseProgress = computeCourseProgress(structure, progress);

  if (courseProgress.complete && enrollment.status !== "completed") {
    await db.execute({
      sql: "UPDATE lms_enrollments SET status = 'completed', completed_at = COALESCE(completed_at, NOW()) WHERE id = ?",
      args: [enrollment.id],
    });
  }

  return {
    success: true,
    lessonId,
    courseProgress,
    courseCompleted: courseProgress.complete,
  };
}

// ─── Admin enrollment enabler (Phase 3 needs enrollments to exist) ─────────

export async function enrollLearner({ courseId, userCid, userEmail, source, assignedBy }) {
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
  const cids = [...new Set(enrollments.map((e) => e.user_cid))];
  const byCid = new Map();
  if (cids.length > 0) {
    const contactsRes = await db.execute({
      sql: `SELECT cid, name, email FROM contacts WHERE cid IN (${cids.map(() => "?").join(",")})`,
      args: cids,
    });
    for (const c of contactsRes.rows) byCid.set(String(c.cid), c);
  }
  return enrollments.map((e) => ({
    id: e.id,
    user_cid: e.user_cid,
    source: e.source,
    status: e.status,
    enrolled_at: e.enrolled_at,
    completed_at: e.completed_at,
    learner: byCid.get(String(e.user_cid)) || null,
  }));
}
