import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";

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
export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const staffSide = [
    "super_admin",
    "staff",
    "program_manager",
    "teacher",
    "developer",
  ];
  let userCid = searchParams.get("user_cid");
  if (!staffSide.includes(session.role)) {
    if (userCid && String(userCid) !== String(session.cid)) {
      return NextResponse.json(
        { success: false, error: "You can only view your own assignments." },
        { status: 403 },
      );
    }
    userCid = userCid || session.cid;
  }

  if (!userCid) {
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
      args: [userCid],
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
      args: [userCid],
    });
    collab = result.rows;
  } catch (e) {
    collab = [];
  }

  // All active projects (for unlinked dropdown) — staff-side roles only
  let all_active = [];
  if (staffSide.includes(session.role)) {
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
  }

  // Combine owned + collab into a single deduplicated myProjects list
  const seen = new Set();
  const myProjects = [...owned, ...collab].filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return NextResponse.json({
    success: true,
    owned,
    collab,
    myProjects,
    all_active,
  });
});
