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
/** A milestone id is a UUID; a task id is an integer — both validated as such. */
const UUID_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASK_ID = /^\d+$/;
const isValidEntityId = (type, id) => (type === "milestone" ? UUID_ID.test(id) : TASK_ID.test(id));

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
    // the two entities a dependency may connect, and require the id SHAPE the
    // entity really has — milestones are UUIDs, tasks are integers — so a
    // malformed body cannot insert a row no reader can resolve.
    const sourceType = typeof body.source_type === "string" ? body.source_type : "";
    const targetType = typeof body.target_type === "string" ? body.target_type : "";
    const sourceId = body.source_id === undefined || body.source_id === null ? "" : String(body.source_id);
    const targetId = body.target_id === undefined || body.target_id === null ? "" : String(body.target_id);
    if (
      !DEPENDENCY_TYPES.has(sourceType) ||
      !DEPENDENCY_TYPES.has(targetType) ||
      !isValidEntityId(sourceType, sourceId) ||
      !isValidEntityId(targetType, targetId)
    ) {
      return NextResponse.json({ success: false, error: "Invalid dependency." }, { status: 400 });
    }
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    try {
      const result = await addDependency({
        ventureId: dbId,
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
    // The dependency id comes from the request and is a UUID: the DELETE is
    // scoped to this Venture's resolved id, so it can never reach other rows.
    const dependencyId = typeof body.dependency_id === "string" ? body.dependency_id : "";
    if (!UUID_ID.test(dependencyId)) {
      return NextResponse.json({ success: false, error: "Invalid dependency." }, { status: 400 });
    }
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    await removeDependency(dependencyId, [dbId]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
