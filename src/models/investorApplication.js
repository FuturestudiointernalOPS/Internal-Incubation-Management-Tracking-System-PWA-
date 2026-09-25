import db from "@/lib/db";

/**
 * INVESTOR APPLICATION — data access for the investor intake seed + run
 * resolution.
 *
 *   - `src/app/api/platform/seed/investor-application/route.js`  (seed SQL)
 *   - `src/app/api/platform/investor-run/route.js`               (run lookup)
 *
 * The Investor Application is a normal form inside the existing platform forms
 * engine: a form flagged settings.investor_application = true with ONE active
 * run whose public_slug is the link handed to prospective investors. No new
 * form system, no fixed questionnaire.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it operates on.
 */

// ── /api/platform/seed/investor-application — form + run seed ────────────────

/** Existing Investor Application form row (if any). */
export async function findInvestorApplicationFormByName(name) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE name = ?",
    args: [name],
  });
}

/** Set the Investor flag on an existing form (idempotent re-flag). */
export async function flagFormAsInvestorApplication(formId) {
  return db.execute({
    sql: `UPDATE platform_forms
            SET settings = settings || '{"investor_application": true}'::jsonb,
                updated_at = NOW()
            WHERE id = ?`,
    args: [formId],
  });
}

/** Create the Investor Application form; returns its id. */
export async function createInvestorApplicationForm(name, description, settings) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, status, visibility, version, settings, created_by, owner_id, owner_name, created_at, updated_at)
              VALUES (?, ?, 'published', 'internal', 1, ?::jsonb, 'system', 'system', 'Platform', NOW(), NOW())
              RETURNING id`,
    args: [name, description, JSON.stringify(settings)],
  });
}

/** Insert a section into the Investor Application form; returns its id. */
export async function insertInvestorApplicationSection(formId, title, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_sections (form_id, title, sort_order, created_at)
                VALUES (?, ?, ?, NOW()) RETURNING id`,
    args: [formId, title, sortOrder],
  });
}

/**
 * Insert a field into the Investor Application form. `field.key` is persisted in
 * settings so the approval provisioning can map an answer back to its meaning
 * (the same mechanism the Venture intake uses).
 */
export async function insertInvestorApplicationField(formId, sectionId, field, sortOrder) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, required, options, settings, sort_order, created_at)
                  VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, NOW())`,
    args: [
      formId,
      sectionId,
      field.type,
      field.label,
      field.required ? true : false,
      JSON.stringify(field.options || []),
      JSON.stringify({ key: field.key }),
      sortOrder,
    ],
  });
}

/** Store the Investor Application form's version-1 snapshot. */
export async function insertInvestorApplicationSnapshot(formId, snapshot) {
  return db.execute({
    sql: `INSERT INTO platform_form_versions (form_id, version, snapshot, published_at, published_by, created_at)
              VALUES (?, 1, ?::jsonb, NOW(), 'system', NOW())`,
    args: [formId, JSON.stringify(snapshot)],
  });
}

/** Reload the form row after the seed wrote its sections/fields. */
export async function getFormByIdForInvestorSeed(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** The form's active, shareable run (if any). At most one is used as the link. */
export async function findActiveInvestorRun(formId) {
  return db.execute({
    sql: `SELECT * FROM platform_form_runs
            WHERE form_id = ? AND status = 'active' AND public_slug IS NOT NULL
            ORDER BY created_at DESC LIMIT 1`,
    args: [formId],
  });
}

/** Create the Investor Application run with its public slug. */
export async function createInvestorApplicationRun(formId, formVersion, name, description, slug) {
  return db.execute({
    sql: `INSERT INTO platform_form_runs (form_id, form_version, name, description, status, settings, owner_id, created_by, public_slug, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'active', ?::jsonb, 'system', 'system', ?, NOW(), NOW())
              RETURNING id`,
    args: [formId, formVersion || 1, name, description, JSON.stringify({}), slug],
  });
}

/** Reload a run by id. */
export async function getInvestorRunById(runId) {
  return db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}

// ── Run resolution ───────────────────────────────────────────────────────────

/**
 * The configured Investor Run: the active, shareable run of the single form
 * flagged settings.investor_application = true. Returns null when the seed has
 * not been run yet.
 */
export async function resolveInvestorRun() {
  try {
    const result = await db.execute({
      sql: `SELECT r.* FROM platform_form_runs r
              JOIN platform_forms f ON r.form_id = f.id
              WHERE f.settings->>'investor_application' = 'true'
                AND r.status = 'active'
                AND r.public_slug IS NOT NULL
              ORDER BY r.created_at DESC LIMIT 1`,
      args: [],
    });
    return (result.rows || [])[0] || null;
  } catch (_) {
    return null;
  }
}

export default {
  findInvestorApplicationFormByName,
  flagFormAsInvestorApplication,
  createInvestorApplicationForm,
  insertInvestorApplicationSection,
  insertInvestorApplicationField,
  insertInvestorApplicationSnapshot,
  getFormByIdForInvestorSeed,
  findActiveInvestorRun,
  createInvestorApplicationRun,
  getInvestorRunById,
  resolveInvestorRun,
};
