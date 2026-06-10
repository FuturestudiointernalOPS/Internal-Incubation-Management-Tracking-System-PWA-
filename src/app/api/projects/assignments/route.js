import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * PROJECT ASSIGNMENTS API
 *
 * GET /api/projects/assignments?user_cid=X
 *
 * Returns projects grouped by relationship to the user:
 *   owned:     projects where owner_id = user
 *   collab:    projects where user is in project_members
 *   all_active: all active projects (for dropdown)
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const user_cid = searchParams.get("user_cid");

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required." },
        { status: 400 },
      );
    }

    // Owned: projects where user is the owner
    let owned = [];
    try {
      const result = await db.execute({
        sql: `SELECT id, name, status FROM v2_projects
              WHERE owner_id = ? AND status != 'Archived'
              ORDER BY name ASC`,
        args: [user_cid],
      });
      owned = result.rows;
    } catch (e) {
      owned = [];
    }

    // Collaborating: projects where user is in project_members
    let collab = [];
    try {
      const result = await db.execute({
        sql: `SELECT p.id, p.name, p.status, pm.role as member_role
              FROM project_members pm
              INNER JOIN v2_projects p ON pm.project_id::text = p.id::text
              WHERE pm.user_cid = ? AND p.status != 'Archived'
              ORDER BY p.name ASC`,
        args: [user_cid],
      });
      collab = result.rows;
    } catch (e) {
      collab = [];
    }

    // All active projects (for unlinked dropdown)
    let all_active = [];
    try {
      const result = await db.execute({
        sql: `SELECT id, name, status FROM v2_projects
              WHERE status != 'Archived' AND status != 'Completed'
              ORDER BY name ASC`,
        args: [],
      });
      all_active = result.rows;
    } catch (e) {
      all_active = [];
    }

    return NextResponse.json({
      success: true,
      owned,
      collab,
      all_active,
    });
  } catch (error) {
    console.error("GET /api/projects/assignments error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
