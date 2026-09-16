import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  updateSessionResource,
  deleteSessionResource,
} from "@/lib/lms/sessionResources";

export const dynamic = "force-dynamic";

/**
 * SESSION RESOURCE — Phase 8
 *
 * PUT    /api/lms/session-resources/[id]
 *        Body: { title?, description?, url?, kind?, is_recommended?,
 *                recommendation_note?, position? }
 *        Updates one resource / its recommendation. Requires lms.assign.
 *
 * DELETE /api/lms/session-resources/[id]
 *        Removes the resource. Requires lms.assign.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const resource = await updateSessionResource(id, {
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
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

export async function DELETE(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const { id } = await params;
    const result = await deleteSessionResource(id);
    return NextResponse.json(result);
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
