import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { uploadDeliverableEvidence } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/reporting/evidence/upload — multipart form-data
 *   file : the evidence (PDF / Office / PNG / JPG)
 *   slot : namespaces the storage path (e.g. "interview", "pilot", "mvp")
 *
 * Evidence for the event log and for interviews is a DOCUMENT OR A LINK. This
 * endpoint is the document half: it reuses the same private evidence bucket as
 * deliverables and verification, so a founder's upload is never world-readable
 * and the reviewer reads it through a short-lived signed URL.
 *
 * Returns { success, path, name }. The caller stores `path` — which
 * `evidenceStoragePath()` recognises as a file rather than a link.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;

    const formData = await req.formData();
    const file = formData.get("file");
    const slot = formData.get("slot");

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const result = await uploadDeliverableEvidence(file, {
      ventureId: id,
      deliverableId: `reporting-${String(slot || "evidence")}`,
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
