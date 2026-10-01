/**
 * Email delivery log + password-setup-token schema — statements (REPOSITORY
 * layer).
 *
 * The data access behind `@/services/email/log`: the `platform_email_log` and
 * `password_setup_tokens` self-heal statements, the log reads and writes, and the
 * form-stats and activation-history reads.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/email.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Schema self-heal (bare-string execute, as before) ────────────────────────

/** Run one email-log / token-schema migration statement (bare string form). */
export function runEmailLogStatement(sql) {
  return db.execute(sql);
}

// ── platform_email_log reads ─────────────────────────────────────────────────

/** The latest log row's status + error for a submission/type. */
export function selectLatestEmailStatus(submissionId, emailType) {
  return db.execute({
    sql: "SELECT status, error FROM platform_email_log WHERE submission_id = ? AND email_type = ? ORDER BY id DESC LIMIT 1",
    args: [parseInt(submissionId), emailType],
  });
}

/** One log row for a submission/type, newest first. */
export function selectEmailLogRow(submissionId, emailType) {
  return db.execute({
    sql: "SELECT * FROM platform_email_log WHERE submission_id = ? AND email_type = ? ORDER BY id DESC LIMIT 1",
    args: [parseInt(submissionId), emailType],
  });
}

/** The most recent SENT log row to a recipient. */
export function selectLastSentRowByRecipient(recipient) {
  return db.execute({
    sql: `SELECT * FROM platform_email_log
            WHERE LOWER(recipient) = LOWER(?) AND status = 'sent'
            ORDER BY id DESC LIMIT 1`,
    args: [String(recipient).trim()],
  });
}

/** One log row by provider email id, newest first. */
export function selectLogByEmailId(emailId) {
  return db.execute({
    sql: "SELECT * FROM platform_email_log WHERE email_id = ? ORDER BY id DESC LIMIT 1",
    args: [String(emailId)],
  });
}

/** Whether a `sent` row exists for this (run, type, recipient). */
export function selectSentForRecipientInRun(runId, emailType, recipient) {
  return db.execute({
    sql: `SELECT 1
            FROM platform_email_log el
            JOIN platform_form_submissions s ON el.submission_id = s.id
            WHERE s.run_id = ? AND el.email_type = ? AND el.status = 'sent'
              AND LOWER(el.recipient) = LOWER(?)
            LIMIT 1`,
    args: [parseInt(runId), emailType, String(recipient).trim()],
  });
}

/** The activation log rows of a submission, oldest first. */
export function selectActivationLogRows(submissionId) {
  return db.execute({
    sql: `SELECT status, sent_at, created_at, recipient, error
              FROM platform_email_log
              WHERE submission_id = ? AND email_type = 'activation'
              ORDER BY id ASC`,
    args: [parseInt(submissionId)],
  });
}

/** Per-form delivery counts grouped by type + status. */
export function selectEmailStatsRows(formId) {
  return db.execute({
    sql: `SELECT el.email_type, el.status, COUNT(*)::int AS cnt
            FROM platform_email_log el
            JOIN platform_form_submissions s ON el.submission_id = s.id
            JOIN platform_form_runs r ON s.run_id = r.id
            WHERE r.form_id = ?
            GROUP BY el.email_type, el.status`,
    args: [parseInt(formId)],
  });
}

// ── platform_email_log writes ────────────────────────────────────────────────

/** Insert a status (skipped/failed/pending/bounced/cancelled) row. */
export function insertStatusRow(submissionId, contactCid, emailType, status, provider, error, recipient) {
  return db.execute({
    sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [submissionId, contactCid, emailType, status, provider, error, recipient],
  });
}

/** Insert a `bounced` row mirroring the last sent row. */
export function insertBouncedRow(submissionId, contactCid, emailType, provider, error, recipient, sentAt) {
  return db.execute({
    sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, sent_at)
            VALUES (?, ?, ?, 'bounced', ?, ?, ?, ?)`,
    args: [submissionId, contactCid, emailType, provider, error, recipient, sentAt],
  });
}

/** Append a Resend lifecycle-event row. */
export function insertResendEventRow(submissionId, contactCid, emailType, status, provider, error, recipient, emailId, sentAt, createdAt) {
  return db.execute({
    sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, email_id, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [submissionId, contactCid, emailType, status, provider, error, recipient, emailId, sentAt, createdAt],
  });
}

/** Insert a `sent` result row (deduped per submission/type/batch). */
export function insertEmailResultSent(submissionId, contactCid, emailType, provider, note, recipient, emailId, batchId) {
  return db.execute({
    sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, email_id, batch_id, sent_at)
              VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, NOW())
              ON CONFLICT (submission_id, email_type, COALESCE(batch_id, '')) WHERE status = 'sent' DO NOTHING`,
    args: [submissionId, contactCid, emailType, provider, note, recipient, emailId, batchId],
  });
}

/** Insert a `failed` result row. */
export function insertEmailResultFailed(submissionId, contactCid, emailType, provider, error, recipient, batchId) {
  return db.execute({
    sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, batch_id)
              VALUES (?, ?, ?, 'failed', ?, ?, ?, ?)`,
    args: [submissionId, contactCid, emailType, provider, error, recipient, batchId],
  });
}

/** Append a standalone `sent` row (submission_id NULL). */
export function insertStandaloneSent(contactCid, emailType, provider, note, recipient, emailId) {
  return db.execute({
    sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient, email_id, sent_at)
              VALUES (NULL, ?, ?, 'sent', ?, ?, ?, ?, NOW())`,
    args: [contactCid, emailType, provider, note, recipient, emailId],
  });
}

/** Append a standalone `failed` row (submission_id NULL). */
export function insertStandaloneFailed(contactCid, emailType, provider, reason, recipient) {
  return db.execute({
    sql: `INSERT INTO platform_email_log (submission_id, contact_cid, email_type, status, provider, error, recipient)
              VALUES (NULL, ?, ?, 'failed', ?, ?, ?)`,
    args: [contactCid, emailType, provider, reason, recipient],
  });
}

// ── password_setup_tokens ────────────────────────────────────────────────────

/** The most recent password-setup token row of a contact. */
export function selectLatestPasswordSetupToken(contactCid) {
  return db.execute({
    sql: `SELECT used, expires_at FROM password_setup_tokens
                WHERE contact_cid = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    args: [String(contactCid)],
  });
}
