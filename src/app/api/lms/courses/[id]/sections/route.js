import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { createSection } from "@/lib/lms/sections";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/courses/[id]/sections — create a section. Requires lms.edit.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const section = await createSection({ courseId: id, ...body });
    return NextResponse.json({ success: true, section });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
