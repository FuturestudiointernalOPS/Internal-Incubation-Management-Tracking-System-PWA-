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

// ─── WHICH PERSON a name in a tracker is ───
//
// The sibling of the table above, and the same shape: one row per NAME, keyed
// by the name the tracker wrote. Where that table records an ADDRESS for a name,
// this one records the IDENTITY — the contact it turned out to be.
//
// It exists because a name can appear where no row can hold an identifier: the
// people SUPPORTING a piece of work are a text field, not a link. A tracker's
// "Amina" is therefore identified ONCE for the whole Venture, and every mention
// of her — owner of nine activities, support on three more — is the same person
// from that moment on.
//
// Linking creates NOTHING: no account, no member, no access. It points at a
// contact that already exists, and the name is never rewritten.
"CREATE TABLE IF NOT EXISTS venture_assignee_links (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL, display_name TEXT NOT NULL, contact_cid TEXT NOT NULL, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE UNIQUE INDEX IF NOT EXISTS idx_assignee_link_name ON venture_assignee_links (venture_id, LOWER(TRIM(display_name)))",

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

// ─── The sender's own words, and the one file that travelled with them ───
//
// A MANUAL reminder may carry its own subject, its own message and ONE
// attachment. All three are recorded on the log row, so the history answers
// "what exactly did we send", not merely "we sent something".
//
// `body` holds the sender's message as written; `subject` replaces the standard
// line when set; `attachment_path` is the private storage path (the file itself
// is never world-readable, and `attachment_name` is the name the recipient saw).
// NULL means the standard wording / no file — an existing row is untouched.
"ALTER TABLE venture_reminder_log ADD COLUMN IF NOT EXISTS subject TEXT",
"ALTER TABLE venture_reminder_log ADD COLUMN IF NOT EXISTS body TEXT",
"ALTER TABLE venture_reminder_log ADD COLUMN IF NOT EXISTS attachment_path TEXT",
"ALTER TABLE venture_reminder_log ADD COLUMN IF NOT EXISTS attachment_name TEXT",
];
