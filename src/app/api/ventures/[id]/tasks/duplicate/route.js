import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { duplicateTask } from "@/lib/ventureDuplication";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/tasks/duplicate
 * { task_id } — duplicate a single task (same milestone binding, fresh
 * 'backlog' copy, " — Copy" title). Submissions/reviews are never copied.
 *
 * Auth: same as task creation — any Venture-access holder.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;

    const body = await req.json();
    const taskId = body.task_id ? String(body.task_id) : null;
    if (!taskId) return NextResponse.json({ success: false, error: "task_id is required." }, { status: 400 });

    const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] }).catch(() => ({ rows: [] }));
    const dbId = ventureRes.rows?.[0]?.id || (id.includes("-") && !id.startsWith("VNT-") ? id : null);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const result = await duplicateTask(db, { dbId, code: id, taskId, actorCid: session.cid || null });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.error === "Task not found." ? 404 : 400 });
    }

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({
        venture_id: id,
        event_type: "TASK_DUPLICATED",
        description: `Task "${result.task.title}" duplicated (structure only)`,
      });
    } catch (_) {}

    return NextResponse.json({ success: true, task: result.task });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
