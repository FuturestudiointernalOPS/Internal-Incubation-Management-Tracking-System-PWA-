import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { canManageMilestones, releaseFirstMilestoneForStage } from "@/lib/ventureMilestoneEngine";
import { moveStageMilestone } from "@/lib/ventureMilestoneOrder";

/**
 * POST /api/ventures/[id]/milestones/reorder
 * Body: { milestone_id, direction: "up" | "down", journey_stage_id }
 *
 * Moves a milestone one position inside its Journey stage. Ordering is
 * sequential (display_order 1..n) and drives the release chain, so this is a
 * STRUCTURE action: Lead Manager or Super Admin only.
 */
export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;

  const allowed = await canManageMilestones(db, { id, cid: session?.cid, role: session?.role });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Only the Venture's Lead Manager or a Super Admin can reorder milestones." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const milestoneId = body?.milestone_id ? String(body.milestone_id) : null;
  const stageId = body?.journey_stage_id ? String(body.journey_stage_id) : null;
  const direction = body?.direction === "up" ? "up" : body?.direction === "down" ? "down" : null;
  if (!milestoneId || !stageId || !direction) {
    return NextResponse.json(
      { success: false, error: "milestone_id, journey_stage_id and direction (up|down) are required." },
      { status: 400 },
    );
  }

  const ventureRes = await db
    .execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] })
    .catch(() => ({ rows: [] }));
  const dbId = ventureRes.rows?.[0]?.id;
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  const result = await moveStageMilestone(db, { dbId, stageId, milestoneId, direction });
  if (result.error) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  // Reordering changes which milestone is first — keep the release chain
  // consistent (releases the new first unfinished one in an active journey).
  await releaseFirstMilestoneForStage(db, { dbId, stageId });
  return NextResponse.json({ success: true });
});
