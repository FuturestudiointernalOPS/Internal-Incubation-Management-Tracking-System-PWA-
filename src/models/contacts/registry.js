import db from "@/lib/db";

/**
 * Contact registry store — the global registry feed (contacts, families, teams)
 * and the email-log reads that feed the contact detail screens.
 *
 * Split out of `src/models/contacts.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/contacts` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET /api/contacts/full-state — journal d'e-mails ─────────────────────────

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

/**
 * Every email recorded for ONE person in the shared delivery log: the standalone
 * sends (invitations, password setup, approvals, credentials, campaigns) as well
 * as the workflow emails. Matched on the contact id OR the recipient address, so
 * a send that could not be attached to an identity still appears here.
 */
export async function getEmailLogForContact(cid, limit = 100) {
  return db.execute({
    sql: `SELECT id, submission_id, contact_cid, email_type, status, provider, error, recipient, sent_at, created_at
          FROM platform_email_log
          WHERE contact_cid = ?
             OR LOWER(recipient) = (SELECT LOWER(email) FROM contacts WHERE cid = ? AND email IS NOT NULL AND email <> '')
          ORDER BY id DESC
          LIMIT ?`,
    args: [cid, cid, Math.max(1, Math.min(500, parseInt(limit) || 100))],
  });
}

// ── registry feed ─────────────────────────────────────────────────────────────

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
