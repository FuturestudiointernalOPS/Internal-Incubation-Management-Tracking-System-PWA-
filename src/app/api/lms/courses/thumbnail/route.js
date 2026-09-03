import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/lms/courses/thumbnail
 * Server-side course image upload (service-role key — no storage-RLS
 * dependency). Mirrors /api/profile/photo. The returned public URL is stored
 * by the caller in lms_courses.thumbnail_url; the column model is unchanged.
 */
export async function POST(request) {
  try {
    // Reachable from the create page (lms.create) and the editor (lms.edit);
    // the actual save is still capability-checked by each route.
    let capError = await requireAuthorization("lms", "edit");
    if (capError) capError = await requireAuthorization("lms", "create");
    if (capError) return capError;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "lms.fields.thumbnailInvalidType" },
        { status: 400 },
      );
    }

    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);
    const isExtensionValid = ALLOWED_EXTENSIONS.test(file.name || "");
    if (!isMimeValid && !isExtensionValid) {
      return NextResponse.json(
        { success: false, error: "lms.fields.thumbnailInvalidType" },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "lms.fields.thumbnailTooLarge" },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = String(file.name || "thumbnail").replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `course-thumbnails/${Date.now()}-${safeName}`;

    let upload = await supabase.storage
      .from("course-thumbnails")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (upload.error) {
      // Auto-create the public bucket once, then retry (same as profile photos)
      await supabase.storage.createBucket("course-thumbnails", { public: true });
      upload = await supabase.storage
        .from("course-thumbnails")
        .upload(fileName, buffer, { contentType: file.type, upsert: true });
      if (upload.error) throw upload.error;
    }

    const publicUrl = supabase.storage
      .from("course-thumbnails")
      .getPublicUrl(fileName).data.publicUrl;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error("Course thumbnail upload error:", error.message);
    return NextResponse.json(
      { success: false, error: "lms.fields.thumbnailUploadFailed" },
      { status: 500 },
    );
  }
}
