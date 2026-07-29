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
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Rubric text is required" }, { status: 400 });
    }

    const framework = await generateFramework(text);
    if (!framework) {
      return NextResponse.json({ success: false, error: "AI generation failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, framework });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
