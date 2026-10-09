-- =============================================================================
-- GOOGLE CALENDAR SYNC (super-admin dashboard)
-- Per-user OAuth connection to Google Calendar, the platform-task → Google
-- event links, and the events read back from the user's "Future Studio"
-- calendar. Mirrors ensureGoogleCalendarSchema() in
-- src/models/integrations/googleCalendar.js (applied at runtime unless
-- SKIP_RUNTIME_SCHEMA_MAINTENANCE=true). Purely additive; idempotent.
--
-- Tokens are NEVER stored in clear: *_enc columns hold AES-256-GCM ciphertext
-- (key: GOOGLE_TOKEN_ENCRYPTION_KEY, server env only). The push-channel secret
-- is stored as a SHA-256 hash.
-- =============================================================================

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  user_id TEXT PRIMARY KEY,                 -- contacts.cid of the connected user
  google_email TEXT,                        -- display only
  calendar_id TEXT,                         -- the dedicated "Future Studio" calendar
  refresh_token_enc TEXT NOT NULL,          -- AES-256-GCM, never in clear
  access_token_enc TEXT,                    -- AES-256-GCM, short-lived cache
  access_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  sync_token TEXT,                          -- Google incremental sync token
  channel_id TEXT,                          -- push-notification channel
  channel_token_hash TEXT,                  -- SHA-256 of the channel secret
  channel_resource_id TEXT,
  channel_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcal_connections_channel ON google_calendar_connections(channel_id);

CREATE TABLE IF NOT EXISTS google_calendar_task_links (
  user_id TEXT NOT NULL,
  task_id INTEGER NOT NULL,                 -- tasks.id
  google_event_id TEXT NOT NULL,
  fingerprint TEXT,                         -- hash of the last body sent
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, task_id)
);

-- Timed objects (program sessions, coaching follow-ups) copied to Google, keyed
-- by source + id so an unchanged object is never re-sent.
CREATE TABLE IF NOT EXISTS google_calendar_event_links (
  user_id TEXT NOT NULL,
  source TEXT NOT NULL,                     -- 'session' | 'followup'
  source_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  fingerprint TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source, source_id)
);

CREATE TABLE IF NOT EXISTS google_calendar_events (
  user_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,                            -- inclusive
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT TRUE,
  html_link TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, google_event_id)
);
