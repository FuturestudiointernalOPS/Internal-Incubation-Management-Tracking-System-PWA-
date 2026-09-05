import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  deleteEvaluationFrameworkByFormId,
  getEvaluationFrameworkByFormId,
  upsertFormEvaluationFramework,
} from "@/models/platformAi";

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
 */

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const formId = searchParams.get("form_id");
    if (!formId) return NextResponse.json({ success: false, error: "form_id required" }, { status: 400 });

    const result = await getEvaluationFrameworkByFormId(formId);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, framework: null });
    }

    return NextResponse.json({ success: true, framework: result.rows[0].framework, source_document: result.rows[0].source_document });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { form_id, framework, source_document } = await req.json();
    if (!form_id || !framework) {
      return NextResponse.json({ success: false, error: "form_id and framework required" }, { status: 400 });
    }

    await upsertFormEvaluationFramework(form_id, framework, source_document);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const formId = searchParams.get("form_id");
    if (!formId) return NextResponse.json({ success: false, error: "form_id required" }, { status: 400 });

    await deleteEvaluationFrameworkByFormId(formId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
