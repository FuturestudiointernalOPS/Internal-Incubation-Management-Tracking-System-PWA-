import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { uploadDeliverableEvidence } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/deliverables/upload — multipart form-data
 *   file            : the evidence file (any type, max 5MB)
 *   deliverable_id  : optional, used for the storage path
 *
 * The Venture side (founders / team) and assigned staff both attach evidence,
 * so the gate is VENTURE ACCESS — not the staff capability gate used by the
 * shared /api/upload route (which would refuse founders without a program
 * enrollment).
 *
 * Returns { success, path, name } — the caller records the PATH on the
 * deliverable through PATCH …/{deliverables} { action: "submit" }. Reading it
 * back yields a short-lived signed URL (see lib/ventureEvidence.js), so the
 * evidence is never world-readable.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file");
    const deliverableId = formData.get("deliverable_id");

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const result = await uploadDeliverableEvidence(file, { ventureId: id, deliverableId });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, path: result.path, name: result.name });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
