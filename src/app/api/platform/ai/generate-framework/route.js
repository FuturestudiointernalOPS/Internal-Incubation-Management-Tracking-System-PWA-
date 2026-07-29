import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateFramework } from "@/lib/platform/ai/framework";

/**
 * POST /api/platform/ai/generate-framework
 * Body: { text: "rubric content..." }
 * Returns: { success: true, framework: { dimensions, rankings, global_prompt } }
 */
export async function POST(req) {
  try {
    console.log("[AI Framework] Request received");
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Document text is required" }, { status: 400 });
    }

    console.log(`[AI Framework] Generating framework from ${text.length} chars of text`);
    const framework = await generateFramework(text);
    if (!framework) {
      console.error("[AI Framework] Generation returned null — likely JSON parse failure or API error");
      return NextResponse.json({ success: false, error: "AI generation failed. The model may have returned an invalid response. Try again with clearer rubric text." }, { status: 500 });
    }

    console.log(`[AI Framework] Success — ${framework.dimensions?.length || 0} dimensions generated`);
    return NextResponse.json({ success: true, framework });
  } catch (error) {
    console.error("[AI Framework] Unhandled error:", error.message);
    console.error("[AI Framework] Stack:", error.stack?.substring(0, 300));
    return NextResponse.json({ success: false, error: `Generation failed: ${error.message}` }, { status: 500 });
  }
}
