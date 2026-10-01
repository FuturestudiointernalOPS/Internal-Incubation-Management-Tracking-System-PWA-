/**
 * Platform — the Forms CRUD + versioning (SERVICE layer).
 *
 * The domain work behind `/api/platform/forms`: the version-snapshot fallback
 * for a published-but-empty form, the publish (snapshot + version bump), the
 * create with the single-active-Investor guard, the FK-safe builder save
 * (sections upserted, fields re-pointed, deletions last) and the permanent
 * delete cascade.
 *
 * The CONTROLLER keeps `initDb`, the session check, the `forms.*` capabilities
 * and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import {
  archivePlatformForm,
  createPlatformForm,
  createPlatformFormField,
  createPlatformFormSection,
  createPlatformFormVersion,
  deletePlatformEmailLogsForForm,
  deletePlatformForm,
  deletePlatformFormField,
  deletePlatformFormSection,
  deletePlatformSubmissionEvaluationsForForm,
  deletePlatformSubmissionReviewsForForm,
  getLatestPlatformFormVersion,
  getPlatformFormById,
  getPlatformFormByTextId,
  getPlatformFormFields,
  getPlatformFormSections,
  listPlatformForms,
  publishPlatformForm,
  touchPlatformForm,
  updatePlatformFormField,
  updatePlatformFormMetadata,
  updatePlatformFormSection,
} from "@/models/forms";
import { assertSingleInvestorForm, ensureSingleInvestorFormIndex } from "@/models/investorIntake";

// ── Reads ───────────────────────────────────────────────────────────────────

/**
 * One form with its sections + fields. Falls back to the latest version
 * snapshot when the live tables are empty but the form is published AND has not
 * been edited since that snapshot (an intentional clear is respected).
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function getFormDetail(id) {
  const form = await getPlatformFormByTextId(id);
  if (form.rows.length === 0) {
    return { status: 404, body: { success: false, error: "errors.notFound" } };
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

  return {
    status: 200,
    body: { success: true, form: form.rows[0], sections: sectionsResult, fields: fieldsResult },
  };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function listForms({ collectionId, status }) {
  const result = await listPlatformForms(collectionId, status);
  return { status: 200, body: { success: true, forms: result.rows } };
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * The single-active Investor intake guard, shared by both write paths (create
 * and update). Refuses a second form that claims `investor_application`.
 *
 * @returns {Promise<{ok: true} | {ok: false, status: number, body: Object}>}
 */
export async function guardInvestorIntake({ form_id = null, settings } = {}) {
  if (settings?.investor_application === true) {
    const guard = await assertSingleInvestorForm(form_id);
    if (!guard.ok) {
      return {
        ok: false,
        status: 409,
        body: {
          success: false,
          code: "SINGLE_INVESTOR_FORM",
          error: `Investor registration is already assigned to form "${guard.owner.name}". Deactivate it there before assigning another form.`,
        },
      };
    }
    await ensureSingleInvestorFormIndex();
  }
  return { ok: true };
}

/**
 * Publish a new version: snapshot the given fields/sections and bump the form.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function publishFormVersion({ id, fields, sections, evaluation_framework, session }) {
  if (!id || !fields || !sections) {
    return { status: 400, body: { success: false, error: "id, fields, and sections are required" } };
  }

  const form = await getPlatformFormById(parseInt(id));
  if (form.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Form not found" } };
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
  await createPlatformFormVersion(parseInt(id), newVersion, JSON.stringify(snapshot), session.cid || null);

  // Increment version on form
  await publishPlatformForm(parseInt(id), newVersion);

  return { status: 200, body: { success: true, version: newVersion } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function createForm({ body, session }) {
  const { name, description, collection_id, visibility, settings, tags } = body;

  if (!name || !name.trim()) {
    return { status: 400, body: { success: false, error: "Name is required" } };
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

  return { status: 200, body: { success: true, form: result.rows[0] } };
}

/**
 * The builder save. Section deletions run AFTER field upserts so a field that
 * still references a deleted section never trips the FK
 * (`platform_form_fields_section_id_fkey`).
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function saveFormBuilder({ id, fields, sections }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
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
        rawSectionId && !isNaN(rawSectionId) && !deletedSectionIds.has(rawSectionId) ? rawSectionId : null;

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

  return { status: 200, body: { success: true } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function updateFormMetadata({ id, name, description, collection_id, visibility, tags, status, settings }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
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

  return { status: 200, body: { success: true, form: result.rows[0] } };
}

/**
 * Archive, or hard-delete when `permanent`. A permanent delete removes the
 * form's run submissions' email/review/evaluation logs first (sections, fields,
 * versions and runs cascade via FK).
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function deleteForm({ id, permanent }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const formId = parseInt(id);

  if (permanent) {
    await deletePlatformEmailLogsForForm(formId);
    await deletePlatformSubmissionReviewsForForm(formId);
    await deletePlatformSubmissionEvaluationsForForm(formId);
    await deletePlatformForm(formId);
    return { status: 200, body: { success: true } };
  }

  await archivePlatformForm(formId);
  return { status: 200, body: { success: true } };
}
