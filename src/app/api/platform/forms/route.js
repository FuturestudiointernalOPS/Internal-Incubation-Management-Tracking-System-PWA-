import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import {
  createForm,
  deleteForm,
  guardInvestorIntake,
  getFormDetail,
  listForms,
  publishFormVersion,
  saveFormBuilder,
  updateFormMetadata,
} from "@/services/platform/forms";

/**
 * PLATFORM FORMS API — CRUD with versioning
 * Fix applied: section deletions now run AFTER field upserts to prevent FK violations.
 *
 * GET    /api/platform/forms                   — List all forms
 * GET    /api/platform/forms?id=X              — Get one form + its fields + sections
 * GET    /api/platform/forms?collection_id=X   — Filter by collection
 * POST   /api/platform/forms                   — Create form
 * PUT    /api/platform/forms                   — Update form
 * POST   /api/platform/forms/publish           — Publish a new version
 * DELETE /api/platform/forms?id=X              — Archive
 *
 * Thin controller: gates auth/capabilities and delegates to
 * `@/services/platform/forms` (see docs/LAYER_SPLIT.md).
 */

export async function GET(req) {
  try {
    await initDb();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const collectionId = searchParams.get("collection_id");
    const status = searchParams.get("status");

    // Single form with fields + sections — allow any authenticated user (participants need this)
    if (id) {
      const { getSession } = await import("@/server/auth/session");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

      const { status: httpStatus, body } = await getFormDetail(id);
      return NextResponse.json(body, { status: httpStatus });
    }

    // Listing forms is the Forms module's read capability. Single-form reads
    // above stay open to any authenticated user (participants fill forms).
    const authError = await requireAuthorization("forms", "view");
    if (authError) return authError;

    const { body } = await listForms({ collectionId, status });
    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();

    // Publishing a version edits an existing form; any other POST creates one.
    const capError = body.action === "publish"
      ? await requireAuthorization("forms", "edit")
      : await requireAuthorization("forms", "create");
    if (capError) return capError;

    // PUBLISH action: creates a snapshot version
    if (body.action === "publish") {
      const { status, body: responseBody } = await publishFormVersion({
        id: body.id,
        fields: body.fields,
        sections: body.sections,
        evaluation_framework: body.evaluation_framework,
        session,
      });
      return NextResponse.json(responseBody, { status });
    }

    // CREATE action — path-guarded against a second Investor intake
    const guard = await guardInvestorIntake({ form_id: null, settings: body.settings });
    if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

    const { status, body: responseBody } = await createForm({ body, session });
    return NextResponse.json(responseBody, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const authError = await requireAuthorization("forms", "edit");
    if (authError) return authError;

    const body = await req.json();

    // Single-active Investor intake guard.
    const guard = await guardInvestorIntake({ form_id: body.id || null, settings: body.settings });
    if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

    // SAVE FIELDS & SECTIONS (used by the builder)
    if (body.fields !== undefined || body.sections !== undefined) {
      const { status, body: responseBody } = await saveFormBuilder({
        id: body.id,
        fields: body.fields,
        sections: body.sections,
      });
      return NextResponse.json(responseBody, { status });
    }

    // SIMPLE UPDATE (metadata only)
    const { status, body: responseBody } = await updateFormMetadata(body);
    return NextResponse.json(responseBody, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuthorization("forms", "delete");
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const permanent = searchParams.get("permanent") === "true";

    const { status, body } = await deleteForm({ id, permanent });
    return NextResponse.json(body, { status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
