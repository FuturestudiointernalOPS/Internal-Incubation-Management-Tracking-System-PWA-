import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { listReviewFlags, setReviewFlagStatus } from "@/services/platform/import";

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
 *
 * Thin controller: gates on `super_admin` and delegates to
 * `@/services/platform/import` (see docs/LAYER_SPLIT.md).
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const { status, body } = await listReviewFlags({
      status: searchParams.get("status") || "pending",
      runId: searchParams.get("run_id"),
      formId: searchParams.get("form_id"),
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const payload = await req.json();
    const { status, body } = await setReviewFlagStatus(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
