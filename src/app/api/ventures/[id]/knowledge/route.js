import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  listResources, getResource, createResource, updateResource, deleteResource,
  listCategories, toggleBookmark, getUserBookmarks, markResourceComplete,
  getRecommendedResources,
  getLearningProgress, getPersonalizedRecommendations, getLearningHistory,
  listLearningPaths, createLearningPath, getVentureLearningPaths, assignLearningPath,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const searchParams = new URL(req.url).searchParams;
  const type = searchParams.get("type") || "resources";

  // User-scoped reads derive their identity from the SESSION, never from a
  // `user_cid` query parameter (which let a caller read another user's
  // bookmarks, learning progress and history).
  const viewerCid = access.session?.cid || "sa";

  if (type === "categories") {
    const categories = await listCategories();
    return NextResponse.json({ success: true, categories });
  }

  if (type === "bookmarks") {
    const bookmarks = await getUserBookmarks(viewerCid);
    return NextResponse.json({ success: true, bookmarks });
  }

  if (type === "recommended") {
    const recommendedResources = await getRecommendedResources(id);
    return NextResponse.json({ success: true, resources: recommendedResources });
  }

  if (type === "resource" && searchParams.get("resource_id")) {
    const resource = await getResource(parseInt(searchParams.get("resource_id")), viewerCid);
    if (!resource) return NextResponse.json({ success: false, error: "Resource not found." }, { status: 404 });
    return NextResponse.json({ success: true, resource });
  }

  if (type === "learning_progress") {
    const progress = await getLearningProgress(id, viewerCid);
    return NextResponse.json({ success: true, ...progress });
  }

  if (type === "recommendations") {
    const recommendedResources = await getPersonalizedRecommendations(id, viewerCid);
    return NextResponse.json({ success: true, resources: recommendedResources });
  }

  if (type === "learning_history") {
    const history = await getLearningHistory(viewerCid);
    return NextResponse.json({ success: true, history });
  }

  if (type === "learning_paths") {
    const paths = await getVentureLearningPaths(id);
    return NextResponse.json({ success: true, paths });
  }

  if (type === "available_paths") {
    const paths = await listLearningPaths(searchParams.get("level"));
    return NextResponse.json({ success: true, paths });
  }

  // Default: list resources
  const resources = await listResources({
    category: searchParams.get("category"), type: searchParams.get("resource_type"),
    search: searchParams.get("search"), featured: searchParams.get("featured"),
    limit: parseInt(searchParams.get("limit")) || 50,
  });
  return NextResponse.json({ success: true, resources });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const body = await req.json();
  const { action } = body;

  if (action === "create") {
    try {
      const result = await createResource({
        title: body.title, description: body.description, resourceType: body.resource_type,
        categoryId: body.category_id, url: body.url, content: body.content,
        fileUrl: body.file_url, fileSize: body.file_size, fileType: body.file_type,
        estimatedMinutes: body.estimated_minutes, authorName: body.author_name,
        authorCid: req.session?.cid, tags: body.tags, isFeatured: body.is_featured,
      });
      return NextResponse.json({ success: true, resource_id: result.id });
    } catch (error) { return NextResponse.json({ success: false, error: error.message }, { status: 400 }); }
  }

  if (action === "update") {
    await updateResource(parseInt(body.resource_id), body.updates);
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    await deleteResource(parseInt(body.resource_id));
    return NextResponse.json({ success: true });
  }

  if (action === "bookmark") {
    const result = await toggleBookmark(parseInt(body.resource_id), access.session?.cid || "sa");
    return NextResponse.json({ success: true, bookmarked: result.bookmarked });
  }

  if (action === "complete") {
    await markResourceComplete(parseInt(body.resource_id), access.session?.cid || "sa");
    return NextResponse.json({ success: true });
  }

  if (action === "create_path") {
    const result = await createLearningPath({
      name: body.name, description: body.description, level: body.level,
      categoryId: body.category_id, resourceIds: body.resource_ids,
      estimatedHours: body.estimated_hours, createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, path_id: result.id });
  }

  if (action === "assign_path") {
    await assignLearningPath({ ventureId: id, pathId: parseInt(body.path_id), assignedBy: req.session?.cid });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
