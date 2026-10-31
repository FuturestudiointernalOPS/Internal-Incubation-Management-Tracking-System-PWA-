import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization, requireAnyAuthorization } from "@/models/authorization/index";
import { getSession } from "@/server/auth/session";
import { listCourses, createCourse } from "@/models/lms/courses";
import { lmsErrorResponse } from "@/models/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/courses?search=&status=
 * List courses (authoring view). Every authoring right opens it: a delegated
 * creator or editor must see the list the workspace is built around.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAnyAuthorization([
      { module: "lms", capability: "view" },
      { module: "lms", capability: "create" },
      { module: "lms", capability: "edit" },
    ]);
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const courses = await listCourses({
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
    });
    return NextResponse.json({ success: true, courses });
  } catch (error) {
    return lmsErrorResponse(error);
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
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
