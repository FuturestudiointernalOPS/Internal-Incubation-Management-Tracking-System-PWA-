/**
 * VENTURE RECURRING MEETING SCHEDULES — schema.
 *
 * P1 adds the FOUNDATION ONLY: the rule, its exceptions and the columns that
 * will let the materialiser prove it never creates the same occurrence twice.
 * Nothing here creates a session, sends a notice or touches a calendar — the
 * generator is P2 and needs its own approval.
 *
 * Why a separate table instead of columns on `venture_sessions`:
 *   • a schedule is a RULE and never a meeting — merging the two would let a
 *     rescheduled meeting edit the rule, and a shared rule would have no row to
 *     live on;
 *   • "modify from here on" needs versions, and versions need rows;
 *   • the summary document asks for pause/end and exceptions, which are not
 *     properties of any single meeting.
 *
 * `venture_sessions` gains three NULLABLE columns and a PARTIAL unique index.
 * Existing rows keep NULL and are unaffected; the index is what makes the P2
 * sweep idempotent (`ON CONFLICT DO NOTHING`).
 */

export default [
  // `venture_id` carries the same value `venture_sessions` is read by (the
  // internal id, with the code accepted as a fallback). No FK to
  // ventures(venture_id): that column holds the human code, and a uuid would be
  // rejected — the same reason the session spine reads it through a resolver.
  `CREATE TABLE IF NOT EXISTS venture_session_schedules (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    session_type TEXT NOT NULL DEFAULT 'coaching',
    timezone TEXT NOT NULL DEFAULT 'Africa/Porto-Novo',
    frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count BETWEEN 1 AND 12),
    slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    valid_from DATE NOT NULL,
    valid_until DATE,
    max_occurrences INTEGER CHECK (max_occurrences IS NULL OR max_occurrences > 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
    staff_cid TEXT,
    staff_name TEXT,
    milestone_ref TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    supersedes_id INTEGER,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (valid_until IS NULL OR valid_until >= valid_from)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_vss_venture ON venture_session_schedules (venture_id)",
  // A replaced schedule is ENDED, never deleted, so its versions stay readable.
  // No uniqueness on (venture_id): a Venture may run a weekly coaching rhythm and
  // a monthly review at the same time. Versioning is a chain (supersedes_id).
  "CREATE INDEX IF NOT EXISTS idx_vss_supersedes ON venture_session_schedules (supersedes_id)",

  // Deviations from the rule. They address an occurrence by its LOCAL wall-clock
  // key ("2026-11-10T16:00"), which is stable across a timezone's DST changes.
  `CREATE TABLE IF NOT EXISTS venture_session_schedule_exceptions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES venture_session_schedules(id) ON DELETE CASCADE,
    occurrence_key TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('skip', 'cancel', 'move')),
    moved_to TIMESTAMPTZ,
    reason TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (schedule_id, occurrence_key)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_vsse_schedule ON venture_session_schedule_exceptions (schedule_id)",

  // The occurrence identity on the session it will become (P2 writes these).
  "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS schedule_id INTEGER",
  "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS occurrence_key TEXT",
  "ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS schedule_version INTEGER",
  // Duplicate prevention AT THE DATABASE: one session per occurrence, ever.
  // Partial, so the hand-booked sessions (schedule_id IS NULL) are untouched.
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_vs_schedule_occurrence ON venture_sessions (schedule_id, occurrence_key) WHERE schedule_id IS NOT NULL",
];
