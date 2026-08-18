import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXTENSIONS = /\.(png|jpg|jpeg|webp)$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * PROFILE PHOTO UPLOAD API
 *
 * POST /api/profile/photo
 *   - Session-based (any authenticated role)
 *   - Accepts multipart form data: { file }
 *   - Uploads to the "profile-photos" Supabase bucket and returns the public URL
 *
 * The returned URL is then persisted to contacts.image via PUT /api/profile.
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);
    const isExtensionValid = ALLOWED_EXTENSIONS.test(file.name || "");
    if (!isMimeValid && !isExtensionValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported image type. Please upload a PNG, JPG, or WEBP image.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the maximum of 5MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
        },
        { status: 400 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const fileName = `profile-photos/${session.cid}-${Date.now()}.${ext}`;

    let upload = await supabase.storage
      .from("profile-photos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (upload.error) {
      // Try creating the bucket once, then retry
      await supabase.storage.createBucket("profile-photos", { public: true });
      upload = await supabase.storage
        .from("profile-photos")
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true,
        });
      if (upload.error) throw upload.error;
    }

    const publicUrl = supabase.storage
      .from("profile-photos")
      .getPublicUrl(fileName).data.publicUrl;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error("Profile photo upload error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
