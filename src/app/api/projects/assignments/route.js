import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

/**
 * PROJECT ASSIGNMENTS API
 *
 * GET /api/projects/assignments?user_cid=X
 *
 * Returns all active projects a user is assigned to,
 * along with their role in each project.
 * Used by staff for task creation filtering in standups/retros.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const user_cid = searchParams.get("user_cid");

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "user_cid is required." },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `
        SELECT p.id, p.name, p.status, p.program_id, pr.name as program_name,
               pm.role as member_role
        FROM project_members pm
        INNER JOIN v2_projects p ON pm.project_id = p.id
        LEFT JOIN v2_programs pr ON p.program_id = pr.id
        WHERE pm.user_cid = ? AND p.status != 'Archived'
        ORDER BY p.name ASC
      `,
      args: [user_cid],
    });

    return NextResponse.json({ success: true, projects: result.rows });
  } catch (error) {
    console.error("GET /api/projects/assignments error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
