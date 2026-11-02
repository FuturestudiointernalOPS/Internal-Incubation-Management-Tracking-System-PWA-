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
import { createFormRun } from "@/models/formRuns";
import { onRunCreated } from "@/models/platform/automation";

/**
 * A section id the builder has not saved yet ("tmp-1712…-3") is not a database
 * id: `parseInt` turns it into NaN, so treating it as an existing section both
 * fails the update and loses the field → section link.
 */
function isUnsavedId(value) {
  if (value === null || value === undefined || value === "") return true;
  return !/^\d+$/.test(String(value).trim());
}

/** The unguessable public slug every run gets (same format as run creation). */
function newPublicSlug() {
  return "r" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

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
 * Publish = save the builder, snapshot what was saved, then create the run that
 * carries that snapshot.
 *
 * Saving first is what makes the snapshot the truth: the builder's payload can
 * still hold temporary section ids that exist only in the browser, and a
 * snapshot of those would pin a layout the database never had (the "scattered"
 * public form). Reading the rows back after the save pins real ids.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function publishFormVersion({ id, fields, sections, evaluation_framework, session }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const formId = parseInt(id);
  const form = await getPlatformFormById(formId);
  if (form.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Form not found" } };
  }

  const currentForm = form.rows[0];

  // ── 1. Persist the builder (unchanged payload shape: both keys optional).
  if (Array.isArray(fields) || Array.isArray(sections)) {
    const saved = await saveFormBuilder({ id: formId, fields, sections });
    if (saved.status !== 200) return saved;
  }

  // ── 2. Snapshot the SAVED rows — real field ids, real section links.
  const liveSections = await getPlatformFormSections(formId);
  const liveFields = await getPlatformFormFields(formId);

  const newVersion = (currentForm.version || 1) + 1;
  const snapshot = {
    fields: liveFields.rows,
    sections: liveSections.rows,
    settings: currentForm.settings,
    publishedAt: new Date().toISOString(),
    evaluation_framework: evaluation_framework || null,
  };

  await createPlatformFormVersion(formId, newVersion, JSON.stringify(snapshot), session?.cid || null);
  await publishPlatformForm(formId, newVersion);

  // ── 3. The run that carries this version, live from the moment it exists.
  //    Its name says which version it pins, so two runs of one form are never
  //    mistaken for each other in the Runs list.
  const createdRun = await createFormRun({
    form_id: formId,
    form_version: newVersion,
    name: `${currentForm.name} v${newVersion}`,
    description: currentForm.description || null,
    opens_at: null,
    closes_at: null,
    settings: {},
    owner_id: session?.cid || null,
    created_by: session?.cid || null,
    public_slug: newPublicSlug(),
    status: "active",
  });
  const run = createdRun?.rows?.[0] || null;
  if (run) onRunCreated(run, session);

  return { status: 200, body: { success: true, version: newVersion, run } };
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
  //    A section the builder has not saved yet arrives with a temporary id
  //    ("tmp-…") or none at all. It is INSERTED, and the temporary id is kept
  //    in `tempIdToRealId` so this request's fields can be pointed at the row
  //    that was just created — otherwise they fall out of their section.
  const tempIdToRealId = new Map();
  if (Array.isArray(sections)) {
    for (const sec of sections) {
      if (sec._delete) continue; // handled in Step 4
      if (!isUnsavedId(sec.id)) {
        await updatePlatformFormSection({ formId: id, section: { ...sec, id: parseInt(sec.id) } });
        continue;
      }

      const created = await createPlatformFormSection({ formId: id, section: sec });
      const realId = parseInt(created?.rows?.[0]?.id);
      const tempKey = sec._tmpId ?? sec.id;
      if (tempKey !== null && tempKey !== undefined && !isNaN(realId)) {
        tempIdToRealId.set(String(tempKey), realId);
      }
    }
  }

  // ── Step 3: Upsert fields.
  //    A field's section_id is only accepted when that section actually exists
  //    for THIS form, after the upsert above. The client can still be holding a
  //    section id that was deleted in an earlier request (or in another tab);
  //    writing it violated `platform_form_fields_section_id_fkey` and rejected
  //    the WHOLE save. A field with no section is recoverable — a rejected save
  //    is not.
  if (Array.isArray(fields)) {
    const sectionsNow = await getPlatformFormSections(id);
    const liveSectionIds = new Set(
      (sectionsNow.rows || [])
        .map((row) => parseInt(row.id))
        .filter((value) => !isNaN(value)),
    );

    for (const fld of fields) {
      if (fld._delete && fld.id) {
        await deletePlatformFormField({ formId: id, fieldId: fld.id });
        continue;
      }

      // Resolve section_id: a temporary id becomes the row created in Step 2
      // (when this request carried that section), and a real id is kept only
      // while the section still exists and is not being deleted. Anything else
      // is nulled out — a field with no section is recoverable, a rejected save
      // is not.
      const rawSection = fld.section_id;
      let resolvedSectionId = null;
      if (!isUnsavedId(rawSection)) {
        const numericId = parseInt(rawSection);
        if (!deletedSectionIds.has(numericId) && liveSectionIds.has(numericId)) {
          resolvedSectionId = numericId;
        }
      } else if (rawSection !== null && rawSection !== undefined && rawSection !== "") {
        resolvedSectionId = tempIdToRealId.get(String(rawSection)) ?? null;
      }

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
