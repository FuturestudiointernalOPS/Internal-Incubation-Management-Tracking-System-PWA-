import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/projects/invitations?invitee_id=X&status=pending
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const invitee_id = searchParams.get("invitee_id");
    const status = searchParams.get("status") || "pending";
    const project_id = searchParams.get("project_id");

    let sql = "SELECT pi.*, p.name as project_name FROM project_invitations pi LEFT JOIN v2_projects p ON pi.project_id = p.id::text WHERE 1=1";
    const args = [];

    if (invitee_id) {
      sql += " AND pi.invitee_id = ?";
      args.push(invitee_id);
    }
    if (status) {
      sql += " AND pi.status = ?";
      args.push(status);
    }
    if (project_id) {
      sql += " AND pi.project_id = ?";
      args.push(project_id);
    }

    sql += " ORDER BY pi.created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, invitations: result.rows });
  } catch (error) {
    console.error("GET invitations error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
