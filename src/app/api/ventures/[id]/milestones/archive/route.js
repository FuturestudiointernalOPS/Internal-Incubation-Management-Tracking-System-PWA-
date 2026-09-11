import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { applyBulk } from "@/lib/ventureArchive";
import { canManageMilestones, completeStageIfAllMilestonesDone } from "@/lib/ventureMilestoneEngine";

/**
 * POST /api/ventures/[id]/milestones/archive
 * Body: { ids: [..], action: "archive" | "restore" }
 *
 * Soft delete: milestones (and their tasks) are archived, never removed.
 * Milestones that already have filed work (submissions/reviews/deliverables)
 * are blocked — they are part of the Venture's record. Response reports
 * archived/restored/blocked per id so the UI can show exactly what happened.
 */
export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;

  // Removing/restoring a milestone is a STRUCTURE action: Lead Manager or
  // Super Admin only.
  const allowed = await canManageMilestones(db, { id, cid: session?.cid, role: session?.role });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Only the Venture's Lead Manager or a Super Admin can remove milestones." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const ids = Array.isArray(body?.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
  const action = body?.action === "restore" ? "restore" : "archive";
  if (ids.length === 0) return NextResponse.json({ success: false, error: "No milestones selected." }, { status: 400 });

  const rowsRes = await db.execute({
    sql: `SELECT m.id, m.title, m.journey_stage_id, v.id AS venture_db_id FROM venture_milestones m
          JOIN ventures v ON v.id = m.venture_id
          WHERE (v.venture_id = ? OR v.id::text = ?)
            AND m.id::text = ANY(?)`,
    args: [id, id, ids],
  }).catch(() => ({ rows: [] }));

  const summary = await applyBulk(db, {
    rows: rowsRes.rows || [],
    actorCid: session.cid || null,
    action,
    kind: "milestone",
  });

  // Archiving a milestone can leave a journey with every remaining milestone
  // completed — the journey then closes automatically.
  if (action === "archive") {
    const dbId = (rowsRes.rows || [])[0]?.venture_db_id || null;
    const stageIds = [...new Set((rowsRes.rows || []).map((r) => r.journey_stage_id).filter(Boolean))];
    if (dbId) {
      for (const stageId of stageIds) {
        await completeStageIfAllMilestonesDone(db, { dbId, stageId, cid: session.cid });
      }
    }
  }

  return NextResponse.json({ success: true, ...summary });
});
