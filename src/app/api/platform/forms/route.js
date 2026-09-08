import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getPlatformFormByTextId,
  getPlatformFormSections,
  getPlatformFormFields,
  getLatestPlatformFormVersion,
  listPlatformForms,
  getPlatformFormById,
  createPlatformFormVersion,
  publishPlatformForm,
  createPlatformForm,
  updatePlatformFormSection,
  createPlatformFormSection,
  deletePlatformFormField,
  updatePlatformFormField,
  createPlatformFormField,
  deletePlatformFormSection,
  touchPlatformForm,
  updatePlatformFormMetadata,
  deletePlatformEmailLogsForForm,
  deletePlatformSubmissionReviewsForForm,
  deletePlatformSubmissionEvaluationsForForm,
  deletePlatformForm,
  archivePlatformForm,
} from "@/models/forms";

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

      const form = await getPlatformFormByTextId(id);
      if (form.rows.length === 0) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }

      const sections = await getPlatformFormSections(id);

      const fields = await getPlatformFormFields(id);

      let sectionsResult = sections.rows;
      let fieldsResult = fields.rows;

      // ─── Fallback: read from version snapshot if live tables are empty but form is published ───
      // Only fall back if the form hasn't been edited since the last publish
      if (sectionsResult.length === 0 && fieldsResult.length === 0 && form.rows[0].status === "published") {
        const version = await getLatestPlatformFormVersion(parseInt(id));
        // Only use snapshot if form hasn't been saved since publish (user intentionally cleared sections)
        if (version.rows.length > 0 && version.rows[0].snapshot) {
          const snapshotTime = new Date(version.rows[0].created_at).getTime();
          const updateTime = form.rows[0].updated_at ? new Date(form.rows[0].updated_at).getTime() : 0;
          // If form was updated after the snapshot, user intentionally edited — respect their changes
          if (updateTime <= snapshotTime) {
            const snap = version.rows[0].snapshot;
            sectionsResult = snap.sections || [];
            fieldsResult = snap.fields || [];
          }
        }
      }

      return NextResponse.json({
        success: true,
        form: form.rows[0],
        sections: sectionsResult,
        fields: fieldsResult,
      });
    }

    // All other operations require admin
    const authError = await requireAuth(["super_admin", "admin", "staff"]);
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
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const body = await req.json();

    // PUBLISH action: creates a snapshot version
    if (body.action === "publish") {
      if (!body.id || !body.fields || !body.sections) {
        return NextResponse.json({ success: false, error: "id, fields, and sections are required" }, { status: 400 });
      }

      const form = await getPlatformFormById(parseInt(body.id));
      if (form.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Form not found" }, { status: 404 });
      }

      const f = form.rows[0];
      const newVersion = (f.version || 1) + 1;
      const snapshot = {
        fields: body.fields,
        sections: body.sections,
        settings: f.settings,
        publishedAt: new Date().toISOString(),
        evaluation_framework: body.evaluation_framework || null,
      };

      // Save version snapshot
      await createPlatformFormVersion(
        parseInt(body.id),
        newVersion,
        JSON.stringify(snapshot),
        session.cid || null,
      );

      // Increment version on form
      await publishPlatformForm(parseInt(body.id), newVersion);

      return NextResponse.json({ success: true, version: newVersion });
    }

    // CREATE action
    const { name, description, collection_id, visibility, settings, tags } = body;

    // Single-active Venture intake guard: creating a NEW form must not be
    // able to become another active Venture form while one already exists.
    if (settings?.venture_application === true) {
      const { assertSingleVentureForm, ensureSingleVentureFormIndex } = await import("@/lib/ventureIntake");
      const guard = await assertSingleVentureForm(null);
      if (!guard.ok) {
        return NextResponse.json(
          { success: false, code: "SINGLE_VENTURE_FORM", error: `Venture registration is already assigned to form "${guard.owner.name}". Deactivate it there before assigning another form.` },
          { status: 409 },
        );
      }
      await ensureSingleVentureFormIndex();
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    const result = await createPlatformForm({
      name,
      description,
      collection_id,
      visibility,
      settings,
      tags,
      owner_id: session.cid,
      owner_name: null,
      created_by: session.cid,
    });

    return NextResponse.json({ success: true, form: result.rows[0] });
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
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const body = await req.json();

    // Single-active Venture intake guard: no write path may set the Venture
    // flag on a second form while another form already holds it.
    if (body.settings?.venture_application === true) {
      const { assertSingleVentureForm, ensureSingleVentureFormIndex } = await import("@/lib/ventureIntake");
      const guard = await assertSingleVentureForm(body.id || null);
      if (!guard.ok) {
        return NextResponse.json(
          { success: false, code: "SINGLE_VENTURE_FORM", error: `Venture registration is already assigned to form "${guard.owner.name}". Deactivate it there before assigning another form.` },
          { status: 409 },
        );
      }
      await ensureSingleVentureFormIndex();
    }

    // SAVE FIELDS & SECTIONS (used by the builder)
    if (body.fields !== undefined || body.sections !== undefined) {
      const { id, fields, sections } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
      }

      // ── Step 1: Collect section IDs that will be deleted in this request.
      //    We must NOT delete them yet — fields still reference them and must be
      //    updated first. Deleting a section before its fields are re-assigned
      //    triggers the FK violation ("platform_form_fields_section_id_fkey").
      const deletedSectionIds = new Set();
      if (Array.isArray(sections)) {
        for (const sec of sections) {
          if (sec._delete && sec.id) {
            deletedSectionIds.add(parseInt(sec.id));
          }
        }
      }

      // ── Step 2: Upsert sections (inserts/updates only — deletions come later).
      if (Array.isArray(sections)) {
        for (const sec of sections) {
          if (sec._delete) continue; // handled in Step 4
          if (sec.id) {
            await updatePlatformFormSection({ formId: id, section: sec });
          } else {
            await createPlatformFormSection({ formId: id, section: sec });
          }
        }
      }

      // ── Step 3: Upsert fields.
      //    If a field's section_id points to a section that is being deleted in
      //    this same request, use null instead — avoids the FK violation.
      if (Array.isArray(fields)) {
        for (const fld of fields) {
          if (fld._delete && fld.id) {
            await deletePlatformFormField({ formId: id, fieldId: fld.id });
            continue;
          }

          // Resolve section_id: null-out if the section is being deleted or
          // if the value is a non-numeric temp string (e.g. "_tmp_xyz").
          const rawSectionId = fld.section_id ? parseInt(fld.section_id) : null;
          const resolvedSectionId =
            rawSectionId && !isNaN(rawSectionId) && !deletedSectionIds.has(rawSectionId)
              ? rawSectionId
              : null;

          if (fld.id) {
            await updatePlatformFormField({ formId: id, field: fld, sectionId: resolvedSectionId });
          } else {
            await createPlatformFormField({ formId: id, field: fld, sectionId: resolvedSectionId });
          }
        }
      }

      // ── Step 4: Now it is safe to delete sections.
      //    All fields that referenced them have already been re-assigned to null,
      //    so no FK violation can occur. The DB ON DELETE SET NULL acts as a
      //    safety net for any edge-case fields not sent in this payload.
      for (const sectionId of deletedSectionIds) {
        await deletePlatformFormSection({ formId: id, sectionId });
      }

      await touchPlatformForm(id);

      return NextResponse.json({ success: true });
    }

    // SIMPLE UPDATE (metadata only)
    const { id, name, description, collection_id, visibility, tags, status, settings } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const result = await updatePlatformFormMetadata({
      id,
      name,
      description,
      collection_id,
      visibility,
      tags,
      status,
      settings,
    });

    return NextResponse.json({ success: true, form: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const permanent = searchParams.get("permanent") === "true";
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const formId = parseInt(id);

    if (permanent) {
      // Hard delete the form and everything attached to it. Sections, fields,
      // versions and runs cascade via FK; email/review/evaluation logs for the
      // form's runs' submissions must be cleaned up explicitly first.
      await deletePlatformEmailLogsForForm(formId);
      await deletePlatformSubmissionReviewsForForm(formId);
      await deletePlatformSubmissionEvaluationsForForm(formId);
      await deletePlatformForm(formId);
      return NextResponse.json({ success: true });
    }

    await archivePlatformForm(formId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
