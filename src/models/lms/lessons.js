import db from "@/lib/db";
import { LmsError } from "./errors";
import { nextPosition } from "./helpers";
import { extractYouTubeVideoId } from "./youtube";
import { getSection } from "./sections";

/**
 * Lesson authoring. V1 content type is VIDEO (YouTube unlisted).
 * The lesson stores only `youtube_video_id` — never the URL, never the file.
 */

export async function getLesson(lessonId) {
  const res = await db.execute({
    sql: "SELECT * FROM lms_lessons WHERE id = ?",
    args: [lessonId],
  });
  return res.rows[0] || null;
}

/** Empty → null (allowed in drafts); non-empty invalid → 400. */
function normalizeVideo(value) {
  if (value == null || String(value).trim() === "") return null;
  const id = extractYouTubeVideoId(value);
  if (!id) throw new LmsError("lms.errors.invalidYouTubeUrl", 400);
  return id;
}

export async function createLesson({
  sectionId,
  title,
  description,
  youtubeVideoId,
  isRequired,
  durationMinutes,
}) {
  const section = await getSection(sectionId);
  if (!section) throw new LmsError("lms.errors.sectionNotFound", 404);
  if (!title || !String(title).trim()) {
    throw new LmsError("lms.errors.lessonTitleRequired", 400);
  }
  const videoId = normalizeVideo(youtubeVideoId);
  const position = await nextPosition("lms_lessons", "section_id", sectionId);
  const res = await db.execute({
    sql: `INSERT INTO lms_lessons (section_id, title, description, position, is_required, content_type, youtube_video_id, duration_minutes)
          VALUES (?, ?, ?, ?, ?, 'video', ?, ?) RETURNING *`,
    args: [
      sectionId,
      String(title).trim(),
      description || null,
      position,
      isRequired !== false,
      videoId,
      durationMinutes || null,
    ],
  });
  return res.rows[0];
}

export async function updateLesson(
  lessonId,
  { title, description, youtubeVideoId, isRequired, durationMinutes } = {},
) {
  const lesson = await getLesson(lessonId);
  if (!lesson) throw new LmsError("lms.errors.lessonNotFound", 404);

  const sets = [];
  const args = [];

  if (title !== undefined) {
    if (!String(title).trim()) throw new LmsError("lms.errors.lessonTitleRequired", 400);
    sets.push("title = ?");
    args.push(String(title).trim());
  }
  if (description !== undefined) {
    sets.push("description = ?");
    args.push(description || null);
  }
  if (youtubeVideoId !== undefined) {
    sets.push("youtube_video_id = ?");
    args.push(normalizeVideo(youtubeVideoId));
  }
  if (isRequired !== undefined) {
    sets.push("is_required = ?");
    args.push(isRequired !== false);
  }
  if (durationMinutes !== undefined) {
    sets.push("duration_minutes = ?");
    args.push(durationMinutes || null);
  }

  if (sets.length === 0) return lesson;
  sets.push("updated_at = NOW()");
  args.push(lessonId);
  await db.execute({
    sql: `UPDATE lms_lessons SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
  return getLesson(lessonId);
}

/** Swap a lesson with its up/down neighbour within the same section. */
export async function moveLesson(lessonId, direction) {
  const lesson = await getLesson(lessonId);
  if (!lesson) throw new LmsError("lms.errors.lessonNotFound", 404);
  if (direction !== "up" && direction !== "down") {
    throw new LmsError("lms.errors.invalidDirection", 400);
  }
  const neighbor = await db.execute({
    sql:
      direction === "up"
        ? `SELECT id, position FROM lms_lessons
           WHERE section_id = ? AND position < ? ORDER BY position DESC LIMIT 1`
        : `SELECT id, position FROM lms_lessons
           WHERE section_id = ? AND position > ? ORDER BY position ASC LIMIT 1`,
    args: [lesson.section_id, lesson.position],
  });
  if (neighbor.rows.length === 0) return { success: true, moved: false };
  const target = neighbor.rows[0];

  await db.transaction(async (query) => {
    await query("UPDATE lms_lessons SET position = -1 WHERE id = ?", [lesson.id]);
    await query("UPDATE lms_lessons SET position = ? WHERE id = ?", [
      lesson.position,
      target.id,
    ]);
    await query("UPDATE lms_lessons SET position = ? WHERE id = ?", [
      target.position,
      lesson.id,
    ]);
  });
  return { success: true, moved: true };
}

export async function deleteLesson(lessonId) {
  const lesson = await getLesson(lessonId);
  if (!lesson) throw new LmsError("lms.errors.lessonNotFound", 404);

  const progress = await db.execute({
    sql: "SELECT 1 FROM lms_lesson_progress WHERE lesson_id = ? LIMIT 1",
    args: [lessonId],
  });
  if (progress.rows.length > 0) {
    throw new LmsError("lms.errors.cannotDeleteWithProgress", 409);
  }
  await db.execute({ sql: "DELETE FROM lms_lessons WHERE id = ?", args: [lessonId] });
  return { success: true };
}
