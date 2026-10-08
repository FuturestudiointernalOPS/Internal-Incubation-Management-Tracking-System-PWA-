import db from "@/lib/db";

/**
 * Families (contact groups) store — the public registration lookup, the PM
 * scoping read, the schema self-heals and the family CRUD.
 *
 * Split out of `src/models/contacts.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/contacts` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET /api/contacts/full-state — PM families ───────────────────────────────

/** Families belonging to the PM's programs and/or groups. */
export async function getFamiliesScopedByProgramsAndGroups(programIds, programNames) {
  const idPlaceholders = programIds.map(() => "?").join(",") || "NULL";
  const namePlaceholders = programNames.map(() => "?").join(",") || "NULL";
  return db.execute({
    sql: `SELECT * FROM families
                WHERE program_id IN (${idPlaceholders})
                OR UPPER(TRIM(name)) IN (${namePlaceholders})`,
    args: [...programIds, ...programNames],
  });
}

// ── GET /api/families ─────────────────────────────────────────────────────────

/** Public lookup: family by registration id (join page). */
export async function getFamilyByRegistrationId(regId) {
  return db.execute({
    sql: "SELECT * FROM families WHERE registration_id = ?",
    args: [regId],
  });
}

/** All families, name-ordered. */
export async function getAllFamilies() {
  return db.execute("SELECT * FROM families ORDER BY name ASC");
}

// ── POST /api/families ────────────────────────────────────────────────────────

/** Schema backfills for legacy families tables (errors swallowed by caller). */
export async function ensureFamilyDescriptionColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS description TEXT");
}

export async function ensureFamilyFormIdColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS form_id UUID");
}

export async function ensureFamilyDefaultRoleColumn() {
  return db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT");
}

/** Auto-create the platform registration form for a new family/group. */
export async function createFamilyRegistrationForm(name) {
  return db.execute({
    sql: "INSERT INTO platform_forms (name, description, owner_id, owner_name, created_by) VALUES (?, 'Auto-created for group: ' || ?, 'system', 'AI', 'system') RETURNING id",
    args: [name, name],
  });
}

/** Create the default 'Profile Information' section on the form. */
export async function createFamilyFormSection(formId) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, 'Profile Information', 0) RETURNING id",
    args: [formId],
  });
}

/** Insert one default profile field into the family's registration form. */
export async function createFamilyFormField(formId, sectionId, field) {
  return db.execute({
    sql: "INSERT INTO platform_form_fields (form_id, section_id, label, field_type, required, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    args: [
      formId,
      sectionId,
      field.label,
      field.field_type,
      field.required,
      field.sort_order,
    ],
  });
}

/** Create the family row; caller keeps the returned lastInsertRowid. */
export async function createFamily({
  name,
  registration_id,
  program_id,
  type,
  description,
  form_id,
  default_role,
}) {
  return db.execute({
    sql: "INSERT INTO families (name, registration_id, program_id, type, description, form_id, default_role) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [
      name,
      registration_id,
      program_id || null,
      type || "individual",
      description || null,
      form_id,
      default_role || null,
    ],
  });
}

// ── PUT /api/families ─────────────────────────────────────────────────────────

/** Partial update of a family — caller supplies "col = ?" pairs + id arg. */
export async function updateFamilyFields(updates, args) {
  return db.execute({
    sql: `UPDATE families SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

// ── PATCH /api/families ───────────────────────────────────────────────────────

/** Set a family's archived state (column may not exist — caller retries). */
export async function updateFamilyArchiveStatus(id, isArchived) {
  return db.execute({
    sql: "UPDATE families SET is_archived = ? WHERE id = ?",
    args: [isArchived ? 1 : 0, id],
  });
}

/** Schema backfill for the is_archived column (archive fallback path). */
export async function ensureFamilyArchiveColumn() {
  return db.execute(
    "ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0",
  );
}

// ── DELETE /api/families ──────────────────────────────────────────────────────

/** Delete a family row. */
export async function deleteFamily(id) {
  return db.execute({
    sql: "DELETE FROM families WHERE id = ?",
    args: [id],
  });
}
