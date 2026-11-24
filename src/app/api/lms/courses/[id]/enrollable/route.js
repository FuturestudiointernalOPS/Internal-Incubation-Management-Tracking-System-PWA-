import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { searchEnrollable } from "@/services/lms/learning";
import { lmsErrorResponse } from "@/models/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/courses/[id]/enrollable?q=
 * Autocomplete for the enroll box: people matching `q` who are not yet
 * enrolled. Requires lms.edit.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const q = new URL(req.url).searchParams.get("q") || "";
    const people = await searchEnrollable(id, q);
    return NextResponse.json({ success: true, people });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
