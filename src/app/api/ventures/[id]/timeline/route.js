import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
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
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
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
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
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
    } catch (e) {
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
  }

  if (body.action === "remove_dependency") {
    await removeDependency(parseInt(body.dependency_id));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
