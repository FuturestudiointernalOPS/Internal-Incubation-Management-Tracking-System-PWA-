import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { executeImport } from "@/services/platform/import";

/**
 * POST /api/platform/import/execute
 * Accepts form_id + run_id + mapping + csv_rows.
 *
 * Thin controller: parses the request, gates on `super_admin` and delegates to
 * `@/services/platform/import`, which owns the PHASE 1 SAFETY MODEL:
 *  - Submissions created with status 'submitted' (visible to review + AI eval)
 *  - Contacts created as role 'participant', status 'pending' (never approved)
 *  - No automation, no emails, no credentials, no group assignment
 *  - Lookup-first contact matching (email, phone, name); name-only matches
 *    are flagged needs_review and never silently merged
 *  - Duplicate protection: skips rows where submitter already has a submission
 *    in this run; records import batch with file hash for idempotency detection
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const payload = await req.json();
    const { status, body } = await executeImport(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
