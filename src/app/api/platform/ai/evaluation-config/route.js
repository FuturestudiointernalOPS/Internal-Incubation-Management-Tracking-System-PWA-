import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  getEvaluationFramework,
  removeEvaluationFramework,
  saveEvaluationFramework,
} from "@/services/platform/evaluationConfig";

/**
 * PUT /api/platform/ai/evaluation-config
 * Body: { form_id, framework, source_document? }
 * Saves or updates an evaluation framework for a form.
 *
 * GET /api/platform/ai/evaluation-config?form_id=X
 * Returns the saved framework for a form.
 *
 * DELETE /api/platform/ai/evaluation-config?form_id=X
 * Removes the evaluation framework (disables AI evaluation).
 *
 * Thin controller: gates the Forms capabilities and delegates to
 * `@/services/platform/evaluationConfig` (see docs/LAYER_SPLIT.md).
 */

export async function GET(req) {
  try {
    await initDb();
    // Reading a form's evaluation framework is a read of that form. It was the
    // only handler in this file without a gate — PUT and DELETE below both
    // require forms.edit — so an anonymous caller could enumerate stored
    // scoring rubrics per form id. Follow the same Forms capability family.
    const capError = await requireAuthorization("forms", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const { status, body } = await getEvaluationFramework({ formId: searchParams.get("form_id") });
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    // Storing the evaluation framework on a form is an edit of that form, so
    // it follows the Forms capability instead of a hardcoded role list (which
    // named the retired `admin` role and could not be granted to anyone).
    const capError = await requireAuthorization("forms", "edit");
    if (capError) return capError;

    const payload = await req.json();
    const { status, body } = await saveEvaluationFramework(payload);
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    // Same capability as the PUT: removing a form's evaluation framework is an
    // edit of that form.
    const capError = await requireAuthorization("forms", "edit");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const { status, body } = await removeEvaluationFramework({ formId: searchParams.get("form_id") });
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
