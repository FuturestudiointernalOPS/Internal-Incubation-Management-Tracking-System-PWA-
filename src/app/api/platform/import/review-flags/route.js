import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * IMPORT REVIEW FLAGS API
 *
 * GET /api/platform/import/review-flags?status=pending|resolved|all
 * GET /api/platform/import/review-flags?run_id=X
 * GET /api/platform/import/review-flags?form_id=X
 *     — List identity review flags from historical imports
 *
 * PUT /api/platform/import/review-flags
 *     Body: { id, status: "resolved" | "pending" }
 *     — Resolve or reopen a flagged identity
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";
    const runId = searchParams.get("run_id");
    const formId = searchParams.get("form_id");

    let sql = "SELECT * FROM platform_import_review_flags WHERE 1=1";
    const args = [];

    if (status !== "all") {
      sql += " AND status = ?";
      args.push(status);
    }
    if (runId) {
      sql += " AND run_id = ?";
      args.push(parseInt(runId));
    }
    if (formId) {
      sql += " AND form_id = ?";
      args.push(parseInt(formId));
    }
    sql += " ORDER BY id DESC LIMIT 500";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, flags: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { id, status } = await req.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const valid = ["pending", "resolved"];
    if (status && !valid.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }

    const result = await db.execute({
      sql: "UPDATE platform_import_review_flags SET status = ? WHERE id = ? RETURNING *",
      args: [status || "resolved", parseInt(id)],
    });

    return NextResponse.json({ success: true, flag: result.rows[0] || null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
