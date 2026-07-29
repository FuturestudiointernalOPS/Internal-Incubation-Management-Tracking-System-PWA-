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
    console.log("[AI GenerateForm] Request received");
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Document text is required" }, { status: 400 });
    }

    console.log(`[AI GenerateForm] Generating form from ${text.length} chars`);
    const form = await generateForm(text);
    if (!form) {
      console.error("[AI GenerateForm] Generation returned null");
      return NextResponse.json({ success: false, error: "AI generation failed. The model may have returned an invalid response. Try with more detailed content." }, { status: 500 });
    }

    console.log(`[AI GenerateForm] Success — ${form.sections?.length || 0} sections, title: "${form.title}"`);
    return NextResponse.json({ success: true, form });
  } catch (error) {
    console.error("[AI GenerateForm] Error:", error.message);
    return NextResponse.json({ success: false, error: `Generation failed: ${error.message}` }, { status: 500 });
  }
}
