import db from "@/lib/db";

/**
 * WhatsApp consent + delivery log (REPOSITORY layer).
 *
 * Consent lives in its own table, not on `contacts`:
 *  - it is a legal record (who agreed, when, from which surface), not an
 *    identity field;
 *  - the identity table is wide already, and `SELECT *` on it feeds many
 *    screens that have no business seeing a marketing consent;
 *  - withdrawing consent must never be confused with editing a profile.
 *
 * The delivery log mirrors `platform_email_log`: what was attempted, to which
 * contact, with which template, and what happened. The daily cap and the
 * per-contact cooldown are counted from it, so a missing log row is a missing
 * guard.
 */

const CONSENT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS contact_whatsapp_consents (
    contact_cid TEXT PRIMARY KEY,
    opt_in INTEGER NOT NULL DEFAULT 0,
    source TEXT,
    opted_in_at TIMESTAMP,
    opted_out_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`;

const LOG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS platform_whatsapp_log (
    id SERIAL PRIMARY KEY,
    contact_cid TEXT,
    direction TEXT NOT NULL DEFAULT 'outbound',
    message_type TEXT NOT NULL DEFAULT 'template',
    template_name TEXT,
    status TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'whatsapp',
    provider_message_id TEXT,
    error TEXT,
    recipient TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )
`;

/** Create the consent and delivery-log tables (idempotent). */
export async function ensureWhatsappSchema() {
  await db.execute(CONSENT_SCHEMA);
  await db.execute(LOG_SCHEMA);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_whatsapp_log_contact ON platform_whatsapp_log (contact_cid)",
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_whatsapp_log_created ON platform_whatsapp_log (created_at)",
  );
  // Meta retries a webhook; the provider message id is the natural idempotency
  // key, so a retried delivery can never double-log the same message.
  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_log_provider_id ON platform_whatsapp_log (provider_message_id) WHERE provider_message_id IS NOT NULL",
  );
}

/** The current consent row of one contact, or no rows. */
export async function getWhatsappConsent(cid) {
  await ensureWhatsappSchema();
  return db.execute({
    sql: "SELECT contact_cid, opt_in, source, opted_in_at, opted_out_at, updated_at FROM contact_whatsapp_consents WHERE contact_cid = ?",
    args: [String(cid)],
  });
}

/** Consent rows for a set of contacts (registry enrichment). */
export async function getWhatsappConsentsForCids(cids) {
  if (!Array.isArray(cids) || cids.length === 0) return { rows: [] };
  await ensureWhatsappSchema();
  const placeholders = cids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT contact_cid, opt_in, source, opted_in_at, opted_out_at, updated_at
            FROM contact_whatsapp_consents
            WHERE contact_cid IN (${placeholders})`,
    args: cids,
  });
}

/**
 * Record the person's choice. Opting in stamps `opted_in_at`; opting out
 * stamps `opted_out_at` and keeps the previous opt-in timestamp as history.
 */
export async function upsertWhatsappConsent(cid, optIn, source) {
  await ensureWhatsappSchema();
  const value = optIn ? 1 : 0;
  return db.execute({
    sql: `INSERT INTO contact_whatsapp_consents
            (contact_cid, opt_in, source, opted_in_at, opted_out_at, updated_at)
          VALUES (?, ?, ?, CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
                             CASE WHEN ? = 1 THEN NULL ELSE NOW() END, NOW())
          ON CONFLICT (contact_cid) DO UPDATE SET
            opt_in = EXCLUDED.opt_in,
            source = EXCLUDED.source,
            opted_in_at = CASE WHEN EXCLUDED.opt_in = 1 THEN NOW()
                               ELSE contact_whatsapp_consents.opted_in_at END,
            opted_out_at = CASE WHEN EXCLUDED.opt_in = 1 THEN NULL ELSE NOW() END,
            updated_at = NOW()`,
    args: [String(cid), value, source || null, value, value],
  });
}

/** The contact fields the WhatsApp decision needs. */
export async function getContactWhatsappFields(cid) {
  return db.execute({
    sql: "SELECT cid, phone, country_code, deleted, deleted_at, archived_at FROM contacts WHERE cid = ?",
    args: [String(cid)],
  });
}

/** Append one delivery-log row. */
export async function insertWhatsappLog({
  contactCid,
  direction = "outbound",
  messageType = "template",
  templateName = null,
  status,
  provider = "whatsapp",
  providerMessageId = null,
  error = null,
  recipient = null,
  sentAt = null,
}) {
  await ensureWhatsappSchema();
  return db.execute({
    sql: `INSERT INTO platform_whatsapp_log
            (contact_cid, direction, message_type, template_name, status, provider,
             provider_message_id, error, recipient, sent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING`,
    args: [
      contactCid || null,
      direction,
      messageType,
      templateName,
      status,
      provider,
      providerMessageId,
      error,
      recipient,
      sentAt,
    ],
  });
}

/** Number of sent outbound messages since an instant (daily-cap check). */
export async function countWhatsappOutboundSince(since) {
  await ensureWhatsappSchema();
  return db.execute({
    sql: `SELECT COUNT(*)::int AS count FROM platform_whatsapp_log
            WHERE direction = 'outbound' AND status = 'sent' AND created_at >= ?`,
    args: [since],
  });
}

/** The most recent sent message to one contact since an instant, if any. */
export async function findWhatsappOutboundForContactSince(cid, since) {
  await ensureWhatsappSchema();
  return db.execute({
    sql: `SELECT id, created_at FROM platform_whatsapp_log
            WHERE contact_cid = ? AND direction = 'outbound' AND status = 'sent'
              AND created_at >= ?
            ORDER BY id DESC LIMIT 1`,
    args: [String(cid), since],
  });
}

/**
 * Resolve a WhatsApp sender number to a contact. Several stored shapes are
 * accepted (international, local, 00-prefixed) but the comparison itself stays
 * EXACT — a suffix match could withdraw consent from the wrong person.
 */
export async function findContactByPhoneDigits(digitsList) {
  const values = (Array.isArray(digitsList) ? digitsList : []).filter(Boolean);
  if (values.length === 0) return { rows: [] };
  const placeholders = values.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT cid, phone, country_code
            FROM contacts
           WHERE deleted_at IS NULL
             AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') IN (${placeholders})
           LIMIT 1`,
    args: values,
  });
}

/** Apply a delivery status reported by the provider to the outbound row. */
export async function updateWhatsappLogStatus(providerMessageId, status, error = null) {
  await ensureWhatsappSchema();
  return db.execute({
    sql: `UPDATE platform_whatsapp_log
             SET status = ?,
                 error = COALESCE(?, error),
                 sent_at = CASE WHEN ? = 'sent' AND sent_at IS NULL THEN NOW() ELSE sent_at END
           WHERE provider_message_id = ?`,
    args: [status, error, status, String(providerMessageId)],
  });
}
