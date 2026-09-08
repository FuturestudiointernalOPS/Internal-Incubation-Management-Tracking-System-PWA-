import db from "@/lib/db";

/**
 * Auth flows model — data access for the `/api/auth/*` controllers
 * (`session-login`, `login`, `impersonate`, `invite`, `activate`,
 * `invite-family`, `quick-login`, `forgot-password`, `setup-password`,
 * `reset-password`, `resend-invite`, `language`).
 *
 * Each function wraps exactly one SQL statement that used to live inline in the
 * controller. SQL is byte-identical to the original queries, so behavior is
 * unchanged. Statements several controllers run with identical SQL are
 * mirrored 1:1 here — one exported function per former call site.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *  - Session mechanics (`createSession`/`getSession` from `@/lib/auth`),
 *    bcrypt hashing, emails and audit logging stay in the controllers.
 */

/** Contact lookup by email OR cid (session-login identity search). */
export async function getContactByEmailOrCid(identifier) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE (email = ? OR cid = ?) AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [identifier, identifier],
  });
}

/** Team login lookup by team username (session-login fallback). */
export async function getTeamByUsernameForSessionLogin(teamUsername) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
    args: [teamUsername],
  });
}

/** Family/entity login lookup by shared email (session-login fallback). */
export async function getFamilyBySharedEmailForSessionLogin(sharedEmail) {
  return db.execute({
    sql: "SELECT * FROM families WHERE shared_email = ? LIMIT 1",
    args: [sharedEmail],
  });
}

/** Existence probe — participant_programs row for a contact (session-login). */
export async function getParticipantProgramRecordForSessionLogin(participantId) {
  return db.execute({
    sql: "SELECT 1 FROM participant_programs WHERE participant_id = ?",
    args: [participantId],
  });
}

/** Existence probe — LMS enrollment for a contact (session-login). */
export async function getLmsEnrollmentRecordForSessionLogin(userCid) {
  return db.execute({
    sql: "SELECT 1 FROM lms_enrollments WHERE user_cid = ? LIMIT 1",
    args: [userCid],
  });
}

/** Existence probe — venture membership for a contact (session-login). */
export async function getVentureMembershipRecordForSessionLogin(userCid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE user_cid = ? LIMIT 1",
    args: [userCid],
  });
}

/** Self-heal — ensure the contacts.last_login_at column exists. */
export async function ensureContactsLastLoginColumn() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
  );
}

/** Self-heal — ensure the contacts.login_count column exists. */
export async function ensureContactsLoginCountColumn() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0",
  );
}

/** Record a successful contact login (last_login_at + login_count bump). */
export async function recordContactLoginActivity(cid) {
  return db.execute({
    sql: "UPDATE contacts SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE cid = ?",
    args: [cid],
  });
}

/** Contact lookup by email OR id (legacy login identity search). */
export async function getContactByEmailOrId(identifier) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE (email = ? OR id = ?) AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [identifier, identifier],
  });
}

/** Team login lookup by team username (legacy login fallback). */
export async function getTeamByUsernameForLogin(teamUsername) {
  return db.execute({
    sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
    args: [teamUsername],
  });
}

/** Family/entity login lookup by shared email (legacy login fallback). */
export async function getFamilyBySharedEmailForLogin(sharedEmail) {
  return db.execute({
    sql: "SELECT * FROM families WHERE shared_email = ? LIMIT 1",
    args: [sharedEmail],
  });
}

/** Existence probe — participant_programs row for a contact (legacy login). */
export async function getParticipantProgramRecordForLogin(participantId) {
  return db.execute({
    sql: "SELECT 1 FROM participant_programs WHERE participant_id = ?",
    args: [participantId],
  });
}

/** Existence probe — LMS enrollment for a contact (legacy login). */
export async function getLmsEnrollmentRecordForLogin(userCid) {
  return db.execute({
    sql: "SELECT 1 FROM lms_enrollments WHERE user_cid = ? LIMIT 1",
    args: [userCid],
  });
}

/** Existence probe — venture membership for a contact (legacy login). */
export async function getVentureMembershipRecordForLogin(userCid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE user_cid = ? LIMIT 1",
    args: [userCid],
  });
}

/** Self-heal — ensure the contacts.activated_at column exists. */
export async function ensureContactsActivatedAtColumn() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ",
  );
}

/** Self-heal — ensure the contacts.last_login_at column exists (legacy login). */
export async function ensureContactsLastLoginColumnForLogin() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
  );
}

/** Self-heal — ensure the contacts.login_count column exists (legacy login). */
export async function ensureContactsLoginCountColumnForLogin() {
  return db.execute(
    "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0",
  );
}

/** Record a successful contact login (legacy login activity tracking). */
export async function recordContactLoginActivityForLogin(cid) {
  return db.execute({
    sql: "UPDATE contacts SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE cid = ?",
    args: [cid],
  });
}

/** Impersonation target by exact cid. */
export async function getImpersonationTargetByCid(cid) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE cid = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [cid],
  });
}

/** Impersonation target by email. */
export async function getImpersonationTargetByEmail(email) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Impersonation target lookup treating the cid as an email. */
export async function getImpersonationTargetUsingCidAsEmail(cid) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [cid],
  });
}

/** Venture id tied to a contact (founder impersonation redirect). */
export async function getVentureIdForContact(contactId) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE contact_id = ? LIMIT 1",
    args: [contactId],
  });
}

/** All active/approved contacts for the impersonation picker (GET). */
export async function listActiveContactsForImpersonation() {
  return db.execute({
    sql: "SELECT cid, name, email, role, group_name, status FROM contacts WHERE deleted = 0 AND deleted_at IS NULL AND status IN ('active','approved') ORDER BY role, name",
    args: [],
  });
}

/** Contact brief lookup by email (invite resend flow). */
export async function getContactBriefByEmailForResend(email) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Expire all setup tokens for a contact (invite resend flow). */
export async function expirePasswordSetupTokensForResend(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  });
}

/** Issue a fresh staff-invite setup token (invite resend flow). */
export async function createStaffInviteSetupTokenForResend(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
    args: [token, tokenHash, contactCid],
  });
}

/** Contact timeline entry — invitation resent (invite resend flow). */
export async function logInvitationResent(contactCid, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
                VALUES (?, 'invitation_resent', 'Invitation resent', 'contacts', ?, '{}'::jsonb)`,
    args: [contactCid, actorId],
  });
}

/** Contact lookup with password by email (invite reuse detection). */
export async function getContactWithPasswordByEmail(email) {
  return db.execute({
    sql: "SELECT cid, name, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Update an existing invited contact's name + group (only when a name is given). */
export async function updateContactNameAndGroup(name, groupName, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET name = ?, group_name = COALESCE(?, group_name) WHERE cid = ?",
    args: [name, groupName, contactCid],
  });
}

/** Update an existing invited contact's group only. */
export async function updateContactGroup(groupName, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET group_name = COALESCE(?, group_name) WHERE cid = ?",
    args: [groupName, contactCid],
  });
}

/** Create a pending contact record for a new invite. */
export async function createPendingContact(contactCid, name, email, role, groupName) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status, group_name) VALUES (?, ?, ?, ?, 'pending', ?)",
    args: [contactCid, name, email, role, groupName],
  });
}

/** Expire all setup tokens for a contact (new invite flow). */
export async function expirePasswordSetupTokensForNewInvite(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  });
}

/** Issue a fresh staff-invite setup token (new invite flow). */
export async function createStaffInviteSetupTokenForNewInvite(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
    args: [token, tokenHash, contactCid],
  });
}

/** Contact timeline entry — invitation sent (new invite flow, program context). */
export async function logInvitationSent(contactCid, description, contextId, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'invitation_sent', ?, 'programs', ?, ?, '{}'::jsonb)`,
    args: [contactCid, description, contextId, actorId],
  });
}

/** Valid activation invite + contact info by token hash (activate GET). */
export async function getActivationInviteByTokenHash(tokenHash, token) {
  return db.execute({
    sql: `SELECT pt.*, c.name, c.email, c.role, c.language
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.contact_cid = c.cid
            WHERE pt.used = 0 AND pt.expires_at > NOW()
              AND (pt.token_hash = ? OR pt.token = ?)`,
    args: [tokenHash, token],
  });
}

/** Token expiry row lookup (activate GET — expired-link detection). */
export async function getActivationTokenExpiry(tokenHash, token) {
  return db.execute({
    sql: "SELECT expires_at FROM password_setup_tokens WHERE token_hash = ? OR token = ?",
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (activate GET). */
export async function backfillActivationTokenHashOnOpen(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Contact timeline entry — invitation opened (activate GET). */
export async function logInvitationOpened(contactCid) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
              VALUES (?, 'invitation_opened', 'Invitation opened', 'contacts', ?, '{}'::jsonb)`,
    args: [contactCid, contactCid],
  });
}

/** Valid activation invite + contact info by token hash (activate POST). */
export async function getActivationInviteForPasswordSetup(tokenHash, token) {
  return db.execute({
    sql: `SELECT pt.*, c.email, c.name, c.role, c.language
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.contact_cid = c.cid
            WHERE pt.used = 0 AND pt.expires_at > NOW()
              AND (pt.token_hash = ? OR pt.token = ?)`,
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (activate POST). */
export async function backfillActivationTokenHashOnActivate(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Set the contact password, status = active and activated_at on account activation. */
export async function activateContactWithPassword(hashedPassword, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET password = ?, status = 'active', activated_at = NOW() WHERE cid = ?",
    args: [hashedPassword, contactCid],
  });
}

/** Mark an activation invite token as used (activate POST). */
export async function markActivationTokenUsed(id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE id = ?",
    args: [id],
  });
}

/** Contact timeline entry — invitation activated (activate POST). */
export async function logInvitationActivated(contactCid) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
              VALUES (?, 'invitation_activated', 'Account activated', 'contacts', ?, '{}'::jsonb)`,
    args: [contactCid, contactCid],
  });
}

/** Program existence check by id (invite-family program gate). */
export async function getProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Create a pending participant contact for a family member invite. */
export async function createFamilyMemberContact(cid, name, email, groupName, programId) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status, group_name, program_id) VALUES (?, ?, ?, 'participant', 'pending', ?, ?)",
    args: [cid, name, email, groupName, programId],
  });
}

/** Link a contact to a program in the participant_programs junction table. */
export async function linkContactToParticipantProgram(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                    VALUES (?, ?)
                    ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

/** Issue a family-invite password setup token (no token_type). */
export async function createFamilyInviteSetupToken(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours')",
    args: [token, tokenHash, contactCid],
  });
}

/** Contact lookup by email (quick-login staging endpoint). */
export async function getContactByEmailForQuickLogin(email) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Insert a real impersonation session row (quick-login staging endpoint). */
export async function createImpersonationUserSession(token, tokenHash, userCid, role, expiresAtStr) {
  return db.execute({
    sql: "INSERT INTO user_sessions (token, token_hash, user_cid, role, expires_at, is_impersonation) VALUES (?, ?, ?, ?, ?, ?)",
    args: [token, tokenHash, userCid, role, expiresAtStr, 1],
  });
}

/** Active contact lookup by email (forgot-password — no enumeration). */
export async function getActiveContactByEmail(email) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL AND status = 'active' LIMIT 1",
    args: [email],
  });
}

/** Invalidate prior unused setup tokens for a contact (forgot-password). */
export async function expireUnusedPasswordSetupTokensForReset(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ? AND used = 0",
    args: [contactCid],
  });
}

/** Create a password-reset setup token (1h expiry, forgot-password). */
export async function createPasswordResetToken(contactCid, token, tokenHash, expiresAtStr) {
  return db.execute({
    sql: `INSERT INTO password_setup_tokens (contact_cid, token, token_hash, expires_at, used)
              VALUES (?, ?, ?, ?, 0)`,
    args: [contactCid, token, tokenHash, expiresAtStr],
  });
}

/** Valid unused, unexpired setup token by hash/raw (setup-password). */
export async function getValidPasswordSetupToken(tokenHash, token) {
  return db.execute({
    sql: `SELECT * FROM password_setup_tokens
            WHERE used = 0 AND expires_at > NOW()
              AND (token_hash = ? OR token = ?)`,
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (setup-password). */
export async function backfillPasswordSetupTokenHash(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Set the contact password and flip status to active (setup-password). */
export async function setContactPasswordAndStatusActive(hashedPassword, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET password = ?, status = 'active' WHERE cid = ?",
    args: [hashedPassword, contactCid],
  });
}

/** Mark a setup token as used (setup-password). */
export async function markPasswordSetupTokenUsed(id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE id = ?",
    args: [id],
  });
}

/** Audit log entry — password set via secure setup link. */
export async function logPasswordSetupAudit(contactCid) {
  return db.execute({
    sql: `INSERT INTO audit_log (entity_type, entity_id, user_id, user_name, action, details)
              VALUES ('user', 0, ?, ?, 'password_setup', 'Password set via secure setup link')`,
    args: [contactCid, contactCid],
  });
}

/** Valid setup token joined with contact name/email (setup-password validate). */
export async function getPasswordSetupTokenWithUser(tokenHash, token) {
  return db.execute({
    sql: `SELECT pst.*, c.name as user_name, c.email as user_email
            FROM password_setup_tokens pst
            LEFT JOIN contacts c ON pst.contact_cid = c.cid
            WHERE pst.used = 0 AND pst.expires_at > NOW()
              AND (pst.token_hash = ? OR pst.token = ?)`,
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (setup-password validate). */
export async function backfillPasswordSetupTokenHashOnValidate(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Full contact row by email (reset-password current-password gate). */
export async function getContactByEmailForPasswordReset(email) {
  return db.execute({
    sql: 'SELECT * FROM contacts WHERE email = ? LIMIT 1',
    args: [email],
  });
}

/** Replace the contact's password hash by email (reset-password). */
export async function updateContactPasswordByEmail(hashedPassword, email) {
  return db.execute({
    sql: 'UPDATE contacts SET password = ? WHERE email = ?',
    args: [hashedPassword, email],
  });
}

/** Contact brief lookup by cid (resend-invite). */
export async function getContactBriefByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Expire still-pending setup tokens for a contact (resend-invite). */
export async function expirePendingSetupTokensByCid(cid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE contact_cid = ? AND used = 0",
    args: [cid],
  });
}

/** Issue a fresh password setup token (resend-invite). */
export async function createResendInviteSetupToken(token, tokenHash, cid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours')",
    args: [token, tokenHash, cid],
  });
}

/** Update the current user's language preference (contacts by cid or id). */
export async function updateContactLanguage(language, userId) {
  return db.execute({
    sql: "UPDATE contacts SET language = ? WHERE (cid = ? OR id = ?) AND deleted = 0",
    args: [language, userId, userId],
  });
}

/** Existence check used by the revoke-access flow. */
export async function findContactCidByCid(cid) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Revoke access — mark the contact inactive. */
export async function setContactInactive(cid) {
  return db.execute({
    sql: "UPDATE contacts SET status = 'inactive' WHERE cid = ?",
    args: [cid],
  });
}

/** Revoke access — destroy all of a user's sessions. */
export async function deleteUserSessions(cid) {
  return db.execute({
    sql: "DELETE FROM user_sessions WHERE user_cid = ?",
    args: [cid],
  });
}

// ── POST/GET /api/v2/invites + /api/v2/invites/[token] (legacy V2 invite flows) ─

/** Create a v2 invitation row with the raw token (hash columns are lazily backfilled). */
export async function createV2Invitation(token, programId, groupName, teamId, role, expiresAt) {
  return db.execute({
    sql: `INSERT INTO v2_invitations (token, program_id, group_name, team_id, role, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      token,
      programId,
      groupName || null,
      teamId || null,
      role,
      expiresAt.toISOString().replace("T", " ").replace("Z", ""),
    ],
  });
}

/** Non-expired v2 invitations, optionally narrowed to one program. */
export async function listV2Invitations(programId) {
  let query =
    "SELECT * FROM v2_invitations WHERE expires_at > NOW()";
  let args = [];

  if (programId) {
    query += " AND program_id = ?";
    args.push(programId);
  }

  return db.execute({ sql: query, args });
}

/** Validate a v2 invite token — invite row with program name, hash OR raw token (GET). */
export async function getV2InviteWithProgramNameByHashOrToken(tokenHash, token) {
  return db.execute({
    sql: `SELECT i.*, p.name as program_name
            FROM v2_invitations i
            LEFT JOIN v2_programs p ON i.program_id = p.id::text
            WHERE i.expires_at > NOW()
              AND (i.token_hash = ? OR i.token = ?)`,
    args: [tokenHash, token],
  });
}

/** Lazily backfill the token hash after a legacy GET validate (no row hash). */
export async function backfillV2InviteTokenHashOnValidate(tokenHash, token) {
  return db.execute({
    sql: "UPDATE v2_invitations SET token_hash = ? WHERE token = ?",
    args: [tokenHash, token],
  });
}

/** Validate a v2 invite token — full invite row, hash OR raw token (POST accept). */
export async function getV2InviteByHashOrToken(tokenHash, token) {
  return db.execute({
    sql: "SELECT * FROM v2_invitations WHERE expires_at > NOW() AND (token_hash = ? OR token = ?)",
    args: [tokenHash, token],
  });
}

/** Lazily backfill the token hash after a legacy POST accept (no row hash). */
export async function backfillV2InviteTokenHashOnAccept(tokenHash, token) {
  return db.execute({
    sql: "UPDATE v2_invitations SET token_hash = ? WHERE token = ?",
    args: [tokenHash, token],
  });
}

/** Contact lookup by email while accepting a v2 invite. */
export async function getContactByEmailForV2InviteAccept(email) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE email = ?",
    args: [email],
  });
}

/** Overwrite an existing contact's profile with the v2 invite credentials + group. */
export async function updateContactByEmailForV2InviteAccept(name, phone, password, role, groupName, teamId, email) {
  return db.execute({
    sql: `UPDATE contacts
              SET name = ?, phone = ?, password = ?, role = ?, group_name = ?, v2_team_id = ?
              WHERE email = ?`,
    args: [name, phone || null, password, role, groupName, teamId || null, email],
  });
}

/** Create a new contact from an accepted v2 invite. */
export async function insertContactForV2InviteAccept(cid, name, email, phone, password, role, groupName, teamId) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, password, role, group_name, v2_team_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [cid, name, email, phone || null, password, role, groupName, teamId || null],
  });
}

/** Existing v2 participant record for an accepted invite (email + program). */
export async function getV2ParticipantByEmailAndProgram(email, programId) {
  return db.execute({
    sql: "SELECT id FROM v2_participants WHERE email = ? AND program_id = ?",
    args: [email, programId],
  });
}

/** Re-joining participant: attach the v2 invite team. */
export async function updateV2ParticipantTeamByEmailAndProgram(teamId, email, programId) {
  return db.execute({
    sql: "UPDATE v2_participants SET team_id = ? WHERE email = ? AND program_id = ?",
    args: [teamId || null, email, programId],
  });
}

/** New v2 participant row for an accepted invite. */
export async function insertV2ParticipantForInviteAccept(programId, name, email, phone, teamId) {
  return db.execute({
    sql: `INSERT INTO v2_participants (program_id, name, email, phone, status, team_id)
              VALUES (?, ?, ?, ?, 'Active', ?)`,
    args: [programId, name, email, phone || null, teamId || null],
  });
}
