import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { findCourseMatch } from "@/models/lms/courseMatch";
import { lmsErrorResponse } from "@/models/lms/errors";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/course-match?name=launchlab
 *
 * The website names the program it is selling and ImpactOS answers with the
 * Execution that sells the best-matching course: the public address to send
 * buyers to, plus the price the platform will charge. Nothing else about the
 * course is exposed (no internal id, no learner data).
 *
 * `match: null` means no course corresponded — the website then keeps its own
 * fallback rather than being sent somewhere that grants nothing.
 */
export async function GET(req) {
  try {
    const limited = enforceRateLimit(req, `course-match:${getClientIp(req)}`, {
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (limited) return limited;

    await initDb();
    const { searchParams } = new URL(req.url);
    const name = String(searchParams.get("name") || "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, error: "lms.errors.invalidPayload" },
        { status: 400 },
      );
    }

    const result = await findCourseMatch(name);
    return NextResponse.json({ success: true, match: result.match, checkout: result.checkout });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
