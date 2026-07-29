import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateForm } from "@/lib/platform/ai/generate";

/**
 * POST /api/platform/ai/generate-form
 * Body: { text: "document content..." }
 * Returns: { success: true, form: { title, description, sections } }
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Document text is required" }, { status: 400 });
    }

    const form = await generateForm(text);
    if (!form) {
      return NextResponse.json({ success: false, error: "AI generation failed. Try again or provide more detailed content." }, { status: 500 });
    }

    return NextResponse.json({ success: true, form });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
