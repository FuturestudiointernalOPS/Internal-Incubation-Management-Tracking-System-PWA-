import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  listSessionResources,
  createSessionResource,
} from "@/lib/lms/sessionResources";

export const dynamic = "force-dynamic";

/**
 * SESSION RESOURCES & RECOMMENDATIONS — Phase 8
 *
 * GET  /api/lms/session-resources?program_id=X[&session_id=S][&week_number=N]
 *      Material attached to a Program session (videos + documents), with the
 *      recommended flag. Requires lms.view.
 *
 * POST /api/lms/session-resources
 *      Body: { program_id, session_id?, week_number?, kind, title, url,
 *              description?, is_recommended?, recommendation_note? }
 *      Attaches one resource to a session. Requires lms.assign (Program Course
 *      Assignment — the capability the Program Manager profile already holds).
 *
 * Learners never call this endpoint: the participant surface receives the same
 * rows inside the program detail payload (read-only).
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    if (!programId) {
      return NextResponse.json(
        { success: false, error: "lms.errors.programIdRequired" },
        { status: 400 },
      );
    }

    const resources = await listSessionResources({
      programId,
      sessionId: searchParams.get("session_id") || undefined,
      weekNumber: searchParams.get("week_number") || undefined,
      onlyRecommended: searchParams.get("onlyRecommended") === "1",
    });
    return NextResponse.json({ success: true, resources });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const resource = await createSessionResource({
      programId: body.program_id,
      sessionId: body.session_id,
      weekNumber: body.week_number,
      kind: body.kind,
      title: body.title,
      description: body.description,
      url: body.url,
      isRecommended: body.is_recommended,
      recommendationNote: body.recommendation_note,
      createdBy: session?.cid || null,
    });
    return NextResponse.json({ success: true, resource });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
