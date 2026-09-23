import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  uploadSectionResourceFile,
  removeSectionResourceFile,
  isManagedStoragePath,
} from "@/lib/lms/sectionResourceFiles";

export const dynamic = "force-dynamic";

/**
 * SECTION RESOURCE FILE UPLOAD
 *
 * POST /api/lms/section-resources/upload  (multipart/form-data)
 *      Fields: file (required), kind ('document' | 'video'), course_id?,
 *              section_id?
 *      Returns { url, storage_path, file_name, file_size, mime_type, kind }.
 *
 * Two-step by design: the file is uploaded FIRST, then the caller saves the
 * resource with the returned metadata (POST/PUT /api/lms/section-resources).
 * That keeps the resource row and the storage object in sync, and lets the same
 * metadata be edited like any other field.
 *
 * Requires lms.edit. Validation (type + size per kind) happens BEFORE storage,
 * so a rejected file never becomes an orphan object.
 */
export async function POST(request) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const formData = await request.formData();
    const file = formData.get("file");

    const uploaded = await uploadSectionResourceFile({
      file,
      kind: formData.get("kind"),
      courseId: formData.get("course_id"),
      sectionId: formData.get("section_id"),
    });

    return NextResponse.json({ success: true, ...uploaded });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

/**
 * DELETE /api/lms/section-resources/upload?path=<storage_path>
 *      Removes an uploaded object that was never attached to a resource
 *      (upload cancelled / file replaced in the form). Requires lms.edit.
 *      The path is treated as an opaque key inside the section-resource bucket —
 *      no bucket traversal is possible from the caller's side.
 */
export async function DELETE(request) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    if (!path || !isManagedStoragePath(path)) {
      return NextResponse.json(
        { success: false, error: "lms.errors.resourceFileRequired" },
        { status: 400 },
      );
    }

    const removed = await removeSectionResourceFile(path);
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
