import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { logVentureActivity, addVentureHistory } from "@/lib/ventures";

/**
 * POST /api/ventures/[id]/lifecycle — Venture lifecycle transitions (Phase 3)
 *
 * Body: { action: "pause" | "resume" | "archive" }
 *
 * Rules:
 *  - privileged Future Studio roles only (staff / super_admin / program_manager /
 *    developer / admin)
 *  - pause    → status = 'paused'
 *  - resume   → status = 'active', is_archived = 0
 *  - archive  → status = 'archived', is_archived = 1 (historical record —
 *    nothing is deleted; member accounts and contacts remain intact)
 *
 * Every transition is audited in venture_history + venture_activity_log.
 */

const ACTIONS = ["pause", "resume", "archive"];
const STATUS_BY_ACTION = { pause: "paused", resume: "active", archive: "archived" };

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    if (!["super_admin", "staff", "program_manager", "developer", "admin"].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Only Future Studio staff can change a Venture's lifecycle." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await req.json();
    const action = body?.action;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: `action must be one of: ${ACTIONS.join(", ")}` },
        { status: 400 },
      );
    }

    // Resolve the VNT code (ventures store the code as their business key).
    let ventureId = id;
    if (typeof id === "string" && id.includes("-") && !id.startsWith("VNT-")) {
      const byId = await db.execute({ sql: "SELECT id, venture_id FROM ventures WHERE id::text = ?", args: [id] });
      if (byId.rows?.[0]) ventureId = byId.rows[0].venture_id;
    }
    const exists = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
    if (exists.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Venture not found." }, { status: 404 });
    }

    const status = STATUS_BY_ACTION[action];
    const isArchived = action === "archive" ? 1 : action === "resume" ? 0 : null;
    await db.execute({
      sql: `UPDATE ventures
            SET status = ?, is_archived = COALESCE(?, is_archived), updated_at = NOW()
            WHERE venture_id = ?`,
      args: [status, isArchived, ventureId],
    });

    // Audit trail
    const note = `Venture ${action} by ${session.name || session.cid || "staff"}`;
    try {
      await addVentureHistory({ venture_id: ventureId, event_type: `VENTURE_${action.toUpperCase()}`, description: note });
    } catch (_) {}
    try {
      await logVentureActivity({
        venture_id: ventureId,
        action: `VENTURE_${action.toUpperCase()}`,
        actor_cid: session.cid || "system",
        actor_name: session.name || "System",
        details: { new_status: status, archived: action === "archive" },
      });
    } catch (_) {}

    return NextResponse.json({ success: true, venture_id: ventureId, status, is_archived: isArchived });
  } catch (error) {
    console.error("POST /api/ventures/[id]/lifecycle error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
