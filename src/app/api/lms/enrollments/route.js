import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { enrollLearner } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/enrollments
 * Admin enrollment (source: admin). Requires lms.enroll.
 * Accepts a user by cid OR email. Idempotent (ON CONFLICT DO NOTHING).
 * Minimal enabler so Phase 3 learners can exist; a full enrollment
 * management experience belongs to a later phase.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "enroll");
    if (capError) return capError;

    const body = await req.json();
    const result = await enrollLearner(body);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
