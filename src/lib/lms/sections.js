import db from "@/lib/db";
import { LmsError } from "./errors";
import { nextPosition } from "./helpers";
import { getCourse } from "./courses";

export async function getSection(sectionId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_course_sections WHERE id = ?",
    args: [sectionId],
  });
  return res.rows[0] || null;
}

export async function createSection({ courseId, title, description }) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (!title || !String(title).trim()) {
    throw new LmsError("lms.errors.sectionTitleRequired", 400);
  }
  const position = await nextPosition("lms_course_sections", "course_id", courseId);
  const res = await db.execute({
    sql: `INSERT INTO lms_course_sections (course_id, title, description, position)
          VALUES (?, ?, ?, ?) RETURNING *`,
    args: [courseId, String(title).trim(), description || null, position],
  });
  return res.rows[0];
}

export async function updateSection(sectionId, { title, description } = {}) {
  const section = await getSection(sectionId);
  if (!section) throw new LmsError("lms.errors.sectionNotFound", 404);
  if (title !== undefined) {
    if (!String(title).trim()) throw new LmsError("lms.errors.sectionTitleRequired", 400);
    await db.execute({
      sql: "UPDATE lms_course_sections SET title = ?, updated_at = NOW() WHERE id = ?",
      args: [String(title).trim(), sectionId],
    });
  }
  if (description !== undefined) {
    await db.execute({
      sql: "UPDATE lms_course_sections SET description = ?, updated_at = NOW() WHERE id = ?",
      args: [description || null, sectionId],
    });
  }
  return getSection(sectionId);
}

/** Swap a section with its up/down neighbour (simple reordering, no drag-dep). */
export async function moveSection(sectionId, direction) {
  const section = await getSection(sectionId);
  if (!section) throw new LmsError("lms.errors.sectionNotFound", 404);
  if (direction !== "up" && direction !== "down") {
    throw new LmsError("lms.errors.invalidDirection", 400);
  }
  const neighbor = await db.execute({
    sql:
      direction === "up"
        ? `SELECT id, position FROM lms_course_sections
           WHERE course_id = ? AND position < ? ORDER BY position DESC LIMIT 1`
        : `SELECT id, position FROM lms_course_sections
           WHERE course_id = ? AND position > ? ORDER BY position ASC LIMIT 1`,
    args: [section.course_id, section.position],
  });
  if (neighbor.rows.length === 0) return { success: true, moved: false };
  const target = neighbor.rows[0];

  // Swap positions inside a transaction. The UNIQUE(course_id, position)
  // constraint needs a temporary value to avoid a transient conflict.
  await db.transaction(async (query) => {
    await query("UPDATE lms_course_sections SET position = -1 WHERE id = ?", [section.id]);
    await query("UPDATE lms_course_sections SET position = ? WHERE id = ?", [
      section.position,
      target.id,
    ]);
    await query("UPDATE lms_course_sections SET position = ? WHERE id = ?", [
      target.position,
      section.id,
    ]);
  });
  return { success: true, moved: true };
}

/**
 * Persist an arbitrary section order (drag & drop) for one course.
 * `orderedIds` must contain every section of the course exactly once;
 * positions are rewritten 0..n-1 inside a transaction (two passes with
 * negative staging values to respect the UNIQUE(course_id, position) constraint).
 */
export async function reorderSections(courseId, orderedIds) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new LmsError("lms.errors.reorderInvalid", 400);
  }

  const res = await db.execute({
    sql: "SELECT id, position, title FROM lms_course_sections WHERE course_id = ?",
    args: [courseId],
  });
  const current = res.rows;
  const requested = orderedIds.map((id) => String(id));
  if (current.length !== requested.length || new Set(requested).size !== requested.length) {
    throw new LmsError("lms.errors.reorderInvalid", 400);
  }
  const currentIds = new Set(current.map((r) => String(r.id)));
  if (!requested.every((id) => currentIds.has(id))) {
    throw new LmsError("lms.errors.reorderInvalid", 400);
  }

  const sorted = [...current].sort((a, b) => a.position - b.position);
  const unchanged = sorted.every((r, i) => String(r.id) === requested[i]);
  if (unchanged) return { success: true, moved: false };

  await db.transaction(async (query) => {
    // Stage every row on a negative position so no transient duplicate occurs.
    for (let i = 0; i < requested.length; i++) {
      await query("UPDATE lms_course_sections SET position = ? WHERE id = ?", [
        -1 - i,
        requested[i],
      ]);
    }
    for (let i = 0; i < requested.length; i++) {
      await query("UPDATE lms_course_sections SET position = ? WHERE id = ?", [
        i,
        requested[i],
      ]);
    }
  });
  return { success: true, moved: true };
}

export async function deleteSection(sectionId) {
  const section = await getSection(sectionId);
  if (!section) throw new LmsError("lms.errors.sectionNotFound", 404);

  // Safe-delete guard: never destroy lessons that already have learner progress.
  const lessons = await db.execute({
    sql: "SELECT id FROM lms_lessons WHERE section_id = ?",
    args: [sectionId],
  });
  const lessonIds = lessons.rows.map((r) => r.id);
  if (lessonIds.length > 0) {
    const progress = await db.execute({
      sql: `SELECT 1 FROM lms_lesson_progress WHERE lesson_id IN (${lessonIds
        .map(() => "?")
        .join(",")}) LIMIT 1`,
      args: lessonIds,
    });
    if (progress.rows.length > 0) {
      throw new LmsError("lms.errors.cannotDeleteWithProgress", 409);
    }
  }
  await db.execute({
    sql: "DELETE FROM lms_course_sections WHERE id = ?",
    args: [sectionId],
  });
  return { success: true };
}
