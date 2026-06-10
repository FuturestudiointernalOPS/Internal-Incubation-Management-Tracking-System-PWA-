import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * PROJECT MEMBERS API
 *
 * GET    /api/projects/members?project_id=X
 * POST   /api/projects/members  { project_id, user_cid, role }
 * DELETE /api/projects/members?project_id=X&user_cid=Y
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "project_id is required" },
        { status: 400 },
      );
    }

    // Get members with names from contacts
    const result = await db.execute({
      sql: `SELECT pm.*, c.name
            FROM project_members pm
            LEFT JOIN contacts c ON pm.user_cid = c.cid OR pm.user_cid = c.id
            WHERE pm.project_id::text = ?
            ORDER BY pm.role ASC, c.name ASC`,
      args: [projectId],
    });

    return NextResponse.json({ success: true, members: result.rows });
  } catch (error) {
    console.error("GET project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { project_id, user_cid, role } = await req.json();

    if (!project_id || !user_cid) {
      return NextResponse.json(
        { success: false, error: "project_id and user_cid are required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: `INSERT INTO project_members (project_id, user_cid, role, assigned_at)
            VALUES (?, ?, ?, NOW())
            ON CONFLICT (project_id, user_cid)
            DO UPDATE SET role = ?, assigned_at = NOW()`,
      args: [project_id, user_cid, role || "member", role || "member"],
    });

    return NextResponse.json({ success: true, action: "added" });
  } catch (error) {
    console.error("POST project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");
    const userCid = searchParams.get("user_cid");

    if (!projectId || !userCid) {
      return NextResponse.json(
        { success: false, error: "project_id and user_cid are required" },
        { status: 400 },
      );
    }

    await db.execute({
      sql: "DELETE FROM project_members WHERE project_id::text = ? AND user_cid = ?",
      args: [projectId, userCid],
    });

    return NextResponse.json({ success: true, action: "removed" });
  } catch (error) {
    console.error("DELETE project members error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
