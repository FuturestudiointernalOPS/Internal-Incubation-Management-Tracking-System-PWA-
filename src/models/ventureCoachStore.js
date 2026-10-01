/**
 * Venture coach identity & invitation — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/coach`: the contact lookups (by
 * id, by lowercased email, by exact email), the coach catalog email, the
 * assignment probe/upsert, the invite token writes and the CRM timeline row.
 * The resolution and invitation decisions live in the service.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventureCoach.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Contact / catalog lookups ────────────────────────────────────────────────

/** One live contact by id (id, name, email). */
export function selectCoachContactById(cid) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE cid = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1",
    args: [String(cid)],
  });
}

/** A catalog coach's email. */
export function selectCatalogCoachEmail(coachId) {
  return db.execute({ sql: "SELECT email FROM venture_coaches WHERE id = ?", args: [coachId] });
}

/** One live contact by case-insensitive email (id, name, email). */
export function selectCoachContactByLowerEmail(email) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE LOWER(email) = LOWER(?) AND (deleted = 0 OR deleted IS NULL) LIMIT 1",
    args: [email],
  });
}

/** The contact a coach invite would resolve to (id, name, email, password). */
export function selectInvitableContactByEmail(cleanEmail) {
  return db.execute({
    sql: "SELECT cid, name, email, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [cleanEmail],
  });
}

// ── Assignment ───────────────────────────────────────────────────────────────

/** Whether the contact already has an active assignment on the Venture. */
export function selectActiveAssignmentProbe(code, cid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' LIMIT 1",
    args: [code, cid],
  });
}

/** The contact's active assignment id on the Venture. */
export function selectActiveAssignmentId(code, cid) {
  return db.execute({
    sql: "SELECT id FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' LIMIT 1",
    args: [code, cid],
  });
}

/** Create the invited coach's contact row (narrow 'facilitator' role). */
export function insertCoachContact(cid, name, email) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status) VALUES (?, ?, ?, 'facilitator', 'pending')",
    args: [cid, name, email],
  });
}

/** Re-scope an existing assignment for the invited coach. */
export function updateCoachAssignment(assignmentId, responsibilityCode, scopeType, actorCid, notes) {
  return db.execute({
    sql: `UPDATE venture_staff_assignments
            SET responsibility_code = ?, scope_type = ?, assigned_by = ?, notes = COALESCE(notes, ?)
            WHERE id = ?`,
    args: [responsibilityCode, scopeType, actorCid, notes, assignmentId],
  });
}

/** Create the coach's Venture assignment. */
export function insertCoachAssignment(code, cid, responsibilityCode, scopeType, actorCid, notes) {
  return db.execute({
    sql: `INSERT INTO venture_staff_assignments (venture_id, staff_contact_id, responsibility_code, scope_type, assigned_by, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
    args: [code, cid, responsibilityCode, scopeType, actorCid, notes],
  });
}

// ── Invite token ─────────────────────────────────────────────────────────────

/** Consume any pending setup token for the contact (never duplicate one). */
export function invalidatePasswordSetupTokens(cid) {
  return db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [cid] });
}

/** File a fresh 48-hour setup token. */
export function insertPasswordSetupToken(token, tokenHash, cid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
    args: [token, tokenHash, cid],
  });
}

// ── CRM history ──────────────────────────────────────────────────────────────

/** Record the coach assignment on the contact timeline. */
export function insertCoachTimeline(cid, description, code, actorCid) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
            VALUES (?, 'coach_assigned', ?, 'ventures', ?, ?, '{}'::jsonb)`,
    args: [cid, description, code, actorCid],
  });
}
