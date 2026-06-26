import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/engineering/permissions/audit
 *
 * Returns the permission change audit log.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const { searchParams } = new URL(req.url);
    const targetCid = searchParams.get("target_cid");
    const limit = parseInt(searchParams.get("limit")) || 100;

    let sql = "SELECT * FROM permission_audit_log";
    const args = [];

    if (targetCid) {
      sql += " WHERE target_cid = ?";
      args.push(targetCid);
    }

    sql += " ORDER BY created_at DESC LIMIT ?";
    args.push(limit);

    const result = await db.execute({ sql, args });

    return NextResponse.json({ success: true, entries: result.rows });
  } catch (err) {
    console.error("[Permissions] Audit GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
