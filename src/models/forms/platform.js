import db from "@/lib/db";

// ── src/app/api/platform/forms/route.js ─────────────────────────────────────

/** Platform form row matched by its text id (GET /api/platform/forms?id=X). */
export async function getPlatformFormByTextId(id) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id::text = ?",
    args: [id],
  });
}

/** Sections of a platform form, ordered for the builder (GET by id). */
export async function getPlatformFormSections(id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_sections WHERE form_id::text = ? ORDER BY sort_order",
    args: [id],
  });
}

/** Fields of a platform form, ordered for the builder (GET by id). */
export async function getPlatformFormFields(id) {
  return db.execute({
    sql: "SELECT * FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order",
    args: [id],
  });
}

/** Newest published snapshot row of a form (empty-live-tables fallback). */
export async function getLatestPlatformFormVersion(formId) {
  return db.execute({
    sql: "SELECT snapshot, created_at FROM platform_form_versions WHERE form_id = ? ORDER BY version DESC LIMIT 1",
    args: [formId],
  });
}

/** Platform forms matching optional collection/status filters, newest first. */
export async function listPlatformForms(collectionId, status) {
  let sql = "SELECT * FROM platform_forms WHERE 1=1";
  const args = [];

  if (collectionId) {
    sql += " AND collection_id = ?";
    args.push(parseInt(collectionId));
  }
  if (status && status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  sql += " ORDER BY updated_at DESC";

  return db.execute({ sql, args });
}

/** Platform form row by numeric id (publish path existence check). */
export async function getPlatformFormById(formId) {
  return db.execute({
    sql: "SELECT * FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Insert a version snapshot row for a published form. */
export async function createPlatformFormVersion(formId, version, snapshot, publishedBy) {
  return db.execute({
    sql: "INSERT INTO platform_form_versions (form_id, version, snapshot, published_by) VALUES (?, ?, ?, ?)",
    args: [formId, version, snapshot, publishedBy],
  });
}

/** Bump a form's version and mark it published. */
export async function publishPlatformForm(formId, version) {
  return db.execute({
    sql: "UPDATE platform_forms SET version = ?, status = 'published', updated_at = NOW() WHERE id = ?",
    args: [version, formId],
  });
}

/** Create a new platform form, returning the full row. */
export async function createPlatformForm({
  name,
  description,
  collection_id,
  visibility,
  settings,
  tags,
  owner_id,
  owner_name,
  created_by,
}) {
  return db.execute({
    sql: `INSERT INTO platform_forms (name, description, collection_id, visibility, settings, tags, owner_id, owner_name, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
    args: [
      name.trim(),
      description || null,
      collection_id ? parseInt(collection_id) : null,
      visibility || "internal",
      JSON.stringify(settings || {}),
      tags || [],
      owner_id || null,
      owner_name,
      created_by || null,
    ],
  });
}

/** Update an existing builder section (by id + form id). */
export async function updatePlatformFormSection({ formId, section }) {
  return db.execute({
    sql: "UPDATE platform_form_sections SET title = ?, description = ?, sort_order = ?, settings = ? WHERE id = ? AND form_id = ?",
    args: [
      section.title,
      section.description || null,
      section.sort_order || 0,
      JSON.stringify(section.settings || {}),
      parseInt(section.id),
      parseInt(formId),
    ],
  });
}

/** Insert a new builder section for a form. */
export async function createPlatformFormSection({ formId, section }) {
  return db.execute({
    sql: "INSERT INTO platform_form_sections (form_id, title, description, sort_order) VALUES (?, ?, ?, ?)",
    args: [parseInt(formId), section.title, section.description || null, section.sort_order || 0],
  });
}

/** Delete a builder field (by id + form id). */
export async function deletePlatformFormField({ formId, fieldId }) {
  return db.execute({
    sql: "DELETE FROM platform_form_fields WHERE id = ? AND form_id = ?",
    args: [parseInt(fieldId), parseInt(formId)],
  });
}

/** Update an existing builder field. sectionId is the FK-resolved value. */
export async function updatePlatformFormField({ formId, field, sectionId }) {
  return db.execute({
    sql: `UPDATE platform_form_fields
                    SET label = ?, field_type = ?, placeholder = ?, help_text = ?, required = ?,
                        options = ?, validation = ?, conditional_logic = ?, sort_order = ?,
                        section_id = ?, settings = ?, updated_at = NOW()
                    WHERE id = ? AND form_id = ?`,
    args: [
      field.label, field.field_type || "text", field.placeholder || null, field.help_text || null,
      field.required ? 1 : 0,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      field.conditional_logic ? JSON.stringify(field.conditional_logic) : null,
      field.sort_order || 0,
      sectionId,
      JSON.stringify(field.settings || {}),
      parseInt(field.id), parseInt(formId),
    ],
  });
}

/** Insert a new builder field, returning the created row. */
export async function createPlatformFormField({ formId, field, sectionId }) {
  return db.execute({
    sql: `INSERT INTO platform_form_fields (form_id, section_id, field_type, label, placeholder, help_text, required, options, validation, conditional_logic, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *`,
    args: [
      parseInt(formId),
      sectionId,
      field.field_type || "text",
      field.label,
      field.placeholder || null,
      field.help_text || null,
      field.required ? 1 : 0,
      field.options ? JSON.stringify(field.options) : null,
      field.validation ? JSON.stringify(field.validation) : null,
      field.conditional_logic ? JSON.stringify(field.conditional_logic) : null,
      field.sort_order || 0,
    ],
  });
}

/** Delete a builder section (by id + form id), after its fields moved away. */
export async function deletePlatformFormSection({ formId, sectionId }) {
  return db.execute({
    sql: "DELETE FROM platform_form_sections WHERE id = ? AND form_id = ?",
    args: [sectionId, parseInt(formId)],
  });
}

/** Touch a form's updated_at timestamp after a builder save. */
export async function touchPlatformForm(formId) {
  return db.execute({
    sql: "UPDATE platform_forms SET updated_at = NOW() WHERE id = ?",
    args: [parseInt(formId)],
  });
}

/** Metadata-only update of a form (only keys present in the payload). */
export async function updatePlatformFormMetadata({
  id,
  name,
  description,
  collection_id,
  visibility,
  tags,
  status,
  settings,
}) {
  const fields = [];
  const args = [];
  const updatable = { name, description, collection_id, visibility, tags, status };

  for (const [key, value] of Object.entries(updatable)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      args.push(key === "collection_id" && value ? parseInt(value) : value);
    }
  }
  if (settings !== undefined) {
    fields.push("settings = ?");
    args.push(JSON.stringify(settings));
  }
  fields.push("updated_at = NOW()");
  args.push(parseInt(id));

  return db.execute({
    sql: `UPDATE platform_forms SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Hard-delete: email logs attached to a form's run submissions. */
export async function deletePlatformEmailLogsForForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_email_log WHERE submission_id IN (SELECT s.id FROM platform_form_submissions s JOIN platform_form_runs r ON s.run_id = r.id WHERE r.form_id = ?)",
    args: [formId],
  });
}

/** Hard-delete: review rows attached to a form's run submissions. */
export async function deletePlatformSubmissionReviewsForForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_submission_reviews WHERE submission_id IN (SELECT s.id FROM platform_form_submissions s JOIN platform_form_runs r ON s.run_id = r.id WHERE r.form_id = ?)",
    args: [formId],
  });
}

/** Hard-delete: evaluation rows attached to a form's run submissions. */
export async function deletePlatformSubmissionEvaluationsForForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_submission_evaluations WHERE submission_id IN (SELECT s.id FROM platform_form_submissions s JOIN platform_form_runs r ON s.run_id = r.id WHERE r.form_id = ?)",
    args: [formId],
  });
}

/** Permanent delete of the form row itself. */
export async function deletePlatformForm(formId) {
  return db.execute({
    sql: "DELETE FROM platform_forms WHERE id = ?",
    args: [formId],
  });
}

/** Soft delete: archive the form. */
export async function archivePlatformForm(formId) {
  return db.execute({
    sql: "UPDATE platform_forms SET status = 'archived', updated_at = NOW() WHERE id = ?",
    args: [formId],
  });
}

// ── src/app/api/platform/collections/route.js ───────────────────────────────

/** Single collection row by numeric id (GET /api/platform/collections?id=X). */
export async function getPlatformCollectionById(id) {
  return db.execute({
    sql: "SELECT * FROM platform_collections WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Collections matching optional parent/status/owner/search filters, by name. */
export async function listPlatformCollections({ parentId, status, ownerId, search }) {
  let sql = "SELECT * FROM platform_collections WHERE 1=1";
  const args = [];

  if (parentId) {
    sql += " AND parent_id = ?";
    args.push(parseInt(parentId));
  }
  if (status && status !== "all") {
    sql += " AND status = ?";
    args.push(status);
  }
  if (ownerId) {
    sql += " AND owner_id = ?";
    args.push(ownerId);
  }
  if (search) {
    sql += " AND (name ILIKE ? OR description ILIKE ?)";
    args.push(`%${search}%`, `%${search}%`);
  }
  sql += " ORDER BY name ASC";

  return db.execute({ sql, args });
}

/** Parent lookup (id, parent_id) used to validate parent existence. */
export async function getPlatformCollectionParentById(parentId) {
  return db.execute({
    sql: "SELECT id, parent_id FROM platform_collections WHERE id = ?",
    args: [parseInt(parentId)],
  });
}

/** Create a collection, returning the full row. */
export async function createPlatformCollection({
  name,
  slug,
  description,
  parent_id,
  owner_id,
  owner_name,
  visibility,
  tags,
  category,
  color,
  created_by,
}) {
  return db.execute({
    sql: `INSERT INTO platform_collections
            (name, slug, description, parent_id, owner_id, owner_name, visibility, tags, category, color, created_by, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            RETURNING *`,
    args: [
      name.trim(),
      slug,
      description || null,
      parent_id ? parseInt(parent_id) : null,
      owner_id || null,
      owner_name || null,
      visibility || "internal",
      tags || [],
      category || null,
      color || "#FF6600",
      created_by || null,
    ],
  });
}

/** Full collection row by numeric id (update-path existence check). */
export async function getPlatformCollectionForUpdate(id) {
  return db.execute({
    sql: "SELECT * FROM platform_collections WHERE id = ?",
    args: [parseInt(id)],
  });
}

/** Metadata update of a collection (only keys present in the payload). */
export async function updatePlatformCollection({
  id,
  name,
  description,
  parent_id,
  owner_id,
  owner_name,
  visibility,
  tags,
  category,
  status,
  color,
}) {
  const fields = [];
  const args = [];
  const updatable = { name, description, parent_id, owner_id, owner_name, visibility, tags, category, status, color };

  for (const [key, value] of Object.entries(updatable)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      if (key === "parent_id") {
        args.push(value ? parseInt(value) : null);
      } else {
        args.push(value);
      }
    }
  }
  fields.push("updated_at = NOW()");
  args.push(parseInt(id));

  return db.execute({
    sql: `UPDATE platform_collections SET ${fields.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Soft delete: archive a collection, returning the updated row. */
export async function archivePlatformCollection(id) {
  return db.execute({
    sql: "UPDATE platform_collections SET status = 'archived', updated_at = NOW() WHERE id = ? RETURNING *",
    args: [parseInt(id)],
  });
}

/** Insert a collection audit log entry. */
export async function createPlatformCollectionAuditLog({
  collection_id,
  action,
  actor_id,
  actor_name,
  details,
}) {
  return db.execute({
    sql: `INSERT INTO platform_collection_audit (collection_id, action, actor_id, actor_name, details)
          VALUES (?, ?, ?, ?, ?)`,
    args: [collection_id, action, actor_id || null, actor_name || null, JSON.stringify(details)],
  });
}

// ── src/app/api/platform/notifications/route.js ─────────────────────────────

/** Unread (or all) platform notifications for a user, newest first. */
export async function listPlatformNotifications(cid, all) {
  const sql = all
    ? "SELECT * FROM platform_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    : "SELECT * FROM platform_notifications WHERE user_id = ? AND read = false ORDER BY created_at DESC LIMIT 20";

  return db.execute({ sql, args: [cid] });
}

/** Mark all of a user's unread notifications as read. */
export async function markAllPlatformNotificationsRead(cid) {
  return db.execute({
    sql: "UPDATE platform_notifications SET read = true WHERE user_id = ? AND read = false",
    args: [cid],
  });
}

/** Mark a single notification as read, scoped to its owner. */
export async function markPlatformNotificationRead(id, cid) {
  return db.execute({
    sql: "UPDATE platform_notifications SET read = true WHERE id = ? AND user_id = ?",
    args: [parseInt(id), cid],
  });
}
