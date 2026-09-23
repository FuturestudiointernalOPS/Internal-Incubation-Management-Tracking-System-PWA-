import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { listPublicCourses } from "@/lib/lms/public";
import { lmsErrorResponse } from "@/lib/lms/errors";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/courses
 * Public course catalogue — the website's discovery surface.
 * Returns ONLY marketing-safe fields (no internal ids, no YouTube ids, no
 * learner data). Draft and archived courses never appear here.
 */
export async function GET(req) {
  try {
    // Public and unauthenticated: throttle per client IP so the catalogue can
    // not be used as an unbounded, cache-busting read amplifier (RATE-2).
    const limited = enforceRateLimit(req, `public-courses:${getClientIp(req)}`, {
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (limited) return limited;

    await initDb();
    const courses = await listPublicCourses();
    return NextResponse.json({ success: true, courses });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
