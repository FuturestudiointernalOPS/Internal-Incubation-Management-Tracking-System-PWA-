import db from "@/lib/db";

/**
 * Invitations & password-setup store — the `v2_invitations` table, the
 * one-time password-setup tokens, and the contact account creation behind
 * `/api/invites` and `/api/invites/[token]`.
 *
 * Split out of `src/models/groups.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/groups` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET / POST /api/invites ──────────────────────────────────────────────────

/**
 * Ensure the v2_invitations table exists (idempotent, per-request).
 *
 * Two defects fixed here:
 *   1. The original DDL used SQLite syntax — `id INTEGER PRIMARY KEY AUTOINCREMENT`
 *      — which Postgres rejects outright. src/lib/db.js translates only
 *      `datetime('now')`, NOT `AUTOINCREMENT`, so this CREATE threw every time
 *      and the table never existed on any Postgres database.
 *   2. The column list omitted `token_hash` and `email`, both of which
 *      createInvitation writes — so the insert would have failed next even once
 *      the table existed.
 * The ALTERs below repair a table created by any older or manual path.
 */
export async function ensureInvitationsTable() {
  await db.execute(`CREATE TABLE IF NOT EXISTS v2_invitations (
        id SERIAL PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        token_hash TEXT,
        program_id TEXT NOT NULL,
        group_name TEXT,
        team_id TEXT,
        role TEXT DEFAULT 'participant',
        email TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
  await db.execute(
    "ALTER TABLE v2_invitations ADD COLUMN IF NOT EXISTS token_hash TEXT",
  );
  await db.execute(
    "ALTER TABLE v2_invitations ADD COLUMN IF NOT EXISTS email TEXT",
  );
}

/** Insert a program invite link (plain token + token_hash; blank email). */
export async function createInvitation(
  token,
  token_hash,
  program_id,
  group_name,
  team_id,
  role,
  email,
  expires_at,
) {
  return db.execute({
    sql: `INSERT INTO v2_invitations (token, token_hash, program_id, group_name, team_id, role, email, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      token,
      token_hash,
      program_id,
      group_name || null,
      team_id || null,
      role,
      email,
      expires_at,
    ],
  });
}

/** Unexpired invites, optionally narrowed to one program (GET /api/invites). */
export async function listActiveInvites(program_id) {
  let query =
    "SELECT * FROM v2_invitations WHERE expires_at > datetime('now')";
  let args = [];

  if (program_id) {
    query += " AND program_id = ?";
    args.push(program_id);
  }

  return db.execute({ sql: query, args });
}

// ── GET / POST /api/invites/[token] (password-setup tokens) ──────────────────

/** Unused password-setup token row matching a token hash or raw token (GET validation). */
export async function resolveInviteToken(token_hash, token) {
  return db.execute({
    sql: "SELECT id, token, token_hash, contact_cid, expires_at FROM password_setup_tokens WHERE used = 0 AND (token_hash = ? OR token = ?)",
    args: [token_hash, token],
  });
}

/** Backfill the hash on a legacy token row seen during GET validation. */
export async function backfillInviteTokenHashOnValidate(token_hash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [token_hash, id],
  });
}

/** Password-setup token row matching a token hash or raw token, incl. used flag (POST accept). */
export async function getPasswordSetupToken(token_hash, token) {
  return db.execute({
    sql: "SELECT id, token_hash, contact_cid, used FROM password_setup_tokens WHERE (token_hash = ? OR token = ?)",
    args: [token_hash, token],
  });
}

/**
 * Backfill the hash on a legacy token row seen during POST acceptance.
 * Byte-identical query to backfillInviteTokenHashOnValidate; extracted
 * separately so each original inline call site maps 1:1 to a model function.
 */
export async function backfillInviteTokenHashOnAccept(token_hash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [token_hash, id],
  });
}

/** Contact profile row (name/email/role/group/program) for an invite acceptance. */
export async function getContactProfileByCid(cid) {
  return db.execute({
    sql: "SELECT name, email, role, group_name, program_id FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Existing (non-deleted) contact rows matching an exact email (acceptance dedupe). */
export async function findContactByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE email = ? AND deleted = 0",
    args: [email],
  });
}

/** Set the password and activate an existing contact matched by email. */
export async function activateContactWithPassword(hashed_password, contact_name, contact_email) {
  return db.execute({
    sql: "UPDATE contacts SET password = ?, name = COALESCE(NULLIF(?, ''), name), status = 'active' WHERE email = ?",
    args: [hashed_password, contact_name, contact_email],
  });
}

/** Create the contact account during invite acceptance (active, NOW()). */
export async function createContactFromInvite(
  contact_cid,
  name,
  email,
  phone,
  password,
  role,
) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, password, role, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
    args: [contact_cid, name, email, phone || null, password, role],
  });
}

/** Mark a password-setup token as used (one-time invite). */
export async function markInviteTokenUsed(id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE id = ?",
    args: [id],
  });
}

/** Enroll the accepted invite as an active participant_programs member (no-op on conflict). */
export async function addActiveProgramEnrollment(participant_id, program_id) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
                VALUES (?, ?, 'active', NOW())
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participant_id, program_id],
  });
}
