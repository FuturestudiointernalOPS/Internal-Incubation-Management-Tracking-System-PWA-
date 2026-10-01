import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { personalizeTemplate } from "@/services/platform/personalize";

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
 * Thin controller: gates on the surface's edit capability and delegates to
 * `@/services/platform/personalize`, which owns the structure-preservation
 * contract (see that module).
 */

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    // This used to gate on a hardcoded role list (super_admin / admin), so no
    // grant, profile or template change could ever satisfy it and the AI button
    // answered 403 for every Program Manager and staff member. Personalizing a
    // template is an edit of that template, so it is now governed by the
    // capability of whichever surface the caller is in: Runs (the message
    // composer and the run-level templates) or Forms (the form-level templates).
    // Both are visible and grantable in the Permission Center, under
    // Communication → Runs / Forms.
    const runsError = await requireAuthorization("runs", "edit");
    if (runsError) {
      const formsError = await requireAuthorization("forms", "edit");
      if (formsError) return runsError;
    }

    const body = await req.json().catch(() => ({}));
    const { status, body: responseBody } = await personalizeTemplate(body);
    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("[AI Personalize] Error:", error.message);
    return NextResponse.json(
      { success: false, error: `Personalization failed: ${error.message}` },
      { status: 500 }
    );
  }
}
