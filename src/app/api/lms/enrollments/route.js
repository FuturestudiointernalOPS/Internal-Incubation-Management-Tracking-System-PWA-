import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { enrollLearner } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/enrollments
 * Admin enrollment (source: admin). Requires lms.edit.
 * Accepts a user by cid OR email. Idempotent (ON CONFLICT DO NOTHING).
 * Minimal enabler so Phase 3 learners can exist; a full enrollment
 * management experience belongs to a later phase.
 */
export async function POST(req) {
  try {
    await initDb();
    // Admin enrollment is course management (lms.edit).
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const body = await req.json();
    if (!body.courseId || (!body.userCid && !body.userEmail)) {
      return NextResponse.json(
        { success: false, error: "courseId and a user (userCid or userEmail) are required." },
        { status: 400 },
      );
    }
    // The enrollment source is server-controlled: a client must not be able to
    // label its own enrollment as a purchase.
    const result = await enrollLearner({ ...body, source: "admin" });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
