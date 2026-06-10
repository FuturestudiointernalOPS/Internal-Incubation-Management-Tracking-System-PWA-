import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * ADMIN BLOCKERS API
 *
 * GET /api/admin/blockers
 *   Super Admin view: all blockers across all users.
 *   Supports filtering by status and task_id.
 *
 * PUT /api/admin/blockers
 *   Override resolve: allows admin/PM to resolve any blocker.
 *   Body: { id, resolved_by }
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const task_id = searchParams.get("task_id");

    let sql = `SELECT b.*, t.title AS task_title, t.project_id, t.user_name AS task_owner
               FROM blockers b
               JOIN tasks t ON b.task_id = t.id
               WHERE 1=1`;
    const args = [];

    if (status) {
      sql += " AND b.status = ?";
      args.push(status);
    }
    if (task_id) {
      sql += " AND b.task_id = ?";
      args.push(parseInt(task_id));
    }

    sql +=
      " ORDER BY CASE WHEN b.status = 'active' THEN 0 ELSE 1 END, b.created_at DESC";

    const result = await db.execute({ sql, args });

    return NextResponse.json({ success: true, blockers: result.rows });
  } catch (error) {
    console.error("GET admin/blockers error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { id, resolved_by } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "blocker id is required" },
        { status: 400 },
      );
    }

    // Fetch the blocker
    const blockerCheck = await db.execute({
      sql: "SELECT * FROM blockers WHERE id = ?",
      args: [parseInt(id)],
    });

    if (blockerCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Blocker not found" },
        { status: 404 },
      );
    }

    const blocker = blockerCheck.rows[0];

    // Admin override: resolve regardless of ownership
    await db.execute({
      sql: "UPDATE blockers SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?",
      args: [resolved_by || "admin", parseInt(id)],
    });

    // Check if the task has any other active blockers
    const activeBlockers = await db.execute({
      sql: "SELECT id FROM blockers WHERE task_id = ? AND status = 'active' AND id != ?",
      args: [blocker.task_id, parseInt(id)],
    });

    if (activeBlockers.rows.length === 0) {
      // No more active blockers, revert task to in_progress
      await db.execute({
        sql: "UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'blocked'",
        args: [blocker.task_id],
      });
    }

    return NextResponse.json({
      success: true,
      action: "resolved",
      message: "Blocker resolved by admin.",
    });
  } catch (error) {
    console.error("PUT admin/blockers error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
