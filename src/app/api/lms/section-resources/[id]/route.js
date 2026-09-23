import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  updateSectionResource,
  deleteSectionResource,
} from "@/lib/lms/sectionResources";

export const dynamic = "force-dynamic";

/**
 * SECTION RESOURCE
 *
 * PUT    /api/lms/section-resources/[id]
 *        Body: { title?, description?, url?, kind?, source?, storage_path?,
 *                file_name?, file_size?, mime_type?, is_recommended?,
 *                recommendation_note?, position? }
 *        Updates one resource / its recommendation. Requires lms.edit.
 *
 * DELETE /api/lms/section-resources/[id]
 *        Removes the resource (and its uploaded object, best-effort).
 *        Requires lms.edit.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const resource = await updateSectionResource(id, {
      title: body.title,
      description: body.description,
      url: body.url,
      kind: body.kind,
      source: body.source,
      storage_path: body.storage_path,
      file_name: body.file_name,
      file_size: body.file_size,
      mime_type: body.mime_type,
      is_recommended: body.is_recommended,
      recommendation_note: body.recommendation_note,
      position: body.position,
    });
    return NextResponse.json({ success: true, resource });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

export async function DELETE(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const result = await deleteSectionResource(id);
    return NextResponse.json(result);
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
