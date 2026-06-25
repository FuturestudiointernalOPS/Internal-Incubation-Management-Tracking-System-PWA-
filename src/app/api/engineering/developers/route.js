import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/engineering/developers
 *
 * Returns all developers and interns for Engineering Operations.
 * Only accessible to super_admin and developer roles.
 */
export async function GET(request) {
  try {
    const authError = await requireAuth(["super_admin", "developer"]);
    if (authError) return authError;

    await initDb();

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role"); // 'developer' or 'intern'

    let sql = "SELECT * FROM contacts WHERE role IN ('developer', 'intern')";
    const args = [];

    if (role) {
      sql += " AND role = ?";
      args.push(role);
    }

    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });

    // For each developer, fetch their active task count
    const developers = await Promise.all(
      result.rows.map(async (dev) => {
        const taskRes = await db.execute({
          sql: "SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND status NOT IN ('completed', 'archived')",
          args: [dev.cid],
        });
        return {
          ...dev,
          active_tasks: parseInt(taskRes.rows[0]?.count || 0),
        };
      }),
    );

    return NextResponse.json({ success: true, developers });
  } catch (err) {
    console.error("[API engineering] GET developers failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/engineering/developers
 *
 * Updates a developer/intern record.
 * Used for: promoting intern to developer, updating status, etc.
 */
export async function PATCH(request) {
  try {
    const authError = await requireAuth(["super_admin", "developer"]);
    if (authError) return authError;

    const { cid, role, status } = await request.json();

    if (!cid) {
      return NextResponse.json(
        { success: false, error: "cid is required" },
        { status: 400 },
      );
    }

    await initDb();

    const updates = [];
    const args = [];

    if (role) {
      updates.push("role = ?");
      args.push(role);
    }

    if (status) {
      updates.push("status = ?");
      args.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    args.push(cid);

    await db.execute({
      sql: `UPDATE contacts SET ${updates.join(", ")} WHERE cid = ?`,
      args,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API engineering] PATCH developers failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
