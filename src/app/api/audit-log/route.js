import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * AUDIT LOG API
 *
 * GET /api/audit-log?entity_type=task&entity_id=5
 *   - Returns audit log entries, filtered by query params
 *   - Supports filtering by entity_type, entity_id, user_id, action
 *
 * Designed for future Notion sync readiness.
 */

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const entity_type = searchParams.get("entity_type");
    const entity_id = searchParams.get("entity_id");
    const user_id = searchParams.get("user_id");
    const action = searchParams.get("action");
    const limit = searchParams.get("limit");

    let sql = "SELECT * FROM audit_log WHERE 1=1";
    const args = [];

    if (entity_type) {
      sql += " AND entity_type = ?";
      args.push(entity_type);
    }

    if (entity_id) {
      sql += " AND entity_id = ?";
      args.push(parseInt(entity_id));
    }

    if (user_id) {
      sql += " AND user_id = ?";
      args.push(user_id);
    }

    if (action) {
      sql += " AND action = ?";
      args.push(action);
    }

    sql += " ORDER BY created_at DESC";

    if (limit) {
      sql += " LIMIT ?";
      args.push(parseInt(limit));
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, entries: result.rows });
  } catch (error) {
    console.error("GET audit-log error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
