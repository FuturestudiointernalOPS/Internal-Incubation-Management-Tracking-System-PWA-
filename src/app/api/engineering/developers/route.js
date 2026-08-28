import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";

/**
 * GET /api/engineering/developers
 *
 * Returns all developers and interns for Engineering Operations.
 * Only accessible to super_admin and developer roles.
 */
export async function GET(request) {
  try {
    const capError = await requireAuthorization("engineering", "view");
    if (capError) return capError;

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

    // Batch the per-developer active-task count into ONE grouped query instead
    // of one COUNT per developer. `assigned_to` may be a cid OR numeric id, so
    // count both, matching the original per-dev query which compared by string.
    const devIds = result.rows.map((d) => d.cid);
    let activeByCid = {};
    if (devIds.length > 0) {
      const idsPh = devIds.map(() => "?").join(",");
      const taskRes = await db.execute({
        sql: `SELECT assigned_to::text AS who, COUNT(*) AS cnt
              FROM tasks
              WHERE assigned_to::text IN (${idsPh})
                AND status NOT IN ('completed', 'archived')
              GROUP BY assigned_to::text`,
        args: devIds,
      });
      for (const r of taskRes.rows || []) {
        activeByCid[r.who] = parseInt(r.cnt, 10) || 0;
      }
    }

    const developers = result.rows.map((dev) => ({
      ...dev,
      active_tasks: activeByCid[dev.cid] || 0,
    }));

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
    const capError = await requireAuthorization("engineering", "manage_developers");
    if (capError) return capError;

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
