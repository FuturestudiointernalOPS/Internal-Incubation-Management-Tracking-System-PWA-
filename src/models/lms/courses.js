import db from "@/lib/db";
import { LmsError } from "./errors";
import { groupBy } from "./helpers";
import { validateCourseForPublish } from "./validation";

/**
 * Course lifecycle + structure assembly.
 * Courses are standalone (not owned by any program) — Phase 6 connects them.
 */

const COURSE_SELECT = `SELECT id, title, description, thumbnail_url, status,
                              visibility, is_free, price, created_by, created_at, updated_at
                       FROM lms_courses`;

function parseCourse(row) {
  if (!row) return null;
  return { ...row, is_free: !!row.is_free };
}

export async function listCourses({ search, status } = {}) {
  const clauses = [];
  const args = [];
  if (status) {
    clauses.push("status = ?");
    args.push(status);
  }
  if (search && String(search).trim()) {
    clauses.push("(title ILIKE ? OR description ILIKE ?)");
    const like = `%${String(search).trim()}%`;
    args.push(like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await db.execute({
    sql: `${COURSE_SELECT} ${where} ORDER BY updated_at DESC`,
    args,
  });
  return res.rows.map(parseCourse);
}

export async function getCourse(courseId) {
  const res = await db.execute({
    sql: `${COURSE_SELECT} WHERE id = ?`,
    args: [courseId],
  });
  return parseCourse(res.rows[0]);
}

/**
 * Full authoring structure: course + sections (with lessons and section-level
 * assessment) + course-level assessments (with questions).
 */
export async function getCourseStructure(courseId) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);

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
  const assessmentIds = assessments.map((a) => a.id);

  let questions = [];
  if (assessmentIds.length > 0) {
    questions = (
      await db.execute({
        sql: `SELECT * FROM lms_assessment_questions WHERE assessment_id IN (${assessmentIds
          .map(() => "?")
          .join(",")}) ORDER BY position, created_at`,
        args: assessmentIds,
      })
    ).rows;
  }

  const lessonsBySection = groupBy(lessons, "section_id");
  const questionsByAssessment = groupBy(questions, "assessment_id");

  const sectionAssessments = new Map();
  const courseAssessments = [];
  for (const a of assessments) {
    const withQuestions = {
      ...a,
      questions: questionsByAssessment.get(String(a.id)) || [],
    };
    if (a.section_id) sectionAssessments.set(String(a.section_id), withQuestions);
    else courseAssessments.push(withQuestions);
  }

  return {
    ...course,
    sections: sections.map((s) => ({
      ...s,
      lessons: lessonsBySection.get(String(s.id)) || [],
      assessment: sectionAssessments.get(String(s.id)) || null,
    })),
    courseAssessments,
  };
}

export async function createCourse({
  title,
  description,
  thumbnail_url,
  visibility,
  is_free,
  price,
  createdBy,
}) {
  if (!title || !String(title).trim()) {
    throw new LmsError("lms.errors.courseTitleRequired", 400);
  }
  const isFree = is_free !== false;
  let priceValue = null;
  if (!isFree) {
    priceValue = price == null || price === "" ? null : Number(price);
    if (priceValue != null && (Number.isNaN(priceValue) || priceValue < 0)) {
      throw new LmsError("lms.errors.invalidPrice", 400);
    }
  }
  const res = await db.execute({
    sql: `INSERT INTO lms_courses (title, description, thumbnail_url, status, visibility, is_free, price, created_by)
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?) RETURNING *`,
    args: [
      String(title).trim(),
      description || null,
      thumbnail_url || null,
      visibility || "public",
      isFree,
      priceValue,
      createdBy || null,
    ],
  });
  return parseCourse(res.rows[0]);
}

const COURSE_EDITABLE = ["title", "description", "thumbnail_url", "visibility"];

export async function updateCourse(courseId, fields = {}) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);

  const sets = [];
  const args = [];

  if (fields.title !== undefined) {
    if (!String(fields.title).trim()) {
      throw new LmsError("lms.errors.courseTitleRequired", 400);
    }
    sets.push("title = ?");
    args.push(String(fields.title).trim());
  }
  for (const field of COURSE_EDITABLE) {
    if (field === "title" || fields[field] === undefined) continue;
    sets.push(`${field} = ?`);
    args.push(fields[field] || null);
  }
  if (fields.visibility !== undefined && !fields.visibility) {
    // visibility should never become null/empty — guard above already
  }

  const isFree = fields.is_free !== undefined ? !!fields.is_free : course.is_free;
  if (fields.is_free !== undefined) {
    sets.push("is_free = ?");
    args.push(isFree);
  }
  if (fields.price !== undefined || (fields.is_free !== undefined && isFree)) {
    if (isFree) {
      sets.push("price = ?");
      args.push(null);
    } else {
      const p = fields.price == null || fields.price === "" ? null : Number(fields.price);
      if (p != null && (Number.isNaN(p) || p < 0)) {
        throw new LmsError("lms.errors.invalidPrice", 400);
      }
      sets.push("price = ?");
      args.push(p);
    }
  }

  if (sets.length === 0) return course;

  sets.push("updated_at = NOW()");
  args.push(courseId);
  await db.execute({
    sql: `UPDATE lms_courses SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return getCourse(courseId);
}

export async function deleteCourse(courseId) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (course.status !== "draft") {
    throw new LmsError("lms.errors.cannotDeleteCourse", 409);
  }
  const enrollments = await db.execute({
    sql: "SELECT 1 FROM lms_enrollments WHERE course_id = ? LIMIT 1",
    args: [courseId],
  });
  if (enrollments.rows.length > 0) {
    throw new LmsError("lms.errors.cannotDeleteCourse", 409);
  }
  await db.execute({ sql: "DELETE FROM lms_courses WHERE id = ?", args: [courseId] });
  return { success: true };
}

export async function publishCourse(courseId) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (course.status === "archived") throw new LmsError("lms.errors.notDraft", 409);
  if (course.status === "published") return { success: true, alreadyPublished: true };

  const structure = await getCourseStructure(courseId);
  const result = validateCourseForPublish(course, structure);
  if (!result.valid) {
    throw new LmsError("lms.errors.publishValidationFailed", 422, result.errors);
  }

  await db.execute({
    sql: "UPDATE lms_courses SET status = 'published', updated_at = NOW() WHERE id = ?",
    args: [courseId],
  });
  return { success: true };
}

export async function archiveCourse(courseId) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (course.status === "archived") return { success: true, alreadyArchived: true };
  if (course.status === "draft") throw new LmsError("lms.errors.notPublished", 409);

  // Archiving never deletes enrollments/progress/attempts — schema cascades
  // only on explicit DELETE. Status transition only.
  await db.execute({
    sql: "UPDATE lms_courses SET status = 'archived', updated_at = NOW() WHERE id = ?",
    args: [courseId],
  });
  return { success: true };
}
