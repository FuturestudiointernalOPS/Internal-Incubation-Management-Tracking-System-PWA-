import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { uploadReminderAttachment } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/ventures/[id]/reminders/upload — multipart form-data
 *   file : the one file to attach to a manual reminder (documents or images, ≤5MB)
 *
 * Uploading and SENDING are two steps on purpose: the file is stored first and
 * the send then quotes the path it was given, so a reminder can be written,
 * reviewed and sent without the file travelling twice. It also means the send
 * stays a JSON request with nothing large inside it.
 *
 * Gated like every other reminder WRITE — `ventures.edit`, scoped to this
 * Venture — so whoever may chase the work is exactly who may attach to the chase.
 *
 * Returns { success, path, name, size }. The path is stored on the reminder log
 * row at send time; the file lives in a PRIVATE bucket and is never
 * world-readable — it reaches the recipient as an email attachment.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const result = await uploadReminderAttachment(file, { ventureId: id });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, path: result.path, name: result.name, size: result.size });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
