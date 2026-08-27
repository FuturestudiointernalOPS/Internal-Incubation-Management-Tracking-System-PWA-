import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { completeLesson } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/lessons/[lessonId]/complete
 * Mark a lesson complete (idempotent). The lesson → section → course chain is
 * derived server-side; the learner must have a valid enrollment for the
 * course that owns the lesson. Persists to lms_lesson_progress.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;
    const result = await completeLesson(id, session.cid);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
