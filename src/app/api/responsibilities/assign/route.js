import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  assignResponsibility,
  removeResponsibility,
  logPermissionAudit,
} from "@/lib/auth";

/**
 * PUT /api/responsibilities/assign
 *
 * Assign or remove a responsibility for a user.
 * Body: { user_cid, responsibility_id, action: 'assign' | 'remove' }
 */
export async function PUT(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { user_cid, responsibility_id, action } = body;

    if (!user_cid || !responsibility_id || !action) {
      return NextResponse.json(
        { success: false, error: "user_cid, responsibility_id, and action are required" },
        { status: 400 },
      );
    }

    await initDb();

    // Get responsibility name for audit
    const resp = await db.execute({
      sql: "SELECT name FROM responsibilities WHERE id = ?",
      args: [responsibility_id],
    });
    const respName = resp.rows[0]?.name || "Unknown";

    // Get target user name
    const target = await db.execute({
      sql: "SELECT name FROM contacts WHERE cid = ?",
      args: [user_cid],
    });
    const targetName = target.rows[0]?.name || "Unknown";

    if (action === "assign") {
      const result = await assignResponsibility(user_cid, responsibility_id, session?.cid);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: user_cid,
        targetName,
        action: "responsibility_assigned",
        details: `Assigned responsibility: ${respName}`,
      });

      return NextResponse.json({
        success: true,
        message: `Assigned "${respName}" to ${targetName}`,
      });
    }

    if (action === "remove") {
      const result = await removeResponsibility(user_cid, responsibility_id);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      await logPermissionAudit({
        actorCid: session?.cid,
        actorName: session?.name,
        targetCid: user_cid,
        targetName,
        action: "responsibility_removed",
        details: `Removed responsibility: ${respName}`,
      });

      return NextResponse.json({
        success: true,
        message: `Removed "${respName}" from ${targetName}`,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}. Use 'assign' or 'remove'` },
      { status: 400 },
    );
  } catch (err) {
    console.error("[Responsibilities Assign] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/responsibilities/assign?user_cid=X
 *
 * Get all responsibilities assigned to a user, with toggle info.
 * Also returns all available responsibilities so the UI can show
 * which ones are assigned and which aren't.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");

    if (!userCid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required" },
        { status: 400 },
      );
    }

    // Get all active responsibilities
    const all = await db.execute({
      sql: "SELECT * FROM responsibilities WHERE is_active = 1 ORDER BY name",
    });

    // Get user's assigned responsibilities
    const assigned = await db.execute({
      sql: `SELECT r.id, r.name, r.key
            FROM responsibilities r
            JOIN user_responsibilities ur ON ur.responsibility_id = r.id
            WHERE ur.user_cid = ? AND r.is_active = 1
            ORDER BY r.name`,
      args: [userCid],
    });

    const assignedIds = new Set(assigned.rows.map((r) => r.id));

    // Build full response with toggle state
    const responsibilities = all.rows.map((r) => ({
      ...r,
      assigned: assignedIds.has(r.id),
    }));

    const user = await db.execute({
      sql: "SELECT cid, name, role FROM contacts WHERE cid = ?",
      args: [userCid],
    });

    return NextResponse.json({
      success: true,
      user: user.rows[0] || null,
      responsibilities,
    });
  } catch (err) {
    console.error("[Responsibilities Assign GET] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
