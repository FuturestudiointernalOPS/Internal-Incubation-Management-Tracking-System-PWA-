import db from "@/lib/db";

/**
 * Contacts model — data access for the people/contacts/families controllers
 * (Wave 3 of docs/MVC_REFACTOR.md). Extracted from:
 *   - src/app/api/contacts/route.js
 *   - src/app/api/contacts/full-state/route.js
 *   - src/app/api/contacts/search/route.js
 *   - src/app/api/contacts/duplicates/route.js
 *   - src/app/api/contacts/merge/route.js
 *   - src/app/api/contacts/[cid]/timeline/route.js
 *   - src/app/api/me/relationships/route.js
 *   - src/app/api/families/route.js
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
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
export async function upsertContact(vc) {
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
      vc.cid,
      vc.name,
      vc.email,
      vc.phone,
      vc.address,
      vc.dob,
      vc.group_name,
      vc.role,
      vc.password,
      vc.program_id,
      vc.program_name,
      vc.image,
      vc.status,
      vc.deleted,
      vc.gender,
      vc.mother_name,
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

/** Enroll a contact in a program (idempotent) — registration flow. */
export async function assignContactToProgram(cid, pid) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                    VALUES (?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [cid, pid],
  });
}

/** Write the participant_programs audit row for an initial assignment. */
export async function createParticipantProgramAudit(cid, pid, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                    VALUES (?, ?, 'assigned', ?)`,
    args: [cid, pid, performedBy],
  });
}

/** Look for an existing live contact sharing the same phone number. */
export async function findContactCidByPhone(phone, excludeCid, excludeEmail) {
  return db.execute({
    sql: `SELECT cid FROM contacts WHERE phone = ? AND cid != ? AND email != ? AND deleted_at IS NULL LIMIT 1`,
    args: [phone, excludeCid, excludeEmail],
  });
}

/** Flag a phone-based duplicate pair (idempotent regardless of pair order). */
export async function createDuplicatePhoneFlag(cidA, cidB) {
  return db.execute({
    sql: `INSERT INTO contact_duplicate_flags (contact_cid_a, contact_cid_b, match_reason, confidence)
                      VALUES (?, ?, 'same_phone', 0.85)
                      ON CONFLICT ((LEAST(contact_cid_a, contact_cid_b)), (GREATEST(contact_cid_a, contact_cid_b))) DO NOTHING`,
    args: [cidA, cidB],
  });
}

// ── PUT /api/contacts ─────────────────────────────────────────────────────────

/** Partial update of a contact — caller supplies "col = ?" pairs + cid arg. */
export async function updateContactFields(fieldsToUpdate, args) {
  return db.execute({
    sql: `UPDATE contacts SET ${fieldsToUpdate.join(", ")} WHERE cid = ?`,
    args: args,
  });
}

/** Remove every participant_programs row for a contact (role promotion). */
export async function deleteContactPrograms(cid) {
  return db.execute({
    sql: "DELETE FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/** Verify a program exists before assigning a contact to it. */
export async function getProgramById(id) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [id],
  });
}

/** Remove program memberships not present in the new program list. */
export async function removeContactProgramsExcept(cid, programIds) {
  const placeholders = programIds.map(() => "?").join(",");
  return db.execute({
    sql: `DELETE FROM participant_programs WHERE participant_id = ? AND program_id NOT IN (${placeholders})`,
    args: [cid, ...programIds],
  });
}

/** Remove every participant_programs row for a contact (explicit empty list). */
export async function clearContactPrograms(cid) {
  return db.execute({
    sql: "DELETE FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/** Enroll a contact in a program (idempotent) — PUT program_ids sync flow. */
export async function addContactProgramMembership(cid, pid) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                  VALUES (?, ?)
                  ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [cid, pid],
  });
}

/** Write the participant_programs audit row for a synced assignment. */
export async function recordParticipantProgramAudit(cid, pid, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                  VALUES (?, ?, 'assigned', ?)`,
    args: [cid, pid, performedBy],
  });
}

/** Enroll a contact in a single program (idempotent) — PUT single fallback. */
export async function ensureContactProgramMembership(cid, pid) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                VALUES (?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [cid, pid],
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

// ── GET /api/contacts ─────────────────────────────────────────────────────────

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

/** Directory for super admins: optional role/status/group filters. */
export async function getContactsForSuperAdmin(roleFilter, statusFilter, groupFilter) {
  let sql = "SELECT * FROM contacts WHERE archived_at IS NULL AND deleted_at IS NULL";
  const args = [];
  if (roleFilter) {
    const roles = roleFilter.split(",");
    sql += " AND (" + roles.map(() => "role = ?").join(" OR ") + ")";
    args.push(...roles);
  }
  if (statusFilter && statusFilter !== "all") {
    sql += " AND status = ?";
    args.push(statusFilter);
  }
  if (groupFilter) {
    sql += " AND UPPER(TRIM(group_name)) = UPPER(TRIM(?))";
    args.push(groupFilter);
  }
  sql += " ORDER BY name ASC";
  return db.execute({ sql, args });
}

/** Directory for staff/teachers (active only; PMs also see pending). */
export async function getContactsForStaff(role, groupFilter) {
  const statusClause =
    role === "program_manager" ? "status IN ('active', 'pending')" : "status = 'active'";
  let sql =
    `SELECT * FROM contacts WHERE archived_at IS NULL AND deleted_at IS NULL AND ${statusClause}`;
  const args = [];
  if (groupFilter) {
    sql += " AND UPPER(TRIM(group_name)) = UPPER(TRIM(?))";
    args.push(groupFilter);
  }
  sql += " ORDER BY name ASC";
  return db.execute({ sql, args });
}

/** Distinct program-enrolled participant cids from a cid pool. */
export async function getParticipantProgramCids(cids) {
  const ph = cids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT DISTINCT participant_id FROM participant_programs WHERE participant_id IN (${ph})`,
    args: cids,
  });
}

/** Distinct cids holding a current role assignment, from a cid pool. */
export async function getContactRoleAssignmentCids(cids) {
  const ph = cids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT DISTINCT contact_cid FROM contact_roles WHERE contact_cid IN (${ph}) AND is_current = true`,
    args: cids,
  });
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

// ── GET /api/contacts/full-state ──────────────────────────────────────────────

/** Programs assigned to a program manager (id + name). */
export async function getPmAssignedPrograms(pmId) {
  return db.execute({
    sql: "SELECT id, name FROM v2_programs WHERE assigned_pm_id = ?",
    args: [pmId],
  });
}

/** Contacts belonging to the PM's programs and/or groups. */
export async function getContactsScopedByProgramsAndGroups(
  programIds,
  programNames,
  statusFilter,
) {
  const idPlaceholders = programIds.map(() => "?").join(",") || "NULL";
  const namePlaceholders = programNames.map(() => "?").join(",") || "NULL";

  const archiveClause =
    statusFilter === "archived" ? "AND archived_at IS NOT NULL" : "AND archived_at IS NULL";

  return db.execute({
    sql: `SELECT * FROM contacts
                WHERE (cid IN (
                        SELECT participant_id FROM participant_programs
                        WHERE CAST(program_id AS TEXT) IN (${idPlaceholders})
                      )
                OR UPPER(TRIM(group_name)) IN (${namePlaceholders}))
                AND deleted_at IS NULL
                ${archiveClause}
                ORDER BY created_at DESC`,
    args: [...programIds, ...programNames],
  });
}

/** Authoritative program participants via participant_programs joins. */
export async function getEnrolledProgramParticipants(programIds) {
  const idPlaceholders = programIds.map(() => "?").join(",") || "NULL";
  return db.execute({
    sql: `SELECT c.*
                  FROM participant_programs pp
                  JOIN contacts c ON pp.participant_id = c.cid
                  WHERE CAST(pp.program_id AS TEXT) IN (${idPlaceholders})
                    AND c.deleted = 0
                    AND c.deleted_at IS NULL`,
    args: [...programIds],
  });
}

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

/** Teams belonging to the PM's programs. */
export async function getTeamsScopedByPrograms(programIds) {
  const idPlaceholders = programIds.map(() => "?").join(",") || "NULL";
  return db.execute({
    sql: `SELECT id, name, group_name, program_id FROM v2_teams
                WHERE program_id IN (${idPlaceholders})`,
    args: [...programIds],
  });
}

/** Global registry feed — all non-deleted contacts (optionally archived). */
export async function getRegistryContacts(statusFilter) {
  const archiveClause =
    statusFilter === "archived" ? "AND archived_at IS NOT NULL" : "AND archived_at IS NULL";
  return db.execute(
    `SELECT * FROM contacts WHERE deleted_at IS NULL ${archiveClause} ORDER BY created_at DESC`,
  );
}

/** All families, name-ordered (registry feed list). */
export async function getFamiliesList() {
  return db.execute("SELECT * FROM families ORDER BY name ASC");
}

/** Team identity rows for the registry feed. */
export async function getRegistryTeams() {
  return db.execute("SELECT id, name, group_name FROM v2_teams");
}

/** Activation email log rows for a set of contact cids. */
export async function getActivationEmailLogForContacts(cids) {
  const placeholders = cids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT el.contact_cid, el.status, el.sent_at, el.created_at, el.error
                FROM platform_email_log el
                WHERE el.email_type = 'activation' AND el.contact_cid IN (${placeholders})
                ORDER BY el.id ASC`,
    args: cids,
  });
}

// ── GET /api/contacts/search ──────────────────────────────────────────────────

/** True if the contact holds a participant_programs row in the program. */
export async function isParticipantInProgram(cid, programId) {
  return db.execute({
    sql: `SELECT 1 FROM participant_programs
                WHERE participant_id = ? AND CAST(program_id AS TEXT) = ?
                LIMIT 1`,
    args: [cid, programId],
  });
}

/** True if the contact is a venture founder whose venture is in the program. */
export async function isVentureFounderInProgram(cid, programId) {
  return db.execute({
    sql: `SELECT 1 FROM venture_members vm
                JOIN ventures v ON v.venture_id = vm.venture_id
                WHERE (vm.user_cid = ? OR vm.contact_id = ?)
                  AND CAST(v.program_id AS TEXT) = ?
                LIMIT 1`,
    args: [cid, cid, programId],
  });
}

/** Program-scoped name/email search for external (participant/founder) users. */
export async function searchContactsInProgram(like, programId) {
  return db.execute({
    sql: `SELECT cid, name, email FROM contacts
              WHERE (name ILIKE ? OR email ILIKE ?)
                AND (
                  cid IN (
                    SELECT participant_id FROM participant_programs
                    WHERE CAST(program_id AS TEXT) = ?
                  )
                  OR cid IN (
                    SELECT staff_id FROM v2_program_staff
                    WHERE CAST(program_id AS TEXT) = ?
                  )
                  OR cid IN (
                    SELECT assigned_pm_id FROM v2_programs
                    WHERE id::text = ? AND assigned_pm_id IS NOT NULL
                  )
                )
              ORDER BY name ASC LIMIT 20`,
    args: [like, like, programId, programId, programId],
  });
}

/** General directory name/email search for internal CRM roles. */
export async function searchContactsByNameOrEmail(like) {
  return db.execute({
    sql: `SELECT cid, name, email FROM contacts
            WHERE (name ILIKE ? OR email ILIKE ?)
            ORDER BY name ASC LIMIT 20`,
    args: [like, like],
  });
}

// ── GET /api/contacts/duplicates ──────────────────────────────────────────────

/** Pending duplicate flags joined with both contact identities. */
export async function getPendingDuplicateFlags(limit) {
  return db.execute({
    sql: `SELECT df.*,
              ca.name AS contact_a_name, ca.email AS contact_a_email,
              cb.name AS contact_b_name, cb.email AS contact_b_email
            FROM contact_duplicate_flags df
            LEFT JOIN contacts ca ON ca.cid = df.contact_cid_a
            LEFT JOIN contacts cb ON cb.cid = df.contact_cid_b
            WHERE df.status = 'pending'
              AND (ca.deleted IS NULL OR ca.deleted = 0)
              AND (cb.deleted IS NULL OR cb.deleted = 0)
            ORDER BY df.created_at DESC
            LIMIT ?`,
    args: [limit],
  });
}

/** Dismiss a pending duplicate flag (never touches merged flags). */
export async function dismissDuplicateFlag(id, reviewedBy) {
  return db.execute({
    sql: `UPDATE contact_duplicate_flags
            SET status = 'dismissed', reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ? AND status = 'pending'`,
    args: [reviewedBy, id],
  });
}

// ── POST /api/contacts/merge ──────────────────────────────────────────────────

/** Reassign all participant_programs rows to the surviving contact. */
export async function reassignContactPrograms(survivorCid, duplicateCid) {
  return db.execute({
    sql: "UPDATE participant_programs SET participant_id = ? WHERE participant_id = ?",
    args: [survivorCid, duplicateCid],
  });
}

/** Reassign all venture_members rows to the surviving contact. */
export async function reassignContactVentures(survivorCid, duplicateCid) {
  return db.execute({
    sql: "UPDATE venture_members SET contact_id = ? WHERE contact_id = ?",
    args: [survivorCid, duplicateCid],
  });
}

/** Reassign all timeline events to the surviving contact. */
export async function reassignContactTimelineEvents(survivorCid, duplicateCid) {
  return db.execute({
    sql: "UPDATE contact_timeline SET contact_cid = ? WHERE contact_cid = ?",
    args: [survivorCid, duplicateCid],
  });
}

/** Write the contact_merged event into the survivor's timeline. */
export async function createContactMergeTimelineEvent(
  survivorCid,
  duplicateCid,
  actorId,
  counts,
) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
            VALUES (?, 'contact_merged', ?, 'crm', ?, ?::jsonb)`,
    args: [
      survivorCid,
      `Merged from ${duplicateCid}`,
      actorId,
      JSON.stringify({ merged_from: duplicateCid, counts }),
    ],
  });
}

/** Soft-delete the duplicate contact and free its email (merge flow). */
export async function softDeleteDuplicateContact(deletedBy, cid) {
  return db.execute({
    sql: `UPDATE contacts
            SET deleted_at = NOW(), deleted_by = ?, deleted = 1,
                email = '__deleted_' || cid || '__' || email
            WHERE cid = ?`,
    args: [deletedBy, cid],
  });
}

/** Mark duplicate flags resolved as merged for both pair orderings. */
export async function resolveDuplicateFlagsForMerge(
  survivorCid,
  duplicateCid,
  reviewedBy,
) {
  return db.execute({
    sql: `UPDATE contact_duplicate_flags SET status = 'merged', reviewed_by = ?, reviewed_at = NOW()
            WHERE (contact_cid_a = ? AND contact_cid_b = ?) OR (contact_cid_a = ? AND contact_cid_b = ?)`,
    args: [reviewedBy, survivorCid, duplicateCid, duplicateCid, survivorCid],
  });
}

// ── GET /api/contacts/[cid]/timeline ──────────────────────────────────────────

/** Program ids managed by a program manager (timeline scoping). */
export async function getProgramIdsForPm(cid) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ?",
    args: [cid],
  });
}

/**
 * Timeline events for a contact. Program managers additionally see their own
 * programs' events; pmProgramIds is undefined for every other role.
 */
export async function getContactTimelineEvents(
  cid,
  moduleFilter,
  typeFilter,
  pmProgramIds,
  limit,
  offset,
) {
  let sql = "SELECT * FROM contact_timeline WHERE contact_cid = ?";
  const args = [cid];

  if (moduleFilter) {
    sql += " AND context_module = ?";
    args.push(moduleFilter);
  }
  if (typeFilter) {
    sql += " AND event_type = ?";
    args.push(typeFilter);
  }

  if (pmProgramIds) {
    if (pmProgramIds.length > 0) {
      const ph = pmProgramIds.map(() => "?").join(",");
      sql += ` AND (context_module != 'programs' OR context_id IN (${ph}))`;
      args.push(...pmProgramIds);
    } else {
      sql += " AND context_module != 'programs'";
    }
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);

  return db.execute({ sql, args });
}

/** Minimal contact identity row for the timeline header. */
export async function getTimelineContactIdentity(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Append an event to a contact's timeline. */
export async function createContactTimelineEvent(
  cid,
  eventType,
  description,
  actorCid,
  metadata,
) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
            VALUES (?, ?, ?, 'crm', ?, ?::jsonb) RETURNING id, created_at`,
    args: [cid, eventType, description, actorCid, JSON.stringify(metadata || {})],
  });
}

// ── GET /api/me/relationships ─────────────────────────────────────────────────

/** True if the contact has any participant_programs membership row. */
export async function hasParticipantProgramMembership(cid) {
  return db.execute({
    sql: "SELECT 1 FROM participant_programs WHERE participant_id = ? LIMIT 1",
    args: [cid],
  });
}

/** True if the contact has a v2_participants record (user_id or email). */
export async function hasV2ParticipantRecord(cid) {
  return db.execute({
    sql: "SELECT 1 FROM v2_participants WHERE user_id = ? OR LOWER(email) = LOWER((SELECT email FROM contacts WHERE cid = ?)) LIMIT 1",
    args: [cid, cid],
  });
}

/** Active venture memberships for a contact, newest join first. */
export async function getVentureMembershipsForContact(cid) {
  return db.execute({
    sql: `SELECT v.venture_id, COALESCE(v.company_name, v.name) AS name, v.status
              FROM venture_members vm
              LEFT JOIN ventures v ON v.venture_id = vm.venture_id
              WHERE vm.contact_id = ? AND vm.removed_at IS NULL
              ORDER BY vm.joined_at DESC`,
    args: [cid],
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

/** Contact roles (employment/role history) for a contact. */
export async function getContactRolesByCid(cid) {
  return db.execute({
    sql: "SELECT * FROM contact_roles WHERE contact_cid = ? ORDER BY is_current DESC, started_at DESC",
    args: [cid],
  });
}

/** Merge preview — count of participant_programs rows that would move. */
export async function countMergeParticipantPrograms(cid) {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS c FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/** Merge preview — count of active venture_memberships that would move. */
export async function countMergeVentureMemberships(cid) {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS c FROM venture_members WHERE contact_id = ? AND removed_at IS NULL",
    args: [cid],
  });
}

/** Merge preview — count of timeline events that would move. */
export async function countMergeTimelineEvents(cid) {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS c FROM contact_timeline WHERE contact_cid = ?",
    args: [cid],
  });
}
