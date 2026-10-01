import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { initDb } from "@/lib/db";
import { generateFormAndFramework } from "@/services/platform/aiGenerate";

/**
 * POST /api/platform/ai/generate-all
 * Body: { text, collection_id? }
 *
 * Analyzes document and generates BOTH form structure and evaluation
 * framework. Creates the form in the database atomically.
 * Returns the full created form object so the UI can open it in the builder.
 *
 * See services/platform/aiGenerate.js for the generation decision.
 */
export async function POST(req) {
  try {
    await initDb();
    // Generating a whole form (sections, fields and framework) is form
    // AUTHORING, so it is the Forms create capability rather than a role name.
    // Bear in mind Staff Default holds forms.create: untick Forms -> Create
    // there if the AI generators should stay a smaller group.
    const capError = await requireAuthorization("forms", "create");
    if (capError) return capError;

    const { text, collection_id } = await req.json();
    const result = await generateFormAndFramework({ text, collection_id });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json({
      success: true,
      form: result.form,
      form_id: result.form_id,
      title: result.title,
      sections: result.sections,
      fields: result.fields,
      evaluation_dimensions: result.evaluation_dimensions,
      has_evaluation: result.has_evaluation,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: `Generation failed: ${error.message}` }, { status: 500 });
  }
}
