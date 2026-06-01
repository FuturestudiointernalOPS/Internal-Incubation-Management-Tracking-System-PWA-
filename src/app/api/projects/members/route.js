import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

/**
 * PROJECT MEMBERS API
 *
 * POST   /api/projects/members    - Add a member to a project
 * DELETE /api/projects/members    - Remove a member from a project
 * GET    /api/projects/members?project_id=X  - List members of a project
 *
 * Body (POST): { project_id, user_cid, role }
 * Body (DELETE): { project_id, user_cid }
 */

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { project_id, user_cid, role = "member" } = body;

    if (!project_id || !user_cid) {
      return NextResponse.json(
        { success: false, error: "project_id and user_cid are required." },
        { status: 400 },
      );
    }

    // Verify project exists
    const projectCheck = await db.execute({
      sql: "SELECT id FROM v2_projects WHERE id = ?",
      args: [parseInt(project_id)],
    });

    if (projectCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found." },
        { status: 404 },
      );
    }

    // Upsert member (in case they're already assigned)
    await db.execute({
      sql: `INSERT INTO project_members (project_id, user_cid, role)
            VALUES (?, ?, ?)
            ON CONFLICT (project_id, user_cid) DO UPDATE SET role = ?`,
      args: [parseInt(project_id), user_cid, role, role],
    });

    return NextResponse.json({ success: true, action: "member_added" });
  } catch (error) {
    console.error("POST /api/projects/members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");
    const user_cid = searchParams.get("user_cid");

    if (!project_id || !user_cid) {
      return NextResponse.json(
        { success: false, error: "project_id and user_cid are required." },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "DELETE FROM project_members WHERE project_id = ? AND user_cid = ?",
      args: [parseInt(project_id), user_cid],
    });

    return NextResponse.json({ success: true, action: "member_removed" });
  } catch (error) {
    console.error("DELETE /api/projects/members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");

    if (!project_id) {
      return NextResponse.json(
        { success: false, error: "project_id is required." },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `SELECT pm.*, c.name, c.email
            FROM project_members pm
            LEFT JOIN contacts c ON pm.user_cid = c.cid
            WHERE pm.project_id = ?
            ORDER BY pm.role, c.name`,
      args: [parseInt(project_id)],
    });

    return NextResponse.json({ success: true, members: result.rows });
  } catch (error) {
    console.error("GET /api/projects/members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
