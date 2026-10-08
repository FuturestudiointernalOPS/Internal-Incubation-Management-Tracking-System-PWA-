/**
 * Venture reminders — the email on file for an off-platform assignee, the
 * reminder rules, and the record of what was sent.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 *
 * ADDITIVE ONLY. Nothing here touches an existing table, so a database that
 * never uses reminders is unaffected, and no Venture row changes shape.
 */

export default [
// ─── The email on file for an assignee who is only a NAME ───
//
// A tracker assigns work to "Amina". Amina has no ImpactOS account and no
// contact record, and this table does NOT give her one: it stores an address
// to write to, against the name as the tracker wrote it. Adding it creates no
// person, no member, no platform access.
//
// Keyed by (venture, name) because the name IS the reference at every level —
// one address for Amina covers every activity she owns, and a later resolve to
// a real contact simply takes over (a contact's own email wins).
"CREATE TABLE IF NOT EXISTS venture_assignee_emails (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, display_name TEXT NOT NULL, email TEXT NOT NULL, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE UNIQUE INDEX IF NOT EXISTS idx_assignee_email_name ON venture_assignee_emails (venture_id, LOWER(TRIM(display_name)))",

// ─── Reminder rules ───
//
// `days_before` is a SETTING, never a constant: the platform's older reminder
// jobs hardcode "within 24 hours", which is exactly what this must not do.
// `scope` is 'venture' for the default that covers the whole programme, or
// 'work_item' for an override on one activity.
"CREATE TABLE IF NOT EXISTS venture_reminder_rules (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'venture', work_item_kind TEXT, work_item_id TEXT, trigger TEXT NOT NULL, days_before INTEGER NOT NULL DEFAULT 3, notify_owner BOOLEAN NOT NULL DEFAULT TRUE, notify_supporting BOOLEAN NOT NULL DEFAULT FALSE, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_reminder_rules_venture ON venture_reminder_rules (venture_id, is_active)",

// ─── What was sent, to whom, and why ───
//
// The reviewer's questions — was a reminder sent? when? to whom? did it
// arrive? manual or automatic? — are all answered from here, and the transport
// itself is recorded alongside in platform_email_log.
"CREATE TABLE IF NOT EXISTS venture_reminder_log (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, work_item_kind TEXT NOT NULL, work_item_id TEXT NOT NULL, work_item_ref TEXT, work_item_title TEXT, rule_id INTEGER, trigger TEXT NOT NULL, recipient_name TEXT, recipient_email TEXT NOT NULL, recipient_role TEXT, status TEXT NOT NULL, error TEXT, dedupe_key TEXT, sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_reminder_log_venture ON venture_reminder_log (venture_id, created_at DESC)",
// THE DUPLICATE GUARD, enforced by the database rather than by discipline.
// "3 days before Start" stays true for a whole day, so a daily job would send it
// again every day; this index makes the second insert fail instead. Partial on
// status='sent' so a FAILED send may be retried.
"CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_log_once ON venture_reminder_log (dedupe_key) WHERE status = 'sent' AND dedupe_key IS NOT NULL",
];
