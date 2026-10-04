import db from "@/lib/db";

/**
 * Facilitation model — facilitator invite flow (REPOSITORY layer).
 *
 * The invite-bulk statements: existing-contact detection, program/facilitator
 * conflict probes, contact + program-staff + contact-role writes, password-setup
 * token issuance and the CRM timeline entries. Split verbatim out of
 * `models/facilitation.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Contact row (cid/name/password) for an invite email — detects existing contacts + activation state. */
export async function findContactByEmailForInvite(email) {
  return db.execute({
    sql: "SELECT cid, name, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Existence probe: is the contact already a facilitator of this program? */
export async function isAlreadyFacilitatorInProgram(programId, contactCid) {
  return db.execute({
    sql: "SELECT 1 FROM v2_program_staff WHERE program_id::text = ? AND staff_id::text = ? AND role = 'facilitator' LIMIT 1",
    args: [String(programId), String(contactCid)],
  });
}

/** Existence probe: is the contact/email already a participant of this program? */
export async function findParticipantConflictForFacilitatorInvite(contactCid, programId, email) {
  return db.execute({
    sql: `SELECT 1 FROM participant_programs WHERE participant_id::text = ? AND program_id::text = ?
          UNION
          SELECT 1 FROM v2_participants WHERE program_id::text = ? AND (email = ? OR user_id = ?)
          LIMIT 1`,
    args: [String(contactCid), String(programId), String(programId), email, String(contactCid)],
  });
}

/** Program name + facilitator default permissions for the invite flow. */
export async function getProgramForFacilitatorInvite(programId) {
  return db.execute({
    sql: "SELECT name, facilitator_default_permissions FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Create the pending facilitator contact row. */
export async function createFacilitatorContact(contactCid, email) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status) VALUES (?, ?, ?, 'facilitator', 'pending')",
    args: [contactCid, "", email],
  });
}

/** Upsert the facilitator relationship on v2_program_staff with the program's default permissions. */
export async function upsertFacilitatorProgramStaff(programId, contactCid, defaultPerms) {
  return db.execute({
    sql: `INSERT INTO v2_program_staff (program_id, staff_id, role, permissions)
              VALUES (?, ?, 'facilitator', ?::jsonb)
              ON CONFLICT (program_id, staff_id)
              DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions, updated_at = NOW()`,
    args: [programId, contactCid, JSON.stringify(defaultPerms)],
  });
}

/** Fill-only link of a contact to the program (skips contacts already linked elsewhere). */
export async function fillContactProgramLink(programId, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET program_id = ? WHERE cid = ? AND (program_id IS NULL OR TRIM(program_id) = '')",
    args: [programId, contactCid],
  });
}

/** Contextual facilitator role on contact_roles (insert only if no current one exists). */
export async function addFacilitatorContactRole(contactCid, programId, defaultPerms, assignedBy) {
  return db.execute({
    sql: `INSERT INTO contact_roles
                  (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
                SELECT ?, 'facilitator', 'program', ?, true, 'facilitator', '{"type":"program"}'::jsonb, 'active', ?::jsonb, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM contact_roles cr
                  WHERE cr.contact_cid = ?
                    AND cr.role = 'facilitator'
                    AND cr.context_type = 'program'
                    AND cr.context_id = ?
                    AND cr.is_current = true
                )`,
    args: [contactCid, programId, JSON.stringify(defaultPerms), assignedBy, contactCid, programId],
  });
}

/** Expire any outstanding password-setup tokens for the contact before issuing a new one. */
export async function invalidatePasswordSetupTokens(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  });
}

/** Issue a staff-invite password-setup token (48h expiry). */
export async function createFacilitatorInviteToken(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
    args: [token, tokenHash, contactCid],
  });
}

/** CRM history entry recording the facilitator assignment. */
export async function addFacilitatorAssignedTimelineEvent(contactCid, programName, programId, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'facilitator_assigned', ?, 'programs', ?, ?, '{}'::jsonb)`,
    args: [contactCid, `Assigned as facilitator to ${programName}`, programId, actorId],
  });
}

/** CRM history entry recording the invitation email. */
export async function addFacilitatorInvitedTimelineEvent(contactCid, programName, programId, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'invitation_sent', ?, 'programs', ?, ?, '{}'::jsonb)`,
    args: [contactCid, `Invited to facilitate ${programName}`, programId, actorId],
  });
}
