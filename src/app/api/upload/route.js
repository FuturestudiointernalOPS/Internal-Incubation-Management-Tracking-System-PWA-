import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

// ── Server-side upload validation (mirrors src/lib/storage.js) ──
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];
const ALLOWED_EXTENSIONS = /\.(pdf|png|jpg|jpeg|doc|docx|xls|xlsx|ppt|pptx)$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request) {
  try {
    const authError = await requireAuth([
      "super_admin", "staff", "program_manager", "team", "participant",
    ]);
    if (authError) return authError;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    // Validate file type (MIME first, fall back to extension)
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);
    const isExtensionValid = ALLOWED_EXTENSIONS.test(file.name || "");
    if (!isMimeValid && !isExtensionValid) {
      return NextResponse.json(
        {
          success: false,
          error: `File type "${file.type || "unknown"}" is not supported. Supported file types: PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, PPT, PPTX.`,
        },
        { status: 400 },
      );
    }

    // Validate file size
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
    const fileName = `team-uploads/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const { data, error } = await supabase.storage
      .from("submissions")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      console.error("Supabase upload error:", error.message);

      // Try creating the bucket once, then retry
      try {
        await supabase.storage.createBucket("submissions", { public: true });
        const retry = await supabase.storage
          .from("submissions")
          .upload(fileName, buffer, {
            contentType: file.type,
            upsert: true,
          });
        if (retry.error) throw retry.error;

        const publicUrl = supabase.storage
          .from("submissions")
          .getPublicUrl(fileName).data.publicUrl;

        return NextResponse.json({ success: true, url: publicUrl });
      } catch (createErr) {
        return NextResponse.json(
          {
            success: false,
            error: `Storage bucket is not configured. Please contact your administrator.`,
          },
          { status: 500 },
        );
      }
    }

    const publicUrl = supabase.storage
      .from("submissions")
      .getPublicUrl(fileName).data.publicUrl;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
