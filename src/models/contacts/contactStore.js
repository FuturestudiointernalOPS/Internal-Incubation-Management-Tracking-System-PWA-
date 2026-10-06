import db from "@/lib/db";

/**
 * Contact core store — the identity reads and the single-row writes of the
 * contact domain (invite token, invite/create/update, soft-delete, roles).
 *
 * Split out of `src/models/contacts.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/contacts` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── POST /api/contacts (invite helper) ───────────────────────────────────────

/** Insert a one-time password-setup token for a contact invitation. */
export async function createPasswordSetupToken(token, tokenHash, cid) {
  return db.execute({
    sql: `INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at)
            VALUES (?, ?, ?, NOW() + INTERVAL '48 hours')`,
    args: [token, tokenHash, cid],
  });
}

/** Stamp the contact as invited (column may not exist yet — caller swallows). */
export async function markContactInvited(cid) {
  return db.execute({
    sql: "UPDATE contacts SET invited_at = NOW() WHERE cid = ?",
    args: [cid],
  });
}

// ── POST /api/contacts ───────────────────────────────────────────────────────

/** Insert a contact, or resurrect/refresh it when the email already exists. */
export async function upsertContact(contact) {
  return db.execute({
    sql: `INSERT INTO contacts (
                  cid, name, email, phone, address, dob, group_name,
                  role, password, program_id, program_name, image, status, deleted, gender, mother_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                  name = EXCLUDED.name,
                  phone = EXCLUDED.phone,
                  address = EXCLUDED.address,
                  status = EXCLUDED.status,
                  role = EXCLUDED.role,
                  group_name = EXCLUDED.group_name,
                  deleted = 0,
                  deleted_at = NULL,
                  deleted_by = NULL,
                  archived_at = NULL,
                  archived_by = NULL`,
    args: [
      contact.cid,
      contact.name,
      contact.email,
      contact.phone,
      contact.address,
      contact.dob,
      contact.group_name,
      contact.role,
      contact.password,
      contact.program_id,
      contact.program_name,
      contact.image,
      contact.status,
      contact.deleted,
      contact.gender,
      contact.mother_name,
    ],
  });
}

/** Notify the super admin about a pending access request (verification flow). */
export async function createAccessRequestNotification(name) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type) VALUES (?, ?, ?, ?)`,
    args: [
      "sa",
      "NEW ACCESS REQUEST",
      `${name} has applied to join the FUTURE STUDIO group. Verification required.`,
      "verification",
    ],
  });
}

/** Look for an existing live contact sharing the same phone number. */
export async function findContactCidByPhone(phone, excludeCid, excludeEmail) {
  return db.execute({
    sql: `SELECT cid FROM contacts WHERE phone = ? AND cid != ? AND email != ? AND deleted_at IS NULL LIMIT 1`,
    args: [phone, excludeCid, excludeEmail],
  });
}

// ── PUT /api/contacts ─────────────────────────────────────────────────────────

/**
 * Partial update of a contact — caller supplies "col = ?" pairs + cid arg.
 * This is a watched surface (src/__tests__/identity-role-writes.test.js):
 * contextual flows must never pass `role` through it.
 */
export async function updateContactFields(fieldsToUpdate, args) {
  return db.execute({
    sql: `UPDATE contacts SET ${fieldsToUpdate.join(", ")} WHERE cid = ?`,
    args: args,
  });
}

/** Load a contact's identity fields for the approval/invite flow. */
export async function getContactIdentityByCid(cid) {
  return db.execute({
    sql: "SELECT name, email, role FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Mark the admin's unread approval notification for this name as read. */
export async function markAdminNotificationsRead(name) {
  return db.execute({
    sql: `UPDATE v2_notifications
                      SET is_read = 1
                      WHERE recipient_id = 'sa'
                      AND message ILIKE ?
                      AND is_read = 0`,
    args: [`%${name}%`],
  });
}

// ── GET /api/contacts — single rows ──────────────────────────────────────────

/** Full contact row by primary key (scoped callers pass their own cid). */
export async function getContactByCid(cid) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Archived contacts (archived but not soft-deleted) — super admin view. */
export async function getArchivedContacts() {
  return db.execute(
    "SELECT * FROM contacts WHERE archived_at IS NOT NULL AND deleted_at IS NULL ORDER BY name ASC",
  );
}

// ── DELETE /api/contacts ──────────────────────────────────────────────────────

/** Soft-delete a contact and free its email with a unique placeholder. */
export async function softDeleteContact(deletedBy, cid) {
  return db.execute({
    sql: `UPDATE contacts
            SET deleted_at = NOW(), deleted_by = ?, deleted = 1,
                email = '__deleted_' || cid || '__' || email
            WHERE cid = ? AND deleted_at IS NULL`,
    args: [deletedBy, cid],
  });
}

// ── roles ─────────────────────────────────────────────────────────────────────

/** Contact roles (employment/role history) for a contact. */
export async function getContactRolesByCid(cid) {
  return db.execute({
    sql: "SELECT * FROM contact_roles WHERE contact_cid = ? ORDER BY is_current DESC, started_at DESC",
    args: [cid],
  });
}
