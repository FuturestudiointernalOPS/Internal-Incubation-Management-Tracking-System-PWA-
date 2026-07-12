import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

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
      // If bucket doesn't exist, fall back to a data-URL for now
      console.error("Supabase upload error:", error.message);

      // Try creating the bucket
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
      } catch (_) {
        // Fallback: return data URL
        const b64 = buffer.toString("base64");
        const dataUrl = `data:${file.type};base64,${b64}`;
        return NextResponse.json({ success: true, url: dataUrl, fallback: true });
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
