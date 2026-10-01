/**
 * PLATFORM FORMS — decisions, extracted from the controller.
 *
 * `src/app/api/platform/forms/route.js` mixed its controller (auth, request
 * parsing, response shaping) with: the published-snapshot fallback read, the
 * publish-a-version algorithm, the single-active-investor-form guard, the
 * fields/sections upsert ordering (section updates → field upserts → section
 * deletes, to avoid an FK violation), and the permanent-delete-vs-archive
 * choice. Moved here VERBATIM — no SQL, no HTTP.
 *
 * See docs/GUIDE_DECOUPAGE_COUCHES.md for the method.
 */

import {
  getPlatformFormByTextId,
  getPlatformFormSections,
  getPlatformFormFields,
  getLatestPlatformFormVersion,
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
 * Single form + its fields/sections. Falls back to the last published
 * snapshot when the live tables are empty AND the form hasn't been edited
 * since that publish (otherwise an intentional clear would be overridden).
 */
export async function getFormDetail(id) {
  const form = await getPlatformFormByTextId(id);
  if (form.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "errors.notFound" };
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

  return { ok: true, form: form.rows[0], sections: sectionsResult, fields: fieldsResult };
}

/**
 * The single-active-investor-form guard FOR THE UPDATE PATH. Kept as its own
 * copy (not shared with `createForm`'s guard below) on purpose: a test
 * (`investor-application-intake.test.js`) counts exactly one call site per
 * path to prove both are still guarded independently — a shared helper would
 * make that count unverifiable from either call site alone.
 */
export async function guardSingleInvestorFormOnUpdate(excludeFormId, settings) {
  if (settings?.investor_application !== true) return { ok: true };
  const { assertSingleInvestorForm, ensureSingleInvestorFormIndex } = await import("@/models/investorIntake");
  const guard = await assertSingleInvestorForm(excludeFormId ?? null);
  if (!guard.ok) {
    return {
      ok: false,
      statusCode: 409,
      code: "SINGLE_INVESTOR_FORM",
      error: `Investor registration is already assigned to form "${guard.owner.name}". Deactivate it there before assigning another form.`,
    };
  }
  await ensureSingleInvestorFormIndex();
  return { ok: true };
}

/** PUBLISH action — creates a version snapshot and bumps the form's version. */
export async function publishFormVersion({ id, fields, sections, evaluation_framework, actorId }) {
  if (!id || !fields || !sections) {
    return { ok: false, statusCode: 400, error: "id, fields, and sections are required" };
  }

  const form = await getPlatformFormById(parseInt(id));
  if (form.rows.length === 0) {
    return { ok: false, statusCode: 404, error: "Form not found" };
  }

  const currentForm = form.rows[0];
  const newVersion = (currentForm.version || 1) + 1;
  const snapshot = {
    fields,
    sections,
    settings: currentForm.settings,
    publishedAt: new Date().toISOString(),
    evaluation_framework: evaluation_framework || null,
  };

  // Save version snapshot
  await createPlatformFormVersion(parseInt(id), newVersion, JSON.stringify(snapshot), actorId || null);

  // Increment version on form
  await publishPlatformForm(parseInt(id), newVersion);

  return { ok: true, version: newVersion };
}

/** CREATE action (includes its own copy of the single-investor-form guard). */
export async function createForm({ name, description, collection_id, visibility, settings, tags, session }) {
  if (settings?.investor_application === true) {
    const { assertSingleInvestorForm, ensureSingleInvestorFormIndex } = await import("@/models/investorIntake");
    const guard = await assertSingleInvestorForm(null);
    if (!guard.ok) {
      return {
        ok: false,
        statusCode: 409,
        code: "SINGLE_INVESTOR_FORM",
        error: `Investor registration is already assigned to form "${guard.owner.name}". Deactivate it there before assigning another form.`,
      };
    }
    await ensureSingleInvestorFormIndex();
  }

  if (!name || !name.trim()) {
    return { ok: false, statusCode: 400, error: "Name is required" };
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

  return { ok: true, form: result.rows[0] };
}

/**
 * SAVE FIELDS & SECTIONS (used by the builder) — verbatim 4-step ordering:
 * sections are upserted (never deleted yet), then fields are upserted
 * (resolving any reference to a to-be-deleted section to null), and only
 * then are the sections actually deleted — so no FK violation can occur.
 */
export async function updateFormFieldsAndSections({ id, fields, sections }) {
  if (!id) return { ok: false, statusCode: 400, error: "id is required" };

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

  return { ok: true };
}

/**
 * SIMPLE UPDATE (metadata only). The single-investor-form guard runs in the
 * controller for every PUT (it never depended on which branch follows), not
 * here — see checkSingleInvestorFormGuard.
 */
export async function updateFormMetadata({ id, name, description, collection_id, visibility, tags, status, settings }) {
  if (!id) return { ok: false, statusCode: 400, error: "id is required" };

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

  return { ok: true, form: result.rows[0] };
}

/** DELETE action — permanent (cascading cleanup) or a soft archive. */
export async function deleteOrArchiveForm({ id, permanent }) {
  if (!id) return { ok: false, statusCode: 400, error: "id is required" };
  const formId = parseInt(id);

  if (permanent) {
    // Hard delete the form and everything attached to it. Sections, fields,
    // versions and runs cascade via FK; email/review/evaluation logs for the
    // form's runs' submissions must be cleaned up explicitly first.
    await deletePlatformEmailLogsForForm(formId);
    await deletePlatformSubmissionReviewsForForm(formId);
    await deletePlatformSubmissionEvaluationsForForm(formId);
    await deletePlatformForm(formId);
    return { ok: true };
  }

  await archivePlatformForm(formId);
  return { ok: true };
}
