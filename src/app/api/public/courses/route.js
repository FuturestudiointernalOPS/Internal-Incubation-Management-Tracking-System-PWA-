import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { listPublicCourses } from "@/lib/lms/public";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/courses
 * Public course catalogue — the website's discovery surface.
 * Returns ONLY marketing-safe fields (no internal ids, no YouTube ids, no
 * learner data). Draft and archived courses never appear here.
 */
export async function GET() {
  try {
    await initDb();
    const courses = await listPublicCourses();
    return NextResponse.json({ success: true, courses });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
