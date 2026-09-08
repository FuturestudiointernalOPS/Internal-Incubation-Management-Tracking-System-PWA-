import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { listCourses, createCourse } from "@/lib/lms/courses";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/courses?search=&status=
 * List courses (authoring view). Requires lms.view.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const courses = await listCourses({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
    });
    return NextResponse.json({ success: true, courses });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * POST /api/lms/courses
 * Create a draft course. Requires lms.create.
 * Never auto-publishes — new courses always start as DRAFT.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "create");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const course = await createCourse({ ...body, createdBy: session?.cid });
    return NextResponse.json({ success: true, course });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
