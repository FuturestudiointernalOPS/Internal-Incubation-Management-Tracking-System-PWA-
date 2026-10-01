/**
 * Venture knowledge hub & learning — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/knowledge`: the resource catalogue
 * and its categories, the bookmarks and per-user progress, the recommended /
 * personalized reads, the learning activity log, the learning paths and their
 * assignments.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Resource catalogue ───────────────────────────────────────────────────────

/** Published resources (optional filters), featured first. */
export function selectResources({ category, type, search, featured, limit, offset } = {}) {
  let sql = `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.status = 'published'`;
  const args = [];
  if (category) { sql += " AND (kc.slug = ? OR kc.name = ?)"; args.push(category, category); }
  if (type) { sql += " AND kr.resource_type = ?"; args.push(type); }
  if (featured) { sql += " AND kr.is_featured = TRUE"; }
  if (search) { sql += " AND (kr.title ILIKE ? OR kr.description ILIKE ?)"; args.push(`%${search}%`, `%${search}%`); }
  sql += " ORDER BY kr.is_featured DESC, kr.created_at DESC LIMIT ? OFFSET ?"; args.push(limit, offset);
  return db.execute({ sql, args });
}

/** One resource with its category name. */
export function selectResourceById(resourceId) {
  return db.execute({ sql: `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.id = ?`, args: [resourceId] });
}

/** Bump a resource's view count. */
export function incrementResourceViewCount(resourceId) {
  return db.execute({ sql: "UPDATE knowledge_resources SET view_count = view_count + 1 WHERE id = ?", args: [resourceId] });
}

/** The name of a knowledge category. */
export function selectCategoryNameById(categoryId) {
  return db.execute({ sql: "SELECT name FROM knowledge_categories WHERE id = ?", args: [categoryId] });
}

/** Insert one resource, returning its id. */
export function insertResource({
  title, description, resourceType, categoryId, categoryName, url, content,
  fileUrl, fileSize, fileType, estimatedMinutes, authorName, authorCid, tagsJson, isFeatured,
}) {
  return db.execute({
    sql: `INSERT INTO knowledge_resources (title, description, resource_type, category_id, category_name, url, content, file_url, file_size, file_type, estimated_minutes, author_name, author_cid, tags, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?) RETURNING id`,
    args: [title, description, resourceType, categoryId, categoryName, url, content, fileUrl, fileSize, fileType, estimatedMinutes, authorName, authorCid, tagsJson, isFeatured],
  });
}

/** Apply a computed SET list to a resource. */
export function updateResourceColumns(sets, args) {
  return db.execute({ sql: `UPDATE knowledge_resources SET ${sets.join(", ")} WHERE id = ?`, args });
}

/** Delete one resource. */
export function deleteResourceRow(resourceId) {
  return db.execute({ sql: "DELETE FROM knowledge_resources WHERE id = ?", args: [resourceId] });
}

/** All knowledge categories, display order. */
export function selectCategories() {
  return db.execute({ sql: "SELECT * FROM knowledge_categories ORDER BY display_order ASC" });
}

/** Count the published resources of a category. */
export function countPublishedResourcesByCategory(categoryId) {
  return db.execute({ sql: "SELECT COUNT(*) as cnt FROM knowledge_resources WHERE category_id = ? AND status = 'published'", args: [categoryId] });
}

// ── Bookmarks + progress ─────────────────────────────────────────────────────

/** The bookmark id for a resource/user, if it exists. */
export function selectBookmarkId(resourceId, userCid) {
  return db.execute({ sql: "SELECT id FROM knowledge_bookmarks WHERE resource_id = ? AND user_cid = ?", args: [resourceId, userCid] });
}

/** Delete a bookmark by id. */
export function deleteBookmarkById(bookmarkId) {
  return db.execute({ sql: "DELETE FROM knowledge_bookmarks WHERE id = ?", args: [bookmarkId] });
}

/** Insert a bookmark. */
export function insertBookmark(resourceId, userCid) {
  return db.execute({ sql: "INSERT INTO knowledge_bookmarks (resource_id, user_cid) VALUES (?, ?)", args: [resourceId, userCid] });
}

/** A user's bookmarked resources, newest first. */
export function selectUserBookmarks(userCid) {
  return db.execute({ sql: `SELECT kr.*, kb.created_at as bookmarked_at FROM knowledge_bookmarks kb JOIN knowledge_resources kr ON kb.resource_id = kr.id WHERE kb.user_cid = ? ORDER BY kb.created_at DESC`, args: [userCid] });
}

/** Stamp a resource as viewed for a user (upsert). */
export function upsertKnowledgeProgressViewed(resourceId, userCid) {
  return db.execute({ sql: `INSERT INTO knowledge_progress (resource_id, user_cid, last_viewed_at) VALUES (?, ?, NOW()) ON CONFLICT (resource_id, user_cid) DO UPDATE SET last_viewed_at = NOW()`, args: [resourceId, userCid] });
}

/** Stamp a resource as completed for a user (upsert). */
export function upsertKnowledgeProgressCompleted(resourceId, userCid) {
  return db.execute({ sql: `INSERT INTO knowledge_progress (resource_id, user_cid, is_completed, completed_at, last_viewed_at) VALUES (?, ?, TRUE, NOW(), NOW()) ON CONFLICT (resource_id, user_cid) DO UPDATE SET is_completed = TRUE, completed_at = NOW(), last_viewed_at = NOW()`, args: [resourceId, userCid] });
}

/** Whether a user completed a resource. */
export function selectKnowledgeProgressCompleted(resourceId, userCid) {
  return db.execute({ sql: "SELECT is_completed FROM knowledge_progress WHERE resource_id = ? AND user_cid = ?", args: [resourceId, userCid] });
}

/** Append a RESOURCE_VIEWED activity row. */
export function insertKnowledgeActivityViewed(resourceId, userCid) {
  return db.execute({ sql: `INSERT INTO knowledge_activity (resource_id, user_cid, action) VALUES (?, ?, 'RESOURCE_VIEWED')`, args: [resourceId, userCid] });
}

/** Append a RESOURCE_CREATED activity row. */
export function insertKnowledgeActivityCreated(resourceId, userCid) {
  return db.execute({ sql: `INSERT INTO knowledge_activity (resource_id, user_cid, action) VALUES (?, ?, 'RESOURCE_CREATED')`, args: [resourceId, userCid] });
}

// ── Recommendation reads ─────────────────────────────────────────────────────

/** A Venture's industry. */
export function selectVentureIndustry(ventureId) {
  return db.execute({ sql: "SELECT industry FROM ventures WHERE venture_id = ?", args: [ventureId] });
}

/** A Venture's industry + business stage. */
export function selectVentureIndustryAndStage(ventureId) {
  return db.execute({ sql: "SELECT industry, business_stage FROM ventures WHERE venture_id = ?", args: [ventureId] });
}

/** Featured / industry-matching published resources. */
export function selectRecommendedResources(industry) {
  return db.execute({
    sql: `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.status = 'published' AND (kr.is_featured = TRUE OR kr.tags::text ILIKE ?) ORDER BY kr.view_count DESC, kr.created_at DESC LIMIT 10`,
    args: [`%${industry}%`],
  });
}

/** The resource ids a user completed. */
export function selectCompletedResourceIds(userCid) {
  return db.execute({ sql: "SELECT resource_id FROM knowledge_progress WHERE user_cid = ? AND is_completed = TRUE", args: [userCid] });
}

/** The resource ids a user bookmarked. */
export function selectBookmarkedResourceIds(userCid) {
  return db.execute({ sql: "SELECT resource_id FROM knowledge_bookmarks WHERE user_cid = ?", args: [userCid] });
}

/** Scored published resources for a user's industry/stage. */
export function selectScoredRecommendations(industry, stage, limit) {
  return db.execute({
    sql: `SELECT kr.*, kc.name as category_name FROM knowledge_resources kr LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kr.status = 'published' ORDER BY (CASE WHEN kr.tags::text ILIKE ? THEN 3 ELSE 0 END) + (CASE WHEN kr.tags::text ILIKE ? THEN 2 ELSE 0 END) + (kr.view_count * 0.01) + (CASE WHEN kr.is_featured THEN 2 ELSE 0 END) DESC LIMIT ?`,
    args: [`%${industry}%`, `%${stage}%`, limit],
  });
}

/** Log a recommendation (idempotent). */
export function insertRecommendationLog(ventureId, resourceId, reason, score) {
  return db.execute({ sql: `INSERT INTO learning_recommendation_log (venture_id, resource_id, reason, score) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`, args: [ventureId, resourceId, reason, score] });
}

/** A user's learning activity, newest first. */
export function selectLearningHistory(userCid, limit) {
  return db.execute({
    sql: `SELECT ka.*, kr.title as resource_title, kr.resource_type FROM knowledge_activity ka LEFT JOIN knowledge_resources kr ON ka.resource_id = kr.id WHERE ka.user_cid = ? ORDER BY ka.created_at DESC LIMIT ?`,
    args: [userCid, limit],
  });
}

// ── Learning-progress reads ──────────────────────────────────────────────────

/** Count of published resources. */
export function countPublishedResources() {
  return db.execute({ sql: "SELECT COUNT(*) as cnt FROM knowledge_resources WHERE status = 'published'", args: [] });
}

/** Count of resources a user completed. */
export function countCompletedProgress(userCid) {
  return db.execute({ sql: "SELECT COUNT(*) as cnt FROM knowledge_progress WHERE user_cid = ? AND is_completed = TRUE", args: [userCid] });
}

/** Total estimated minutes a user has completed. */
export function sumCompletedMinutes(userCid) {
  return db.execute({ sql: "SELECT COALESCE(SUM(kr.estimated_minutes), 0) as total FROM knowledge_progress kp JOIN knowledge_resources kr ON kp.resource_id = kr.id WHERE kp.user_cid = ? AND kp.is_completed = TRUE", args: [userCid] });
}

/** Completed-in-the-last-7-days count (learning streak input). */
export function countLearningStreak(userCid) {
  return db.execute({ sql: `SELECT COUNT(*) as streak FROM knowledge_progress WHERE user_cid = ? AND is_completed = TRUE AND completed_at >= NOW() - INTERVAL '7 days'`, args: [userCid] });
}

/** A user's pending resources, most recently viewed first. */
export function selectPendingResources(userCid) {
  return db.execute({ sql: `SELECT kr.id, kr.title, kr.resource_type, kc.name as category_name, kp.last_viewed_at FROM knowledge_progress kp JOIN knowledge_resources kr ON kp.resource_id = kr.id LEFT JOIN knowledge_categories kc ON kr.category_id = kc.id WHERE kp.user_cid = ? AND (kp.is_completed = FALSE OR kp.is_completed IS NULL) ORDER BY kp.last_viewed_at DESC LIMIT 10`, args: [userCid] });
}

// ── Learning paths ───────────────────────────────────────────────────────────

/** Active learning paths (optional level filter). */
export function selectLearningPaths(level) {
  let sql = "SELECT * FROM learning_paths WHERE is_active = TRUE";
  const args = [];
  if (level) { sql += " AND level = ?"; args.push(level); }
  sql += " ORDER BY level ASC, name ASC";
  return db.execute({ sql, args });
}

/** Insert one learning path, returning its id. */
export function insertLearningPath({ name, description, level, categoryId, resourceIdsJson, estimatedHours, createdBy }) {
  return db.execute({
    sql: `INSERT INTO learning_paths (name, description, level, category_id, resource_ids, estimated_hours, created_by) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id`,
    args: [name, description, level, categoryId, resourceIdsJson, estimatedHours, createdBy],
  });
}

/** A Venture's assigned learning paths, newest first. */
export function selectVentureLearningPaths(ventureId) {
  return db.execute({
    sql: `SELECT lpa.*, lp.name, lp.description, lp.level, lp.resource_ids, lp.estimated_hours FROM learning_path_assignments lpa JOIN learning_paths lp ON lpa.path_id = lp.id WHERE lpa.venture_id = ? ORDER BY lpa.assigned_at DESC`,
    args: [ventureId],
  });
}

/** Count the completed resources among a set of resource ids. */
export function countCompletedByResourceIds(resourceIds) {
  return db.execute({ sql: `SELECT COUNT(*) as c FROM knowledge_progress WHERE resource_id = ANY($1) AND is_completed = TRUE`, args: [resourceIds] });
}

/** Assign a learning path to a Venture (idempotent re-activation). */
export function upsertLearningPathAssignment(ventureId, pathId, assignedBy) {
  return db.execute({ sql: `INSERT INTO learning_path_assignments (venture_id, path_id, assigned_by) VALUES (?, ?, ?) ON CONFLICT (venture_id, path_id) DO UPDATE SET status = 'active'`, args: [ventureId, pathId, assignedBy] });
}
