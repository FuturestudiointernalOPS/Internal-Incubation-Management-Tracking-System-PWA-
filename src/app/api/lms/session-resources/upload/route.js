import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  uploadSessionResourceFile,
  removeSessionResourceFile,
  isManagedStoragePath,
} from "@/lib/lms/sessionResourceFiles";

export const dynamic = "force-dynamic";

/**
 * SESSION RESOURCE FILE UPLOAD — Phase 8.1
 *
 * POST /api/lms/session-resources/upload  (multipart/form-data)
 *      Fields: file (required), kind ('document' | 'video'), program_id?,
 *              session_id?
 *      Returns { url, storage_path, file_name, file_size, mime_type, kind }.
 *
 * Two-step by design: the file is uploaded FIRST, then the caller saves the
 * resource with the returned metadata (POST/PUT /api/lms/session-resources).
 * That keeps the resource row and the storage object in sync, and lets the PM
 * attach the same file metadata as a plain external link.
 *
 * Requires lms.assign. Validation (type + size per kind) happens BEFORE storage,
 * so a rejected file never becomes an orphan object.
 */
export async function POST(request) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const formData = await request.formData();
    const file = formData.get("file");

    const uploaded = await uploadSessionResourceFile({
      file,
      kind: formData.get("kind"),
      programId: formData.get("program_id"),
      sessionId: formData.get("session_id"),
    });

    return NextResponse.json({ success: true, ...uploaded });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * DELETE /api/lms/session-resources/upload?path=<storage_path>
 *      Removes an uploaded object that was never attached to a resource
 *      (upload cancelled / file replaced in the form). Requires lms.assign.
 *      The path is treated as an opaque key inside the session-resource bucket —
 *      no bucket traversal is possible from the caller's side.
 */
export async function DELETE(request) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    if (!path || !isManagedStoragePath(path)) {
      return NextResponse.json(
        { success: false, error: "lms.errors.resourceFileRequired" },
        { status: 400 },
      );
    }

    const removed = await removeSessionResourceFile(path);
    return NextResponse.json({ success: true, removed });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
