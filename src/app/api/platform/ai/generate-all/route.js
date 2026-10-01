import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { initDb } from "@/lib/db";
import { generateFormWithFramework } from "@/services/platform/formGeneration";

/**
 * POST /api/platform/ai/generate-all
 * Body: { text, collection_id? }
 *
 * Analyzes document and generates BOTH form structure and evaluation
 * framework. Creates the form in the database atomically.
 * Returns the full created form object so the UI can open it in the builder.
 *
 * Thin controller: gates on `forms.create` and delegates to
 * `@/services/platform/formGeneration` (see docs/LAYER_SPLIT.md).
 */
export async function POST(req) {
  try {
    await initDb();
    console.log("[AI GenerateAll] Request received");
    // Generating a whole form (sections, fields and framework) is form
    // AUTHORING, so it is the Forms create capability rather than a role name.
    // Bear in mind Staff Default holds forms.create: untick Forms -> Create
    // there if the AI generators should stay a smaller group.
    const capError = await requireAuthorization("forms", "create");
    if (capError) return capError;

    const { text, collection_id } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Document text is required" }, { status: 400 });
    }

    const { status, body } = await generateFormWithFramework({ text, collection_id });
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[AI GenerateAll] Error:", error.message);
    return NextResponse.json({ success: false, error: `Generation failed: ${error.message}` }, { status: 500 });
  }
}
