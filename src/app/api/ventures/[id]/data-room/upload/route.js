import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { uploadDataRoomDocument } from "@/lib/storage";
import { isDataRoomCategory } from "@/lib/dataRoom";
import { resolveDataRoomViewer } from "@/services/ventures/dataRoom";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/data-room/upload — multipart form-data
 *   file     : the Data Room document (PDF / Office / PNG / JPG)
 *   category : the Data Room category, used to namespace the storage path
 *
 * The file goes to the PRIVATE evidence bucket under
 * `data-room/<venture>/<category>/…`. The database stores the PATH; a readable
 * file is a short-lived signed URL minted by the catalogue read, so no public
 * URL ever exists.
 *
 * Only someone who may MANAGE this Venture's Data Room may write into its
 * storage prefix. A refusal is the same 404/403 the catalogue would give, so
 * the upload route cannot be used to discover a Venture.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
    }

    const viewer = await resolveDataRoomViewer({ ventureId: id, session });
    if (!viewer.allowed) {
      return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    }
    if (!viewer.canManage) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const category = String(formData.get("category") || "").trim();

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "dataRoom.errors.fileRequired" }, { status: 400 });
    }
    // Refuse BEFORE writing bytes: an invalid category used to be rejected only
    // by the second step, leaving an orphan object in the private bucket.
    if (!isDataRoomCategory(category)) {
      return NextResponse.json({ success: false, error: "dataRoom.errors.categoryInvalid" }, { status: 400 });
    }

    const result = await uploadDataRoomDocument(file, { ventureId: id, category });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      path: result.path,
      name: result.name,
      size: result.size,
      type: result.type,
      max_file_mb: result.max_file_mb,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
