import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { uploadDeliverableEvidence } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/verification/upload — multipart form-data
 *   file     : the verification document (PDF / Office / PNG / JPG, max 5MB)
 *   category : optional, namespaces the storage path per verification step
 *
 * Founders (and staff with an assignment) attach the compliance documents, so
 * the gate is VENTURE ACCESS — not the staff capability gate used by the
 * shared /api/upload route, which would refuse founders without a program
 * enrollment and writes to a PUBLIC bucket.
 *
 * Returns { success, path, name } — the caller records the PATH on the
 * document through POST …/{verification} { action: "upload_document" }. Reading
 * it back yields a short-lived signed URL (see lib/ventureEvidence.js), so the
 * document is never world-readable.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file");
    const category = formData.get("category");

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Shares the private evidence bucket: the second argument namespaces the
    // path as `deliverables/<venture>/verification-<category>/…` so a
    // verification document is identifiable in storage.
    const result = await uploadDeliverableEvidence(file, {
      ventureId: id,
      deliverableId: `verification-${String(category || "document")}`,
      allowImages: true,
    });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, path: result.path, name: result.name });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
