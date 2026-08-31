import db from "@/lib/db";
import { LmsError } from "./errors";

/**
 * PUBLIC COURSE CATALOGUE (Phase 7)
 *
 * Marketing-safe read surface for the public website. Responsibilities stay
 * separated: the website handles discovery/conversion, ImpactOS handles
 * authentication, enrollment and learning. Only PUBLISHED + public courses are
 * ever exposed; draft/archived courses never appear here, and private course
 * data (YouTube video ids, assessment answers, learner records) is never
 * serialized. Internal DB ids are deliberately NOT exposed — public pages
 * navigate by slug; the enroll endpoint resolves the slug server-side.
 */

const PUBLIC_COURSE_SELECT = `SELECT id, slug, title, description, thumbnail_url,
                                     is_free, price, created_at, updated_at
                              FROM lms_courses`;

/** Lesson/section counts + duration for a set of course ids (no GROUP BY —
 *  matches the codebase convention of composing rows in service code). */
async function loadContentStats(courseIds) {
  const stats = new Map();
  if (courseIds.length === 0) return stats;
  const placeholders = courseIds.map(() => "?").join(",");

  // Fetch every section row (not just course ids) so lessons can be mapped
  // back to their course through section_id.
  const sectionsRes = await db.execute({
    sql: `SELECT id, course_id FROM lms_course_sections
          WHERE course_id IN (${placeholders})`,
    args: courseIds,
  });
  for (const r of sectionsRes.rows) {
    const key = String(r.course_id);
    const cur = stats.get(key) || { sections: 0, lessons: 0, duration_minutes: 0 };
    cur.sections += 1;
    stats.set(key, cur);
  }
  const sectionIds = sectionsRes.rows.map((r) => String(r.id));
  if (sectionIds.length === 0) return stats;
  const sectionPlaceholders = sectionIds.map(() => "?").join(",");

  const lessonsRes = await db.execute({
    sql: `SELECT section_id, duration_minutes FROM lms_lessons
          WHERE section_id IN (${sectionPlaceholders})`,
    args: sectionIds,
  });
  const sectionToCourse = new Map(sectionsRes.rows.map((r) => [String(r.id), String(r.course_id)]));
  for (const r of lessonsRes.rows) {
    const key = sectionToCourse.get(String(r.section_id));
    if (!key) continue;
    const cur = stats.get(key) || { sections: 0, lessons: 0, duration_minutes: 0 };
    cur.lessons += 1;
    cur.duration_minutes += Number(r.duration_minutes || 0);
    stats.set(key, cur);
  }
  return stats;
}

function toPublicCourse(row, stats) {
  const s = stats.get(String(row.id)) || { sections: 0, lessons: 0, duration_minutes: 0 };
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    is_free: row.is_free !== false,
    price: row.is_free === false ? Number(row.price || 0) : null,
    sections: s.sections,
    lessons: s.lessons,
    duration_minutes: s.duration_minutes,
    updated_at: row.updated_at,
  };
}

/** All publicly discoverable courses (published + public visibility). */
export async function listPublicCourses() {
  const res = await db.execute({
    sql: `${PUBLIC_COURSE_SELECT} WHERE status = ? AND visibility = ?
          ORDER BY updated_at DESC`,
    args: ["published", "public"],
  });
  const courses = res.rows;
  if (courses.length === 0) return [];
  const stats = await loadContentStats(courses.map((c) => String(c.id)));
  return courses.map((c) => toPublicCourse(c, stats));
}

/** One public course by slug (404 unless published + public). Returns the
 *  marketing-safe course object plus the internal id (used server-side only
 *  for structure loading; never serialized). */
export async function getPublicCourseBySlug(slug) {
  const value = String(slug || "").trim();
  if (!value) throw new LmsError("lms.errors.courseNotFound", 404);

  const res = await db.execute({
    sql: `${PUBLIC_COURSE_SELECT} WHERE slug = ?`,
    args: [value],
  });
  const row = res.rows[0];
  if (!row) throw new LmsError("lms.errors.courseNotFound", 404);
  if (row.status !== "published" || row.visibility !== "public") {
    throw new LmsError("lms.errors.courseNotFound", 404);
  }
  const stats = await loadContentStats([String(row.id)]);
  return { course: toPublicCourse(row, stats), id: String(row.id) };
}

/**
 * Public course structure (marketing-safe): section titles + lesson titles +
 * assessment count. Lesson YouTube ids and assessment answers are private and
 * NEVER exposed here.
 */
export async function getPublicCourseStructure(courseId) {
  const sectionsRes = await db.execute({
    sql: "SELECT id, title, description, position FROM lms_course_sections WHERE course_id = ? ORDER BY position, created_at",
    args: [courseId],
  });
  const sections = sectionsRes.rows;
  const sectionIds = sections.map((s) => s.id);

  let lessons = [];
  if (sectionIds.length > 0) {
    lessons = (
      await db.execute({
        sql: `SELECT section_id, title, position FROM lms_lessons
              WHERE section_id IN (${sectionIds.map(() => "?").join(",")})
              ORDER BY position, created_at`,
        args: sectionIds,
      })
    ).rows;
  }

  const assessmentsRes = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM lms_assessments WHERE course_id = ?",
    args: [courseId],
  });

  const lessonsBySection = {};
  for (const l of lessons) {
    (lessonsBySection[String(l.section_id)] ??= []).push({
      title: l.title,
      position: l.position,
    });
  }

  return {
    sections: sections.map((s) => ({
      title: s.title,
      description: s.description,
      position: s.position,
      lessons: lessonsBySection[String(s.id)] || [],
    })),
    assessments: Number(assessmentsRes.rows[0]?.n || 0),
  };
}

/** Resolve a published public course by slug for the enroll flow. */
export async function getPublicCourseIdBySlug(slug) {
  const value = String(slug || "").trim();
  if (!value) return null;
  const res = await db.execute({
    sql: `SELECT id, status, visibility, is_free FROM lms_courses WHERE slug = ?`,
    args: [value],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (row.status !== "published" || row.visibility !== "public") return null;
  return row;
}
