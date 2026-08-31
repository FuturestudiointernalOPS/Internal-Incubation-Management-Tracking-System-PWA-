import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getPublicCourseBySlug,
  getPublicCourseStructure,
  getPublicCourseIdBySlug,
} from "@/lib/lms/public";
import { getEnrollment } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * PUBLIC COURSE DETAIL + FREE ENROLLMENT (Phase 7)
 *
 * GET  /api/public/courses/[slug]
 *      Marketing-safe course details + structure (section/lesson titles only —
 *      never YouTube ids, never assessment answers). No authentication needed.
 *
 * POST /api/public/courses/[slug]
 *      Free-course enrollment. Requires an authenticated ImpactOS user.
 *      - Resolves the slug SERVER-side (public pages never see internal ids).
 *      - Published + public visibility only — drafts/archived are 404.
 *      - FREE courses enroll immediately (source 'self'), idempotently.
 *      - PAID courses are rejected: verified payment is a hard requirement for
 *        paid access (server-side verification boundary). No live payment
 *        provider is integrated yet, so paid self-enrollment is intentionally
 *        unavailable until checkout ships — the frontend can NEVER grant access.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { slug } = await params;
    const { course, id } = await getPublicCourseBySlug(slug);
    const structure = await getPublicCourseStructure(String(id));

    // Optional auth: when the visitor is signed in, tell them whether they are
    // already enrolled (the internal course id is ONLY returned in that case,
    // so the client can route into the LMS).
    const session = await getSession();
    let enrollment = { enrolled: false };
    if (session && session.cid) {
      const existing = await getEnrollment(id, session.cid);
      if (existing && existing.status !== "suspended") {
        enrollment = { enrolled: true, courseId: String(existing.course_id) };
      }
    }

    return NextResponse.json({ success: true, course, structure, enrollment });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }

    const { slug } = await params;
    const row = await getPublicCourseIdBySlug(slug);
    if (!row) {
      return NextResponse.json(
        { success: false, error: "lms.errors.courseNotFound" },
        { status: 404 },
      );
    }

    // Paid courses require a VERIFIED payment — never a frontend claim. No
    // payment provider is integrated yet; this boundary stays closed (402).
    if (row.is_free === false) {
      return NextResponse.json(
        { success: false, error: "lms.errors.paidCheckoutUnavailable" },
        { status: 402 },
      );
    }

    const existing = await getEnrollment(row.id, session.cid);
    if (existing && existing.status === "suspended") {
      return NextResponse.json(
        { success: false, error: "lms.errors.notEnrolled" },
        { status: 403 },
      );
    }

    await initDb();
    await db.execute({
      sql: `INSERT INTO lms_enrollments (course_id, user_cid, source)
            VALUES (?, ?, 'self')
            ON CONFLICT (course_id, user_cid) DO NOTHING`,
      args: [row.id, session.cid],
    });

    const enrollment = await getEnrollment(row.id, session.cid);
    return NextResponse.json({
      success: true,
      // The course id is returned only here (after enrollment) so the client
      // can route into the LMS — it is never exposed on the marketing surface.
      courseId: String(enrollment.course_id),
      alreadyEnrolled: existing != null,
    });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
