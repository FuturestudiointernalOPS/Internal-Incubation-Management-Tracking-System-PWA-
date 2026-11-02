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

/** A strict positive integer from an id of any shape, or null. */
function toNumericId(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
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
 * The builder save. The whole state arrives in ONE request: sections upserted,
 * fields re-pointed, then deletions — section deletions last, after the fields
 * that referenced them have moved away (the FK is `section_id`).
 *
 * Two rules keep a stale editor from failing the save on the foreign key:
 *   - a section the client believes exists but this form no longer has is
 *     re-created (its id mapped) instead of silently skipped;
 *   - a field's section id that does not match a section this form owns — or
 *     that is being deleted in this same request — becomes NULL.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function saveFormBuilder({ id, fields, sections }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  // ── Step 1: sections this request removes, and the ones the form really has.
  const deletedSectionIds = new Set();
  if (Array.isArray(sections)) {
    for (const sec of sections) {
      if (sec._delete) {
        const numericId = toNumericId(sec.id);
        if (numericId != null) deletedSectionIds.add(numericId);
      }
    }
  }
  const existingSections = await getPlatformFormSections(id);
  const knownSectionIds = new Set(
    (existingSections.rows || []).map((row) => Number(row.id)),
  );

  // ── Step 2: upsert sections (inserts/updates only — deletions come later).
  //    New sections carry their builder-side temporary id, so the fields that
  //    already point at it can be handed the real id below.
  const sectionIdMap = new Map();
  if (Array.isArray(sections)) {
    for (const sec of sections) {
      if (sec._delete) continue; // handled in Step 4
      const numericId = toNumericId(sec.id);
      if (numericId != null && knownSectionIds.has(numericId)) {
        await updatePlatformFormSection({ formId: id, section: sec });
        continue;
      }

      const created = await createPlatformFormSection({ formId: id, section: sec });
      const createdId = toNumericId(created?.rows?.[0]?.id);
      if (createdId == null) continue;
      knownSectionIds.add(createdId);
      if (sec.id != null) sectionIdMap.set(String(sec.id), createdId);
      if (sec._tmpId != null) sectionIdMap.set(String(sec._tmpId), createdId);
    }
  }

  // ── Step 3: upsert fields.
  if (Array.isArray(fields)) {
    for (const fld of fields) {
      if (fld._delete && fld.id) {
        await deletePlatformFormField({ formId: id, fieldId: fld.id });
        continue;
      }

      // Resolve section_id through the sections this form now owns (including
      // the ones just created). Anything else becomes NULL: a stale or
      // foreign id can never reach the foreign key.
      let resolvedSectionId = null;
      if (fld.section_id != null && fld.section_id !== "") {
        const key = String(fld.section_id);
        resolvedSectionId = sectionIdMap.get(key) ?? toNumericId(key);
      }
      if (
        resolvedSectionId != null &&
        (deletedSectionIds.has(resolvedSectionId) || !knownSectionIds.has(resolvedSectionId))
      ) {
        resolvedSectionId = null;
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

/** Drop a builder-only marker before a row is re-inserted. */
function withoutDeleteMarker(row) {
  if (!row || typeof row !== "object") return {};
  const { _delete: _ignoredDelete, ...rest } = row;
  return rest;
}

const normalizeTitle = (value) => String(value || "").trim().toLowerCase();

/** The live section a published one should reuse, so its id (and its questions) survive. */
function matchLiveSection(snapshotSection, liveSections) {
  return liveSections.findIndex(
    (live) => normalizeTitle(live.title) === normalizeTitle(snapshotSection.title),
  );
}

/**
 * The live question a published one should reuse: same wording and type first,
 * then the same type at the same position (a question that was renamed since
 * the publication). Matching on identity (not on the wording alone) is what
 * keeps already-collected answers attached, since answers are filed by the
 * question's own id.
 */
function matchLiveField(snapshotField, liveFields) {
  let index = liveFields.findIndex(
    (live) =>
      String(live.label) === String(snapshotField.label) &&
      String(live.field_type) === String(snapshotField.field_type),
  );
  if (index === -1) {
    index = liveFields.findIndex(
      (live) =>
        Number(live.sort_order) === Number(snapshotField.sort_order) &&
        String(live.field_type) === String(snapshotField.field_type),
    );
  }
  return index;
}

/**
 * Restore a form's sections and questions from its last published version.
 *
 * Used to repair a form whose live content was lost (the sections are gone but
 * the questions survived, detached) and as a rollback to the published
 * structure. It is a MERGE, not a wholesale replacement:
 *   - a live section whose title matches a published one keeps its id;
 *   - a live question that matches a published one keeps its id (so answers
 *     already collected stay under the right question);
 *   - missing published sections/questions are re-created;
 *   - content added since the publication is kept rather than destroyed.
 * Settings and metadata are left alone. The work is done by the same save the
 * builder uses, so relationships follow the same rules.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function restoreFormFromLatestVersion({ id }) {
  const formId = toNumericId(id);
  if (formId == null) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const form = await getPlatformFormById(formId);
  if (form.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Form not found" } };
  }

  const version = await getLatestPlatformFormVersion(formId);
  const snapshot = version.rows[0]?.snapshot || null;
  const snapshotSections = Array.isArray(snapshot?.sections) ? snapshot.sections : [];
  const snapshotFields = Array.isArray(snapshot?.fields) ? snapshot.fields : [];

  if (snapshotSections.length === 0 && snapshotFields.length === 0) {
    return {
      status: 409,
      body: { success: false, error: "This form has no published version to restore." },
    };
  }

  const currentSections = await getPlatformFormSections(formId);
  const currentFields = await getPlatformFormFields(formId);
  const liveSections = [...(currentSections.rows || [])];
  const liveFields = [...(currentFields.rows || [])];

  // Where each published section reference lands: a kept section keeps its id;
  // a re-created one is mapped by its temporary id, and the save hands it the
  // id it creates for it.
  const sectionReferences = new Map();
  const sections = [];
  for (const snapshotSection of snapshotSections) {
    const cleanSection = withoutDeleteMarker(snapshotSection);
    const reference = String(cleanSection._tmpId ?? cleanSection.id ?? "");
    const index = matchLiveSection(cleanSection, liveSections);
    if (index !== -1) {
      const [liveSection] = liveSections.splice(index, 1);
      sections.push({ ...cleanSection, id: liveSection.id });
      sectionReferences.set(reference, String(liveSection.id));
    } else {
      sections.push({ ...cleanSection, id: null, _tmpId: reference });
    }
  }
  // Sections that the published version never had are removed (their questions,
  // if any survived, are kept and simply detached by the save).
  sections.push(...liveSections.map((liveSection) => ({ id: liveSection.id, _delete: true })));

  const fields = [];
  for (const snapshotField of snapshotFields) {
    const cleanField = withoutDeleteMarker(snapshotField);
    const reference = String(cleanField.section_id ?? "");
    const sectionId = sectionReferences.get(reference) ?? cleanField.section_id;
    const index = matchLiveField(cleanField, liveFields);
    if (index !== -1) {
      const [liveField] = liveFields.splice(index, 1);
      fields.push({ ...cleanField, id: liveField.id, section_id: sectionId });
    } else {
      fields.push({ ...cleanField, id: null, section_id: sectionId });
    }
  }
  // Questions added since the publication are kept as they are.
  fields.push(...liveFields);

  return saveFormBuilder({ id: formId, fields, sections });
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
