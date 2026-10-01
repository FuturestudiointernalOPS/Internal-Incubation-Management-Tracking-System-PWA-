import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { executeImport } from "@/services/platform/import";

/**
 * POST /api/platform/import/execute
 * Accepts form_id + run_id + mapping + csv_rows.
 * See services/platform/import.js for the import's safety model.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { form_id, run_id, mapping, csv_rows, batch_id, file_hash } = await req.json();
    const result = await executeImport({ form_id, run_id, mapping, csv_rows, batch_id, file_hash });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });

    return NextResponse.json({
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      needs_review: result.needs_review,
      review_rows: result.review_rows,
      errors: result.errors,
      total: result.total,
      duplicate_batch: result.duplicate_batch,
      previous_batch: result.previous_batch,
      batch: result.batch,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
