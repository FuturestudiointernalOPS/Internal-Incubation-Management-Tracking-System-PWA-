import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * PENDING USERS ENDPOINT
 * GET /api/admin/pending-users
 *
 * Returns all users with status = 'pending', grouped by group_name.
 * Used by the admin dashboard to display approval queue.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const result = await db.execute({
      sql: `SELECT cid, name, email, phone, group_name, role, created_at,
                   program_name, gender
            FROM contacts
            WHERE status = 'pending' AND deleted = 0
            ORDER BY created_at DESC`,
      args: [],
    });

    const pendingUsers = result.rows;

    // Group by group_name for display
    const grouped = {};
    for (const user of pendingUsers) {
      const group = user.group_name || "UNASSIGNED";
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(user);
    }

    return NextResponse.json({
      success: true,
      total: pendingUsers.length,
      pendingUsers,
      grouped,
    });
  } catch (error) {
    console.error("Pending users fetch error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
