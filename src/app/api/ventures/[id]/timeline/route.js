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

/** The only entity kinds a legacy dependency may connect. */
const DEPENDENCY_TYPES = new Set(["milestone", "task"]);

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
    // The ids and types come straight from the request. Restrict the types to
    // the two entities a dependency may connect, and require positive integer
    // ids so a malformed body cannot insert a row no reader can resolve.
    const sourceType = typeof body.source_type === "string" ? body.source_type : "";
    const targetType = typeof body.target_type === "string" ? body.target_type : "";
    const sourceId = Number.parseInt(body.source_id, 10);
    const targetId = Number.parseInt(body.target_id, 10);
    if (
      !DEPENDENCY_TYPES.has(sourceType) ||
      !DEPENDENCY_TYPES.has(targetType) ||
      !Number.isInteger(sourceId) || sourceId <= 0 ||
      !Number.isInteger(targetId) || targetId <= 0
    ) {
      return NextResponse.json({ success: false, error: "Invalid dependency." }, { status: 400 });
    }
    try {
      const result = await addDependency({
        ventureId: id,
        sourceType,
        sourceId,
        targetType,
        targetId,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
  }

  if (body.action === "remove_dependency") {
    // The dependency id comes from the request: only one that belongs to THIS
    // venture may be removed (accepts both the code and the numeric id).
    const dependencyId = Number.parseInt(body.dependency_id, 10);
    if (!Number.isInteger(dependencyId) || dependencyId <= 0) {
      return NextResponse.json({ success: false, error: "Invalid dependency." }, { status: 400 });
    }
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    await removeDependency(dependencyId, [id, dbId]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
