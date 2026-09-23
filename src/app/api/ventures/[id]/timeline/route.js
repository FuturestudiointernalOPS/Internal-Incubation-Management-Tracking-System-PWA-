import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { resolveVentureDbId } from "@/lib/ventureOwnership";
import {
  getProjectTimeline,
  getGanttData,
  calculateProjectProgress,
  getDelaySummary,
  addDependency,
  removeDependency,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/timeline[?view=gantt|progress|delay]
 *
 * Returns timeline, Gantt, progress, or delay data.
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
  if (access.error) return access.error;
  const view = new URL(req.url).searchParams.get("view") || "timeline";

  if (view === "gantt") {
    const data = await getGanttData(id);
    return NextResponse.json({ success: true, ...data });
  }

  if (view === "progress") {
    const progress = await calculateProjectProgress(id);
    return NextResponse.json({ success: true, progress });
  }

  if (view === "delay") {
    const delay = await getDelaySummary(id);
    return NextResponse.json({ success: true, ...delay });
  }

  // Default: timeline
  const timeline = await getProjectTimeline(id);
  return NextResponse.json({ success: true, ...timeline });
});

/**
 * POST /api/ventures/[id]/timeline
 *
 * Add or remove dependencies.
 */
export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const body = await req.json();

  if (body.action === "add_dependency") {
    try {
      const result = await addDependency({
        ventureId: id,
        sourceType: body.source_type,
        sourceId: parseInt(body.source_id),
        targetType: body.target_type,
        targetId: parseInt(body.target_id),
      });
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
  }

  if (body.action === "remove_dependency") {
    // The dependency id comes from the request: only one that belongs to THIS
    // venture may be removed (accepts both the code and the numeric id).
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    await removeDependency(parseInt(body.dependency_id), [id, dbId]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
