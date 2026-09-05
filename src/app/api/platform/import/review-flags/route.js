import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listImportReviewFlags,
  updateImportReviewFlagStatus,
} from "@/models/platformImport";

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

    const result = await listImportReviewFlags(status, runId, formId);
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

    const result = await updateImportReviewFlagStatus(status, id);

    return NextResponse.json({ success: true, flag: result.rows[0] || null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
