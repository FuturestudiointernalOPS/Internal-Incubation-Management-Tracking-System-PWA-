/**
 * VENTURE KNOWLEDGE HUB & LEARNING.
 *
 * The knowledge resource catalogue (list / read with bookmark+progress, create /
 * update / delete, categories), the bookmarks and per-user progress, the
 * recommended and personalized recommendations, the learning activity history,
 * the learning paths and their assignments.
 *
 * The decisions — the resource-type allow-list, the recommendation scoring and
 * reasons, the completion percentages, the streak and the path-completion maths —
 * live here; every statement is in `@/models/ventureKnowledgeStore`. Nothing here
 * runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) — see
 * docs/LAYER_SPLIT.md.
 */

import {
  selectResources,
  selectResourceById,
  incrementResourceViewCount,
  selectCategoryNameById,
  insertResource,
  updateResourceColumns,
  deleteResourceRow,
  selectCategories,
  countPublishedResourcesByCategory,
  selectBookmarkId,
  deleteBookmarkById,
  insertBookmark,
  selectUserBookmarks,
  upsertKnowledgeProgressViewed,
  upsertKnowledgeProgressCompleted,
  selectKnowledgeProgressCompleted,
  insertKnowledgeActivityViewed,
  insertKnowledgeActivityCreated,
  selectVentureIndustry,
  selectVentureIndustryAndStage,
  selectRecommendedResources,
  selectCompletedResourceIds,
  selectBookmarkedResourceIds,
  selectScoredRecommendations,
  insertRecommendationLog,
  selectLearningHistory,
  countPublishedResources,
  countCompletedProgress,
  sumCompletedMinutes,
  countLearningStreak,
  selectPendingResources,
  selectLearningPaths,
  insertLearningPath,
  selectVentureLearningPaths,
  countCompletedByResourceIds,
  upsertLearningPathAssignment,
} from "@/models/ventureKnowledgeStore";

export const RESOURCE_TYPES = ["article", "video", "pdf", "template", "checklist", "presentation", "external_link", "course", "case_study"];

export async function listResources({ category, type, search, featured, limit = 50, offset = 0 }) {
  const res = await selectResources({ category, type, search, featured, limit, offset });
  return (res.rows || []).map((row) => ({ ...row, tags: typeof row.tags === "string" ? JSON.parse(row.tags) : (row.tags || []) }));
}

export async function getResource(resourceId, userCid) {
  const res = await selectResourceById(resourceId);
  if (res.rows.length === 0) return null;
  const resource = res.rows[0]; resource.tags = typeof resource.tags === "string" ? JSON.parse(resource.tags) : (resource.tags || []);
  await incrementResourceViewCount(resourceId);
  if (userCid) {
    await upsertKnowledgeProgressViewed(resourceId, userCid);
    await insertKnowledgeActivityViewed(resourceId, userCid);
    const bookmarkResult = await selectBookmarkId(resourceId, userCid);
    resource.is_bookmarked = bookmarkResult.rows.length > 0;
    const progressResult = await selectKnowledgeProgressCompleted(resourceId, userCid);
    resource.is_completed = progressResult.rows.length > 0 && progressResult.rows[0].is_completed;
  }
  return resource;
}

export async function createResource({ title, description, resourceType, categoryId, url, content, fileUrl, fileSize, fileType, estimatedMinutes, authorName, authorCid, tags, isFeatured }) {
  if (!title?.trim()) throw new Error("Title is required.");
  if (!RESOURCE_TYPES.includes(resourceType)) throw new Error(`Invalid resource type: "${resourceType}".`);
  const catName = categoryId ? (await selectCategoryNameById(categoryId)).rows[0]?.name : null;
  const id = (await insertResource({
    title: title.trim(), description: description||null, resourceType, categoryId: categoryId||null, categoryName: catName,
    url: url||null, content: content||null, fileUrl: fileUrl||null, fileSize: fileSize||null, fileType: fileType||null,
    estimatedMinutes: estimatedMinutes||null, authorName: authorName||null, authorCid: authorCid||null,
    tagsJson: JSON.stringify(tags||[]), isFeatured: isFeatured?1:0,
  })).rows[0]?.id;
  await insertKnowledgeActivityCreated(id, authorCid||"system");
  return { id };
}

export async function updateResource(resourceId, updates) {
  const allowed = ["title", "description", "resource_type", "category_id", "url", "content", "file_url", "file_size", "file_type", "estimated_minutes", "tags", "status", "is_featured"];
  const sets = []; const args = [];
  for (const column of allowed) { if (updates[column] !== undefined) { sets.push(`${column} = ?`); args.push(updates[column]); } }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()"); args.push(resourceId);
  await updateResourceColumns(sets, args);
  return { updated: true };
}

export async function deleteResource(resourceId) {
  await deleteResourceRow(resourceId);
  return { success: true };
}

export async function listCategories() {
  const res = await selectCategories();
  for (const cat of res.rows || []) {
    const countResult = await countPublishedResourcesByCategory(cat.id);
    cat.resource_count = parseInt(countResult.rows[0]?.cnt || 0);
  }
  return res.rows || [];
}

export async function toggleBookmark(resourceId, userCid) {
  const existing = await selectBookmarkId(resourceId, userCid);
  if (existing.rows.length > 0) { await deleteBookmarkById(existing.rows[0].id); return { bookmarked: false }; }
  await insertBookmark(resourceId, userCid);
  return { bookmarked: true };
}

export async function getUserBookmarks(userCid) {
  const res = await selectUserBookmarks(userCid);
  return (res.rows || []).map((row) => ({ ...row, tags: typeof row.tags === "string" ? JSON.parse(row.tags) : (row.tags || []) }));
}

export async function markResourceComplete(resourceId, userCid) {
  await upsertKnowledgeProgressCompleted(resourceId, userCid);
  return { success: true };
}

export async function getRecommendedResources(ventureId) {
  const ventureResult = await selectVentureIndustry(ventureId);
  const industry = ventureResult.rows[0]?.industry || "";
  const res = await selectRecommendedResources(industry);
  return (res.rows || []).map((row) => ({ ...row, tags: typeof row.tags === "string" ? JSON.parse(row.tags) : (row.tags || []) }));
}

export async function getLearningProgress(ventureId, userCid) {
  const [totalRes, completedRes, hoursRes, streakRes, pendingRes] = await Promise.all([
    countPublishedResources(),
    countCompletedProgress(userCid),
    sumCompletedMinutes(userCid),
    countLearningStreak(userCid),
    selectPendingResources(userCid),
  ]);
  const total = parseInt(totalRes.rows[0]?.cnt || 1);
  const completed = parseInt(completedRes.rows[0]?.cnt || 0);
  const hoursLearned = Math.round(parseFloat(hoursRes.rows[0]?.total || 0) / 60 * 10) / 10;
  return {
    total_resources: total, completed_resources: completed,
    completion_percentage: Math.round((completed / total) * 100),
    hours_learned: hoursLearned,
    learning_streak: parseInt(streakRes.rows[0]?.streak || 0),
    pending_resources: pendingRes.rows || [],
  };
}

export async function getPersonalizedRecommendations(ventureId, userCid, limit = 10) {
  const ventureResult = await selectVentureIndustryAndStage(ventureId);
  const venture = ventureResult.rows[0] || {};
  const industry = venture.industry || "";
  const stage = venture.business_stage || "";
  const completed = await selectCompletedResourceIds(userCid);
  const completedIds = new Set((completed.rows || []).map((row) => row.resource_id));
  const bookmarked = await selectBookmarkedResourceIds(userCid);
  const bookmarkedIds = new Set((bookmarked.rows || []).map((row) => row.resource_id));

  const res = await selectScoredRecommendations(industry, stage, limit * 2);

  const results = [];
  for (const resource of res.rows || []) {
    if (results.length >= limit) break;
    if (completedIds.has(resource.id)) continue;
    resource.is_bookmarked = bookmarkedIds.has(resource.id);
    resource.tags = typeof resource.tags === "string" ? JSON.parse(resource.tags) : (resource.tags || []);
    const tagsLower = (resource.tags || []).map((tag) => tag.toLowerCase());
    resource.recommendation_reason = tagsLower.some((tag) => industry.toLowerCase().includes(tag))
      ? "Based on your industry" : resource.is_featured ? "Featured resource" : "Popular resource";
    results.push(resource);
    await insertRecommendationLog(ventureId, resource.id, resource.recommendation_reason, 0).catch(() => {});
  }
  return results;
}

export async function getLearningHistory(userCid, limit = 20) {
  const res = await selectLearningHistory(userCid, limit);
  return res.rows || [];
}

export async function listLearningPaths(level) {
  const res = await selectLearningPaths(level);
  return (res.rows || []).map((path) => ({ ...path, resource_ids: typeof path.resource_ids === "string" ? JSON.parse(path.resource_ids) : (path.resource_ids || []) }));
}

export async function createLearningPath({ name, description, level, categoryId, resourceIds, estimatedHours, createdBy }) {
  const id = (await insertLearningPath({
    name: name.trim(),
    description: description||null,
    level: level||"beginner",
    categoryId: categoryId||null,
    resourceIdsJson: JSON.stringify(resourceIds||[]),
    estimatedHours: estimatedHours||null,
    createdBy: createdBy||"system",
  })).rows[0]?.id;
  return { id };
}

export async function getVentureLearningPaths(ventureId) {
  const res = await selectVentureLearningPaths(ventureId);
  const paths = [];
  for (const row of res.rows || []) {
    const resourceIds = typeof row.resource_ids === "string" ? JSON.parse(row.resource_ids) : (row.resource_ids || []);
    const completedCount = resourceIds.length > 0 ? (await countCompletedByResourceIds(resourceIds).catch(() => ({ rows: [{ c: 0 }] }))).rows[0]?.c || 0 : 0;
    paths.push({ ...row, resource_ids: resourceIds, completion: resourceIds.length > 0 ? Math.round((completedCount / resourceIds.length) * 100) : 0 });
  }
  return paths;
}

export async function assignLearningPath({ ventureId, pathId, assignedBy }) {
  await upsertLearningPathAssignment(ventureId, pathId, assignedBy||"system");
  return { success: true };
}
