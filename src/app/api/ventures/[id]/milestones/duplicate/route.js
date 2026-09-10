import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { duplicateMilestone } from "@/lib/ventureDuplication";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/milestones/duplicate
 * { milestone_id } — duplicate a milestone (keeping its Journey stage binding,
 * if any) as an independent structure copy with fresh tasks.
 *
 * History (submissions, reviews, comments, activity) is never copied.
 * Auth: same as milestone creation — any Venture-access holder.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;

    const body = await req.json();
    const milestoneId = body.milestone_id ? String(body.milestone_id) : null;
    if (!milestoneId) return NextResponse.json({ success: false, error: "milestone_id is required." }, { status: 400 });

    // Internal UUID + VNT code accepted as owner values (legacy rows exist on both).
    const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] }).catch(() => ({ rows: [] }));
    const dbId = ventureRes.rows?.[0]?.id || (id.includes("-") && !id.startsWith("VNT-") ? id : null);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const result = await duplicateMilestone(db, { dbId, code: id, milestoneId, actorCid: session.cid || null });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.error === "Milestone not found." ? 404 : 400 });
    }

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({
        venture_id: id,
        event_type: "MILESTONE_DUPLICATED",
        description: `Milestone "${result.milestone.title}" duplicated with its tasks (structure only)`,
      });
    } catch (_) {}

    return NextResponse.json({ success: true, milestone: result.milestone, tasks_copied: result.tasks_copied });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
