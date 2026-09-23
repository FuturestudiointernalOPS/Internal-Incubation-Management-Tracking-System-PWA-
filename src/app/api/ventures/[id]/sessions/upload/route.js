import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { uploadSessionMaterial } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/sessions/upload — multipart form-data
 *   file         : the material document (max 5MB)
 *   milestone_id : optional, groups the file under the milestone it belongs to
 *
 * A session may carry documents the participants need — a deck to review, a
 * brief to read before the call. BOTH sides book sessions (the Venture's own
 * people and Future Studio staff), so the gate is VENTURE ACCESS, exactly like
 * deliverable evidence, and not the staff capability gate.
 *
 * Returns { success, path, name, size }. The caller passes those paths in the
 * booking payload (`materials: [{ path, name, size }]`). Reading the session
 * back mints short-lived signed URLs, so a material is never world-readable.
 */
export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file");
    const milestoneId = formData.get("milestone_id");

    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const result = await uploadSessionMaterial(file, { ventureId: id, milestoneId });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      path: result.path,
      name: result.name,
      size: result.size,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
