import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/user-groups?user_cid=X
 *
 * Returns all groups a user belongs to.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const userCid = searchParams.get("user_cid");

    if (!userCid) {
      return NextResponse.json(
        { success: false, error: "user_cid required" },
        { status: 400 },
      );
    }

    // First try user_groups table (may not exist yet — migration pending)
    let groups = [];
    try {
      const result = await db.execute({
        sql: "SELECT group_name, role_in_group FROM user_groups WHERE user_cid = ? ORDER BY group_name",
        args: [userCid],
      });
      groups = result.rows.map((r) => r.group_name);
    } catch (e) {
      // user_groups table may not exist yet — fall through to legacy group_name
      groups = [];
    }

    // Fallback to legacy group_name on contacts
    if (groups.length === 0) {
      try {
        const userRes = await db.execute({
          sql: "SELECT group_name FROM contacts WHERE cid = ?",
          args: [userCid],
        });
        if (userRes.rows.length > 0 && userRes.rows[0].group_name) {
          groups = [userRes.rows[0].group_name];
        }
      } catch (_) {}
    }

    return NextResponse.json({ success: true, groups, user_cid: userCid });
  } catch (err) {
    console.error("[user-groups] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/user-groups
 *
 * Assign a user to a group.
 * Body: { user_cid, group_name }
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { user_cid, group_name } = await req.json();

    if (!user_cid || !group_name) {
      return NextResponse.json(
        { success: false, error: "user_cid and group_name required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: `INSERT INTO user_groups (user_cid, group_name, assigned_by)
            VALUES (?, ?, 'admin')
            ON CONFLICT (user_cid, group_name) DO NOTHING`,
      args: [user_cid, group_name.toUpperCase()],
    });

    return NextResponse.json({
      success: true,
      message: `User added to ${group_name}`,
    });
  } catch (err) {
    console.error("[user-groups] POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user-groups
 *
 * Remove a user from a group.
 * Body: { user_cid, group_name }
 */
export async function DELETE(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const body = await req.json();
    const { user_cid, group_name } = body;

    if (!user_cid || !group_name) {
      return NextResponse.json(
        { success: false, error: "user_cid and group_name required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "DELETE FROM user_groups WHERE user_cid = ? AND group_name = ?",
      args: [user_cid, group_name.toUpperCase()],
    });

    return NextResponse.json({
      success: true,
      message: `User removed from ${group_name}`,
    });
  } catch (err) {
    console.error("[user-groups] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
