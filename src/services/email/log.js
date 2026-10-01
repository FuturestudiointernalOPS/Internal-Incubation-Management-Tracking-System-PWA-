/**
 * EMAIL DELIVERY LOG.
 *
 * The `platform_email_log` and `password_setup_tokens` schema self-heals, the
 * delivery history reads, the recipient-level idempotency probe, the activation
 * history, the status/bounce/Resend-event records, the tracked-send record and
 * the per-form delivery stats.
 *
 * The decisions — the safe status set, the dedupe-before-write rule, the human
 * reasons and the stat shaping — live here; every statement is in
 * `@/models/emailLogStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/email` (the module it came from) — see
 * docs/LAYER_SPLIT.md.
 */

import { initDb } from "@/lib/db";
import {
  runEmailLogStatement,
  selectLatestEmailStatus,
  selectEmailLogRow,
  selectLastSentRowByRecipient,
  selectLogByEmailId,
  selectSentForRecipientInRun,
  selectActivationLogRows,
  selectEmailStatsRows,
  insertStatusRow,
  insertBouncedRow,
  insertResendEventRow,
  insertEmailResultSent,
  insertEmailResultFailed,
  insertStandaloneSent,
  insertStandaloneFailed,
  selectLatestPasswordSetupToken,
} from "@/models/emailLogStore";

// Every workflow email is tracked in platform_email_log so the system
// never sends the same email type twice for the same submission, and
// failed sends are distinguishable from successful ones.

let emailLogTablePromise = null;

export async function ensureEmailLogTable() {
  if (emailLogTablePromise) return emailLogTablePromise;
  emailLogTablePromise = (async () => {
    try {
      await initDb();
      await runEmailLogStatement(`CREATE TABLE IF NOT EXISTS platform_email_log (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER,
        contact_cid TEXT,
        email_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      await runEmailLogStatement(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS provider TEXT`);
      await runEmailLogStatement(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS recipient TEXT`);
      await runEmailLogStatement(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS email_id TEXT`);
      await runEmailLogStatement(`ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS batch_id TEXT`);
      await runEmailLogStatement(`DROP INDEX IF EXISTS idx_email_log_once`);
      await runEmailLogStatement(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_once
        ON platform_email_log (submission_id, email_type, COALESCE(batch_id, ''))
        WHERE status = 'sent'`);
      return true;
    } catch (error) {
      console.warn("[EmailLog] Could not ensure table:", error.message);
      emailLogTablePromise = null; // allow retry on transient failure
      return false;
    }
  })();
  return emailLogTablePromise;
}

export async function getEmailLogRow(submissionId, emailType) {
  if (!submissionId) return null;
  try {
    await ensureEmailLogTable();
    const res = await selectEmailLogRow(submissionId, emailType);
    return res.rows[0] || null;
  } catch (_) {
    return null;
  }
}

/**
 * RECIPIENT-LEVEL IDEMPOTENCY — when the same person appears in multiple
 * submissions of the same run (duplicate email), only ONE email of a given
 * type is ever sent to their address. Returns true when an email of that
 * type has already been successfully sent to this recipient for this run,
 * regardless of which submission it was attached to.
 */
export async function hasSentEmailToRecipientInRun({ run_id, email_type, recipient }) {
  if (!run_id || !recipient) return false;
  try {
    await ensureEmailLogTable();
    const res = await selectSentForRecipientInRun(run_id, email_type, recipient);
    return res.rows.length > 0;
  } catch (_) {
    return false;
  }
}

/**
 * ACTIVATION HISTORY — the real email/invitation history for a submission,
 * plus the state of its most recent password-setup token. Used to distinguish
 * a FIRST activation send from a RESEND (never guessed from account status)
 * and to surface first/last sent timestamps + link validity in the UI.
 *
 * Returns {
 *   email_status,        // latest platform_email_log status (sent/failed/pending/skipped…) or null
 *   first_sent_at,       // first successful send timestamp (sent rows only)
 *   last_sent_at,        // most recent successful send timestamp
 *   email_count,         // total activation log rows for the submission
 *   token_valid,         // most recent token exists, unused and not expired
 *   token_expires_at,    // expiry of the most recent token (or null)
 *   token_used,          // used flag of the most recent token (or null)
 * }
 */
export async function getActivationHistory({ submission_id, contact_cid }) {
  const empty = {
    email_status: null,
    first_sent_at: null,
    last_sent_at: null,
    email_count: 0,
    token_valid: false,
    token_expires_at: null,
    token_used: null,
  };
  try {
    await ensureEmailLogTable();
    let rows = [];
    if (submission_id) {
      const res = await selectActivationLogRows(submission_id);
      rows = res.rows;
    }
    const sentRows = rows.filter((row) => row.status === "sent");

    let tokenValid = false;
    let tokenExpiresAt = null;
    let tokenUsed = null;
    if (contact_cid) {
      try {
        await ensurePasswordSetupTokensSchema();
        const tokRes = await selectLatestPasswordSetupToken(contact_cid);
        const tok = tokRes.rows[0];
        if (tok) {
          tokenUsed = tok.used;
          tokenExpiresAt = tok.expires_at;
          tokenValid = Number(tok.used) === 0 && new Date(tok.expires_at) > new Date();
        }
      } catch (_) {}
    }

    return {
      email_status: rows.length ? rows[rows.length - 1].status : null,
      first_sent_at: sentRows.length ? sentRows[0].sent_at || sentRows[0].created_at : null,
      last_sent_at: sentRows.length ? sentRows[sentRows.length - 1].sent_at || sentRows[sentRows.length - 1].created_at : null,
      email_count: rows.length,
      token_valid: tokenValid,
      token_expires_at: tokenExpiresAt,
      token_used: tokenUsed,
    };
  } catch (_) {
    return empty;
  }
}

/**
 * Ensure password_setup_tokens exists with the CORRECT shape and repair
 * environments where `used` was created as BOOLEAN. A boolean `used` breaks
 * every "used = 0/1" write with Postgres error
 * "column 'used' is boolean but expression is of type integer" — which is
 * what makes activation emails fail while approval emails still work.
 * Idempotent: safe to call on every activation send.
 */
let passwordSetupTokensSchemaPromise = null;

export async function ensurePasswordSetupTokensSchema() {
  if (passwordSetupTokensSchemaPromise) return passwordSetupTokensSchemaPromise;
  passwordSetupTokensSchemaPromise = (async () => {
    try {
      await runEmailLogStatement(`CREATE TABLE IF NOT EXISTS password_setup_tokens (
        id SERIAL PRIMARY KEY,
        contact_cid TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      // Repair tables created by the LEGACY script (user_cid/user_email NOT NULL,
      // used BOOLEAN). The app writes contact_cid + integer used; legacy NOT NULL
      // columns without defaults otherwise break every insert.
      await runEmailLogStatement(`ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS contact_cid TEXT`);
      await runEmailLogStatement(`ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT`);
      await runEmailLogStatement(`CREATE UNIQUE INDEX IF NOT EXISTS idx_password_setup_tokens_token_hash ON password_setup_tokens(token_hash) WHERE token_hash IS NOT NULL`);
      try {
        await runEmailLogStatement(`ALTER TABLE password_setup_tokens ALTER COLUMN user_cid DROP NOT NULL`);
      } catch (_) {}
      try {
        await runEmailLogStatement(`ALTER TABLE password_setup_tokens ALTER COLUMN user_email DROP NOT NULL`);
      } catch (_) {}
      try {
        await runEmailLogStatement(`UPDATE password_setup_tokens SET contact_cid = user_cid WHERE contact_cid IS NULL AND user_cid IS NOT NULL`);
      } catch (_) {}
      await runEmailLogStatement(`DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'password_setup_tokens' AND column_name = 'used' AND data_type = 'boolean'
        ) THEN
          ALTER TABLE password_setup_tokens ALTER COLUMN used DROP DEFAULT;
          ALTER TABLE password_setup_tokens ALTER COLUMN used TYPE INTEGER USING CASE WHEN used THEN 1 ELSE 0 END;
          ALTER TABLE password_setup_tokens ALTER COLUMN used SET DEFAULT 0;
        END IF;
      END $$`);
      return true;
    } catch (error) {
      console.warn("[TokenSchema] Could not ensure password_setup_tokens schema:", error.message);
      passwordSetupTokensSchemaPromise = null; // allow retry on transient failure
      return false;
    }
  })();
  return passwordSetupTokensSchemaPromise;
}

/**
 * Append ONE row per standalone attempt (sent OR failed) to the shared log.
 * Never deduped: every attempt is history and the LATEST row is the status.
 */
export async function recordStandaloneSend({ result, to, contact_cid, email_type, note, provider }) {
  try {
    await ensureEmailLogTable();
    const recipient = to ? String(to).trim().substring(0, 300) : null;
    if (result?.success) {
      await insertStandaloneSent(contact_cid || null, email_type, result?.provider || provider || null, note || null, recipient, result?.data?.id || null);
    } else {
      const reason = result?.provider === "blocked"
        ? "Refused — the address is a placeholder, not a real recipient"
        : String(typeof result?.error === "string" ? result.error : result?.error ? JSON.stringify(result.error) : "Send failed");
      await insertStandaloneFailed(contact_cid || null, email_type, result?.provider || provider || null, reason.substring(0, 500), recipient);
    }
  } catch (error) {
    console.warn("[EmailLog] Could not record standalone send:", error.message);
  }
}

/**
 * Record a workflow email status row (skipped/failed) with a human-readable
 * reason so the dashboard shows WHY an expected email never fired. Deduped:
 * no new row is written when the latest row already has the same status.
 */
export async function recordEmailStatus({ submission_id, contact_cid, email_type, status, error, provider, to }) {
  try {
    await ensureEmailLogTable();
    const ALLOWED = ["pending", "skipped", "failed", "bounced", "cancelled"];
    const safeStatus = ALLOWED.includes(status) ? status : "failed";
    if (submission_id) {
      const latest = await selectLatestEmailStatus(submission_id, email_type);
      const last = latest.rows[0];
      if (last && last.status === safeStatus) return; // already recorded — no spam
    }
    await insertStatusRow(
      submission_id ? parseInt(submission_id) : null,
      contact_cid || null,
      email_type,
      safeStatus,
      provider || null,
      (error || "Unknown reason").substring(0, 500),
      to ? String(to).trim().substring(0, 300) : null,
    );
  } catch (error) {
    console.warn("[EmailLog] Could not record status:", error.message);
  }
}

/** Record a hard failure (status 'failed') with a reason. */
export async function recordEmailFailure(args) {
  return recordEmailStatus({ ...args, status: "failed" });
}

/**
 * Mark the most recent SENT email to a recipient as BOUNCED (provider
 * reported the recipient could not receive it). Keeps the sent row and adds
 * a bounced row as the latest status — history is never deleted.
 */
export async function markEmailBounced({ recipient, error }) {
  try {
    await ensureEmailLogTable();
    const res = await selectLastSentRowByRecipient(recipient);
    const row = res.rows[0];
    if (!row) return false;
    await insertBouncedRow(
      row.submission_id,
      row.contact_cid || null,
      row.email_type,
      row.provider || null,
      (error || "Bounced — provider reported delivery failure").substring(0, 500),
      row.recipient,
      row.sent_at,
    );
    return true;
  } catch (error) {
    console.warn("[EmailLog] markEmailBounced:", error.message);
    return false;
  }
}

/**
 * Record a Resend lifecycle event (delivered / delayed / bounced / failed /
 * opened / clicked / complained). The event is APPENDED to the log so the
 * full timeline is preserved; the email is identified by Resend's email_id
 * (never just by recipient, so two emails to the same address stay distinct).
 * If the email_id is unknown (an email sent before email_id tracking was
 * added), no event is recorded and false is returned — legacy recipient-based
 * bounce handling remains in markEmailBounced for old records.
 */
export async function recordResendEvent({ email_id, status, error, createdAt }) {
  try {
    await ensureEmailLogTable();
    let row = null;
    if (email_id) {
      const result = await selectLogByEmailId(email_id);
      row = result.rows[0] || null;
    }
    if (!row) return false; // unknown email_id — nothing to attach to
    const eventAt = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();
    await insertResendEventRow(
      row.submission_id,
      row.contact_cid || null,
      row.email_type,
      status,
      row.provider || "resend",
      (error || "").substring(0, 500) || null,
      row.recipient,
      row.email_id || email_id || null,
      row.sent_at,
      eventAt,
    );
    return true;
  } catch (error) {
    console.warn("[EmailLog] recordResendEvent:", error.message);
    return false;
  }
}

export async function recordEmailResult({ submission_id, contact_cid, email_type, success, error, provider, note, to, emailId, batch_id }) {
  try {
    await ensureEmailLogTable();
    const recipient = to ? String(to).trim().substring(0, 300) : null;
    if (success) {
      await insertEmailResultSent(
        submission_id ? parseInt(submission_id) : null,
        contact_cid || null,
        email_type,
        provider || null,
        note || null,
        recipient,
        emailId || null,
        batch_id || null,
      );
    } else {
      await insertEmailResultFailed(
        submission_id ? parseInt(submission_id) : null,
        contact_cid || null,
        email_type,
        provider || null,
        (error || "Unknown error").substring(0, 500),
        recipient,
        batch_id || null,
      );
    }
  } catch (error) {
    console.warn("[EmailLog] Could not record:", error.message);
  }
}

/**
 * Email delivery stats for a form (dashboard visibility).
 */
export async function getEmailStatsForForm(formId) {
  try {
    await ensureEmailLogTable();
    const res = await selectEmailStatsRows(formId);
    const stats = { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
    for (const row of res.rows) {
      if (row.status === "sent") stats.sent += row.cnt;
      if (row.status === "failed") stats.failed += row.cnt;
      if (row.status === "pending") stats.pending += row.cnt;
      if (row.status === "sent" && row.email_type === "activation") stats.activation_sent += row.cnt;
      if (row.status === "sent" && row.email_type === "approval") stats.approval_sent += row.cnt;
    }
    return stats;
  } catch (_) {
    return { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 };
  }
}
