import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  listSectionResources,
  createSectionResource,
} from "@/lib/lms/sectionResources";

export const dynamic = "force-dynamic";

/**
 * SECTION RESOURCES & RECOMMENDATIONS
 *
 * GET  /api/lms/section-resources?section_id=S
 *      Material attached to one course section (videos + documents), with the
 *      recommended flag. Requires lms.view.
 *
 * POST /api/lms/section-resources
 *      Body: { section_id, kind, title, url, description?, source?,
 *              storage_path?, file_name?, file_size?, mime_type?,
 *              is_recommended?, recommendation_note? }
 *      Attaches one resource to a section. Requires lms.edit — the canonical
 *      course-authoring gate.
 *
 * Learners never call this endpoint: the learner course payload receives the
 * same rows, signed, through the course read (read-only).
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("section_id");
    if (!sectionId) {
      return NextResponse.json(
        { success: false, error: "lms.errors.sectionNotFound" },
        { status: 400 },
      );
    }

    const resources = await listSectionResources({ sectionId });
    return NextResponse.json({ success: true, resources });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const resource = await createSectionResource({
      sectionId: body.section_id,
      kind: body.kind,
      title: body.title,
      description: body.description,
      url: body.url,
      source: body.source,
      storagePath: body.storage_path,
      fileName: body.file_name,
      fileSize: body.file_size,
      mimeType: body.mime_type,
      isRecommended: body.is_recommended,
      recommendationNote: body.recommendation_note,
      createdBy: session?.cid || null,
    });
    return NextResponse.json({ success: true, resource });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
