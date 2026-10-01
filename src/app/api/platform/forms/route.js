import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { listPlatformForms } from "@/models/forms";
import {
  getFormDetail,
  publishFormVersion,
  createForm,
  guardSingleInvestorFormOnUpdate,
  updateFormFieldsAndSections,
  updateFormMetadata,
  deleteOrArchiveForm,
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
      const { getSession } = await import("@/lib/auth");
      const session = await getSession();
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

      const result = await getFormDetail(id);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
      return NextResponse.json({ success: true, form: result.form, sections: result.sections, fields: result.fields });
    }

    // Listing forms is the Forms module's read capability. Single-form reads
    // above stay open to any authenticated user (participants fill forms).
    const authError = await requireAuthorization("forms", "view");
    if (authError) return authError;

    // List forms with filters
    const result = await listPlatformForms(collectionId, status);
    return NextResponse.json({ success: true, forms: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
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
      const result = await publishFormVersion({
        id: body.id,
        fields: body.fields,
        sections: body.sections,
        evaluation_framework: body.evaluation_framework,
        actorId: session.cid,
      });
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
      return NextResponse.json({ success: true, version: result.version });
    }

    // CREATE action
    const { name, description, collection_id, visibility, settings, tags } = body;
    const result = await createForm({ name, description, collection_id, visibility, settings, tags, session });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, ...(result.code ? { code: result.code } : {}) },
        { status: result.statusCode || 500 },
      );
    }
    return NextResponse.json({ success: true, form: result.form });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const { getSession } = await import("@/lib/auth");
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const authError = await requireAuthorization("forms", "edit");
    if (authError) return authError;

    const body = await req.json();

    // Single-active Investor intake guard — runs on every PUT, before either
    // branch below (matches the original: the check never depended on which
    // kind of update this is).
    const guard = await guardSingleInvestorFormOnUpdate(body.id || null, body.settings);
    if (!guard.ok) {
      return NextResponse.json({ success: false, error: guard.error, code: guard.code }, { status: guard.statusCode });
    }

    // SAVE FIELDS & SECTIONS (used by the builder)
    if (body.fields !== undefined || body.sections !== undefined) {
      const { id, fields, sections } = body;
      const result = await updateFormFieldsAndSections({ id, fields, sections });
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
      return NextResponse.json({ success: true });
    }

    // SIMPLE UPDATE (metadata only)
    const { id, name, description, collection_id, visibility, tags, status, settings } = body;
    const result = await updateFormMetadata({ id, name, description, collection_id, visibility, tags, status, settings });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, ...(result.code ? { code: result.code } : {}) },
        { status: result.statusCode || 500 },
      );
    }
    return NextResponse.json({ success: true, form: result.form });
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
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const result = await deleteOrArchiveForm({ id, permanent });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
