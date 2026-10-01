import { NextResponse } from "next/server";
import { authorizePersonalizeTemplate, personalizeTemplate } from "@/services/platform/emailPersonalize";

/**
 * POST /api/platform/ai/personalize-template
 *
 * Body: {
 *   template_key: "acknowledgement" | "approval" | "activation" | "rejection",
 *   form_name?: string,
 *   organization?: string,
 *   language?: string,
 *   existing_subject?: string,
 *   existing_body?: string,
 * }
 *
 * See services/platform/emailPersonalize.js for the personalization decision
 * (structure-preservation contract, tier-1/tier-2 fallback, language lock).
 */

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const authError = await authorizePersonalizeTemplate();
    if (authError) return authError;

    const body = await req.json().catch(() => ({}));
    const result = await personalizeTemplate(body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json({ success: true, subject: result.subject, body: result.body });
  } catch (error) {
    console.error("[AI Personalize] Error:", error.message);
    return NextResponse.json(
      { success: false, error: `Personalization failed: ${error.message}` },
      { status: 500 }
    );
  }
}
