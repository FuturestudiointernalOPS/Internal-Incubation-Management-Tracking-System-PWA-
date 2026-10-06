import db from "@/lib/db";

/**
 * Platform AI model — the Founder Fit Score form seed (REPOSITORY layer).
 *
 * The collection upsert, the form/section/field inserts, the conditional-logic
 * binds and the version snapshot/publish. Split verbatim out of
 * `models/platformAi.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ── /api/platform/seed/founder-assessment — Founder Fit Score form seed ──────

/** Upsert the "Founder Assessments" platform collection; returns its id. */
export async function upsertFounderAssessmentCollection() {
  return db.execute({
    sql: `INSERT INTO platform_collections (name, slug, description, status, visibility, tags, category, color, created_by)
            VALUES ('Founder Assessments', 'founder-assessments', 'Standardized founder evaluation assessments for incubation and acceleration programs', 'active', 'internal', ARRAY['assessment','founder','scoring','evaluation'], 'Assessment', '#FF6600', 'system')
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status, updated_at = NOW()
            RETURNING id`,
    args: [],
  });
}

/** Look up the existing Founder Fit Score form (id only). */
export async function findFounderAssessmentForm() {
  return db.execute({
    sql: "SELECT id FROM platform_forms WHERE name = 'Founder Fit Score Assessment'",
    args: [],
  });
}

/** Drop all fields of a form (reseeding wipes the old structure first). */
export async function deleteFounderFormFields(formId) {
  return db.execute({
    sql: "DELETE FROM platform_form_fields WHERE form_id = ?",
    args: [formId],
  });
}

/** Drop all sections of a form (reseeding wipes the old structure first). */
export async function deleteFounderFormSections(formId) {
  return db.execute({
    sql: "DELETE FROM platform_form_sections WHERE form_id = ?",
    args: [formId],
  });
}

/** Reset an existing Founder Fit Score form to the canonical seed definition. */
export async function resetFounderAssessmentForm(description, collectionId, visibility, tags, settings, formId) {
  return db.execute({
    sql: `UPDATE platform_forms SET description = ?, collection_id = ?, visibility = ?, tags = ?, owner_id = 'system', owner_name = 'Platform', settings = ?, status = 'draft', version = 1, updated_at = NOW() WHERE id = ?`,
    args: [description, collectionId, visibility, tags, JSON.stringify(settings), formId],
  });
}

/** Create the Founder Fit Score form; returns its id. */
export async function insertFounderAssessmentForm(collectionId, settings) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, collection_id, status, visibility, version, tags, owner_id, owner_name, settings, created_by)
              VALUES ('Founder Fit Score Assessment', 'Intelligent assessment designed to evaluate whether an entrepreneur or founder is suitable for a startup incubation or acceleration program.', ?, 'draft', 'internal', 1, ARRAY['founder','assessment','scoring','incubation'], 'system', 'Platform', ?, 'system')
              RETURNING id`,
    args: [collectionId, JSON.stringify(settings)],
  });
}

/** Insert the Founder Profile section; returns its id. */
export async function insertFounderProfileSection(formId, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, 'Founder Profile', 'Basic founder and startup information', ?) RETURNING id",
    args: [formId, sortOrder],
  });
}

/** Insert one Founder Profile field; returns its id. */
export async function insertFounderProfileField(formId, sectionId, field) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, validation, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      formId,
      sectionId,
      field.field_type,
      field.label,
      field.required,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      field.sort_order,
    ],
  });
}

/** Insert one scored assessment section; returns its id. */
export async function insertScoredAssessmentSection(formId, title, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, ?, ?) RETURNING id",
    args: [formId, title, sortOrder],
  });
}

/** Insert one scored rating field inside a scored section. */
export async function insertScoredRatingField(formId, sectionId, label, ratingOptions, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, settings, sort_order)
                VALUES (?, ?, 'rating', ?, true, ?, ?, ?)`,
    args: [formId, sectionId, label, JSON.stringify(ratingOptions), JSON.stringify({ scored: true }), sortOrder],
  });
}

/** Insert the Open Response section; returns its id. */
export async function insertOpenResponseSection(formId, sortOrder) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, 'Open Response', ?) RETURNING id",
    args: [formId, sortOrder],
  });
}

/** Insert one open-response textarea field. */
export async function insertOpenResponseField(formId, sectionId, label, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, validation, sort_order)
              VALUES (?, ?, 'textarea', ?, true, ?, ?)`,
    args: [formId, sectionId, label, JSON.stringify({ minLength: 50 }), sortOrder],
  });
}

/** Bind the idea-validation question to the Stage-of-Business field. */
export async function setIdeaValidationApproachLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Describe your idea validation approach'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the customer-interviews question to the Stage-of-Business field. */
export async function setCustomerInterviewsLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Have you conducted any customer interviews?'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the revenue question to the Revenue-Generating/Scaling stages. */
export async function setMonthlyRecurringRevenueLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Monthly Recurring Revenue (USD)'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the paying-customers question to the Revenue-Generating/Scaling stages. */
export async function setPayingCustomersLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'Number of Paying Customers'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** Bind the team-management question to the Team-Size field. */
export async function setTeamManagementLogic(conditionalLogic, formId) {
  return db.execute({
    sql: `UPDATE platform_form_fields SET conditional_logic = ?, updated_at = NOW()
              WHERE form_id = ? AND label = 'How do you manage and coordinate your team?'`,
    args: [JSON.stringify(conditionalLogic), formId],
  });
}

/** All sections of a form in display order (version snapshot). */
export async function getFormSectionsForSnapshot(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_sections WHERE form_id = ? ORDER BY sort_order",
    args: [formId],
  });
}

/** All fields of a form in display order (version snapshot). */
export async function getFormFieldsForSnapshot(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_fields WHERE form_id = ? ORDER BY sort_order",
    args: [formId],
  });
}

/** Full form row (version snapshot settings). */
export async function getFormForSnapshot(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Publish the seeded form structure as version 1 snapshot. */
export async function upsertFounderAssessmentVersion(formId, snapshot) {
  return db.execute({
    sql: `INSERT INTO platform_form_versions (form_id, version, snapshot, published_at, published_by)
            VALUES (?, 1, ?, NOW(), 'system')
            ON CONFLICT (form_id, version) DO UPDATE SET snapshot = EXCLUDED.snapshot, published_at = NOW()`,
    args: [formId, JSON.stringify(snapshot)],
  });
}

/** Flip the seeded form to published once its snapshot is stored. */
export async function publishFounderAssessmentForm(formId) {
  return db.execute({
    sql: "UPDATE platform_forms SET status = 'published', version = 1, updated_at = NOW() WHERE id = ?",
    args: [formId],
  });
}
