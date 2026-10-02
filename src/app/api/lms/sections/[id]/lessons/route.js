import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { createLesson } from "@/models/lms/lessons";
import { lmsErrorResponse } from "@/models/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/sections/[id]/lessons — create a lesson. Requires lms.edit.
 * `youtubeVideoId` accepts a URL or a bare ID and is normalized to the ID.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const lesson = await createLesson({ sectionId: id, ...body });
    return NextResponse.json({ success: true, lesson });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
