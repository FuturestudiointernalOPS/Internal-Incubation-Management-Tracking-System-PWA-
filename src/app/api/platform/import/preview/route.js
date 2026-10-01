import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { buildImportPreview } from "@/services/platform/import";

/**
 * POST /api/platform/import/preview
 * Accepts csv_text + form_id. Parses CSV, fetches form fields, fuzzy-matches
 * columns to field labels (case-insensitive, word overlap scoring).
 * Returns: form_fields, csv_columns, suggested_mapping, unmatched, preview_rows (first 5), total_rows.
 *
 * Thin controller: parses the request, gates on `super_admin` and delegates to
 * `@/services/platform/import` (see docs/LAYER_SPLIT.md).
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const payload = await req.json();
    const { status, body } = await buildImportPreview(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
