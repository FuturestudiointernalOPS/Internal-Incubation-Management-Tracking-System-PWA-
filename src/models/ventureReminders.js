import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

/**
 * Venture reminder rules and the record of what was sent (REPOSITORY layer).
 *
 * One statement per function, no decisions: the rule evaluation and the
 * recipient resolution live in `@/services/reminders`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement.
 */

// ── rules ────────────────────────────────────────────────────────────────────

/** Every rule of a Venture, defaults first then overrides, in trigger order. */
export function selectReminderRules(ventureId) {
  return db.execute({
    sql: `SELECT id, scope, work_item_kind, work_item_id, trigger, days_before,
                 notify_owner, notify_supporting, is_active, created_at, updated_at
          FROM venture_reminder_rules
          WHERE venture_id::text = ?::text
          ORDER BY (scope = 'work_item'), trigger, days_before DESC`,
    args: [String(ventureId)],
  });
}

/** Insert one rule, returning it. */
export function insertReminderRule({
  ventureId,
  scope,
  workItemKind,
  workItemId,
  trigger,
  daysBefore,
  notifyOwner,
  notifySupporting,
  actorCid,
}) {
  return db.execute({
    sql: `INSERT INTO venture_reminder_rules
            (venture_id, scope, work_item_kind, work_item_id, trigger, days_before,
             notify_owner, notify_supporting, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      String(ventureId),
      scope === "work_item" ? "work_item" : "venture",
      workItemKind || null,
      workItemId === null || workItemId === undefined ? null : String(workItemId),
      trigger,
      daysBefore,
      notifyOwner === true,
      notifySupporting === true,
      actorCid || null,
    ],
  });
}

/** Turn one rule on or off. Scoped to the Venture so an id from elsewhere matches nothing. */
export function setReminderRuleActive({ ventureId, ruleId, isActive }) {
  return db.execute({
    sql: `UPDATE venture_reminder_rules SET is_active = ?, updated_at = NOW()
          WHERE id = ? AND venture_id::text = ?::text
          RETURNING id`,
    args: [isActive === true, ruleId, String(ventureId)],
  });
}

/** Remove one rule. History already written is untouched — it is a record. */
export function deleteReminderRule({ ventureId, ruleId }) {
  return db.execute({
    sql: `DELETE FROM venture_reminder_rules
          WHERE id = ? AND venture_id::text = ?::text
          RETURNING id`,
    args: [ruleId, String(ventureId)],
  });
}

/** The distinct ventures that have at least one active rule — the sweep's work list. */
export function selectVenturesWithActiveRules() {
  return db.execute({
    sql: `SELECT DISTINCT venture_id FROM venture_reminder_rules WHERE is_active = TRUE`,
    args: [],
  });
}

/**
 * The active Lead Managers of a Venture, with the address a reminder can copy.
 *
 * A reminder about the Venture's work is also copied to whoever runs it: the
 * people named here receive the mail as CC, not as a second reminder. Read by
 * `@/services/reminders/engine` for every activity reminder.
 */
export function selectLeadManagerRecipients(ventureId) {
  return db.execute({
    sql: `SELECT DISTINCT c.cid, c.name, c.email
            FROM venture_staff_assignments a
            JOIN contacts c ON c.cid = a.staff_contact_id
           WHERE a.venture_id::text = ?::text
             AND a.responsibility_code = 'lead_manager'
             AND a.status = 'active'
             AND c.email IS NOT NULL
             AND (c.deleted = 0 OR c.deleted IS NULL)`,
    args: [String(ventureId)],
  });
}

/** Stamp a claimed row as actually delivered. */
export function markReminderSent({ id, sentAt }) {
  return db.execute({
    sql: `UPDATE venture_reminder_log SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?`,
    args: [sentAt || new Date().toISOString(), id],
  });
}

/**
 * Turn a claimed row into a FAILED one.
 *
 * The row was inserted as 'sent' to take the duplicate slot before the send (see
 * the caller). A failed send releases it — the partial index only covers
 * status='sent' — so the same reminder may be attempted again later.
 */
export function markReminderFailed({ id, error }) {
  return db.execute({
    sql: `UPDATE venture_reminder_log SET status = 'failed', error = ? WHERE id = ?`,
    args: [String(error || "send failed").slice(0, 500), id],
  });
}

// ── history ──────────────────────────────────────────────────────────────────

/** A Venture's reminder history, newest first. */
export async function selectReminderLog(ventureRef, limit = 200) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT id, work_item_kind, work_item_id, work_item_ref, work_item_title,
                 rule_id, trigger, recipient_name, recipient_email, recipient_role,
                 status, error, subject, body, attachment_name, sent_at, created_at
          FROM venture_reminder_log
          WHERE venture_id::text = ?::text
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [String(ventureId), Math.min(Math.max(Number(limit) || 200, 1), 500)],
  });
}

/**
 * Record one attempt.
 *
 * `ON CONFLICT DO NOTHING` on the dedupe key is the duplicate guard: when an
 * automatic reminder for the same (work item, trigger, date, recipient) has
 * already been SENT, this inserts nothing and returns no row, and the caller
 * treats that as "already handled". A failed attempt is not covered by the
 * partial index, so it may be retried.
 */
export async function insertReminderLog({
  ventureId: ventureRef,
  workItemKind,
  workItemId,
  workItemRef,
  workItemTitle,
  ruleId,
  trigger,
  recipientName,
  recipientEmail,
  recipientRole,
  status,
  error,
  subject,
  body,
  attachmentPath,
  attachmentName,
  dedupeKey,
  sentAt,
}) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `INSERT INTO venture_reminder_log
            (venture_id, work_item_kind, work_item_id, work_item_ref, work_item_title,
             rule_id, trigger, recipient_name, recipient_email, recipient_role,
             status, error, subject, body, attachment_path, attachment_name,
             dedupe_key, sent_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT DO NOTHING
          RETURNING id`,
    args: [
      String(ventureId),
      workItemKind,
      String(workItemId),
      workItemRef || null,
      workItemTitle || null,
      ruleId === null || ruleId === undefined ? null : ruleId,
      trigger,
      recipientName || null,
      recipientEmail,
      recipientRole || null,
      status,
      error || null,
      // What the sender wrote, and the file they attached — recorded with the
      // attempt so the history is a record of the message, not only of the send.
      subject || null,
      body || null,
      attachmentPath || null,
      attachmentName || null,
      dedupeKey || null,
      sentAt || null,
    ],
  });
}
