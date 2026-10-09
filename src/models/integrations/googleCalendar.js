import db from "@/lib/db";

/**
 * Google Calendar integration — data access (REPOSITORY layer).
 *
 * Three tables (see src/migrations/050_google_calendar_sync.sql):
 *   google_calendar_connections  one row per connected user: the ENCRYPTED
 *                                tokens, the dedicated "Future Studio"
 *                                calendar id, the incremental sync token and
 *                                the push-notification channel.
 *   google_calendar_task_links   platform task → Google event it was copied to,
 *                                with a fingerprint so unchanged tasks are not
 *                                re-sent.
 *   google_calendar_events       events the user added in Google to the
 *                                dedicated calendar, shown on the dashboard.
 *
 * SQL only — no decisions (see `@/services/integrations/googleCalendar`).
 * Dates are read back as 'YYYY-MM-DD' text so no timezone shifts a day.
 */

let schemaReady = null;

export function ensureGoogleCalendarSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS google_calendar_connections (
        user_id TEXT PRIMARY KEY,
        google_email TEXT,
        calendar_id TEXT,
        refresh_token_enc TEXT NOT NULL,
        access_token_enc TEXT,
        access_token_expires_at TIMESTAMPTZ,
        scope TEXT,
        sync_token TEXT,
        channel_id TEXT,
        channel_token_hash TEXT,
        channel_resource_id TEXT,
        channel_expires_at TIMESTAMPTZ,
        last_synced_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_gcal_connections_channel ON google_calendar_connections(channel_id)",
      );
      await db.execute(`CREATE TABLE IF NOT EXISTS google_calendar_task_links (
        user_id TEXT NOT NULL,
        task_id INTEGER NOT NULL,
        google_event_id TEXT NOT NULL,
        fingerprint TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, task_id)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS google_calendar_events (
        user_id TEXT NOT NULL,
        google_event_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        location TEXT,
        start_date DATE,
        end_date DATE,
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        all_day BOOLEAN NOT NULL DEFAULT TRUE,
        html_link TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, google_event_id)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS google_calendar_event_links (
        user_id TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        google_event_id TEXT NOT NULL,
        fingerprint TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, source, source_id)
      )`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

// ── Connections ─────────────────────────────────────────────────────────────

export async function findConnectionByUser(userId) {
  const res = await db.execute({
    sql: "SELECT * FROM google_calendar_connections WHERE user_id = ?",
    args: [userId],
  });
  return res.rows[0] || null;
}

export async function findConnectionByChannel(channelId) {
  const res = await db.execute({
    sql: "SELECT * FROM google_calendar_connections WHERE channel_id = ?",
    args: [channelId],
  });
  return res.rows[0] || null;
}

export async function listConnections() {
  const res = await db.execute("SELECT * FROM google_calendar_connections ORDER BY created_at");
  return res.rows;
}

/** Creates or replaces a user's connection (a re-connect starts a fresh sync). */
export async function upsertConnection({
  userId,
  googleEmail,
  refreshTokenEnc,
  accessTokenEnc,
  accessTokenExpiresAt,
  scope,
}) {
  await db.execute({
    sql: `INSERT INTO google_calendar_connections
            (user_id, google_email, refresh_token_enc, access_token_enc, access_token_expires_at, scope)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id) DO UPDATE SET
            google_email = EXCLUDED.google_email,
            refresh_token_enc = EXCLUDED.refresh_token_enc,
            access_token_enc = EXCLUDED.access_token_enc,
            access_token_expires_at = EXCLUDED.access_token_expires_at,
            scope = EXCLUDED.scope,
            sync_token = NULL,
            last_error = NULL,
            updated_at = NOW()`,
    args: [userId, googleEmail, refreshTokenEnc, accessTokenEnc, accessTokenExpiresAt, scope],
  });
}

const CONNECTION_COLUMNS = new Set([
  "calendar_id",
  "access_token_enc",
  "access_token_expires_at",
  "sync_token",
  "channel_id",
  "channel_token_hash",
  "channel_resource_id",
  "channel_expires_at",
  "last_synced_at",
  "last_error",
]);

/** Partial update of a connection; only whitelisted columns are accepted. */
export async function updateConnection(userId, fields) {
  const entries = Object.entries(fields).filter(([key]) => CONNECTION_COLUMNS.has(key));
  if (entries.length === 0) return;
  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  await db.execute({
    sql: `UPDATE google_calendar_connections SET ${sets}, updated_at = NOW() WHERE user_id = ?`,
    args: [...entries.map(([, value]) => value), userId],
  });
}

/** Removes everything the integration stored for a user. */
export async function deleteConnectionData(userId) {
  await db.execute({ sql: "DELETE FROM google_calendar_events WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM google_calendar_event_links WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM google_calendar_task_links WHERE user_id = ?", args: [userId] });
  await db.execute({ sql: "DELETE FROM google_calendar_connections WHERE user_id = ?", args: [userId] });
}

// ── Platform tasks → Google ─────────────────────────────────────────────────

/**
 * The user's own dated tasks (created by or assigned to them) that are still
 * relevant: ending no more than `pastDays` ago. Capped by `limit`.
 */
export async function listSyncableTasksForUser(userId, { pastDays = 90, limit = 500 } = {}) {
  const res = await db.execute({
    sql: `SELECT id, title, description, status, priority,
                 to_char(start_date, 'YYYY-MM-DD') AS start_day,
                 to_char(end_date, 'YYYY-MM-DD') AS end_day
          FROM tasks
          WHERE (user_id = ? OR assigned_to = ?)
            AND (start_date IS NOT NULL OR end_date IS NOT NULL)
            AND COALESCE(end_date, start_date) >= CURRENT_DATE - ?::int
          ORDER BY id
          LIMIT ?`,
    args: [userId, userId, pastDays, limit],
  });
  return res.rows;
}

export async function listTaskLinks(userId) {
  const res = await db.execute({
    sql: "SELECT task_id, google_event_id, fingerprint FROM google_calendar_task_links WHERE user_id = ?",
    args: [userId],
  });
  return res.rows;
}

export async function upsertTaskLink(userId, taskId, googleEventId, fingerprint) {
  await db.execute({
    sql: `INSERT INTO google_calendar_task_links (user_id, task_id, google_event_id, fingerprint)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (user_id, task_id) DO UPDATE SET
            google_event_id = EXCLUDED.google_event_id,
            fingerprint = EXCLUDED.fingerprint,
            synced_at = NOW()`,
    args: [userId, taskId, googleEventId, fingerprint],
  });
}

export async function deleteTaskLink(userId, taskId) {
  await db.execute({
    sql: "DELETE FROM google_calendar_task_links WHERE user_id = ? AND task_id = ?",
    args: [userId, taskId],
  });
}

// ── Timed objects (sessions, follow-ups) → Google ──────────────────

export async function listEventLinks(userId) {
  const res = await db.execute({
    sql: "SELECT source, source_id, google_event_id, fingerprint FROM google_calendar_event_links WHERE user_id = ?",
    args: [userId],
  });
  return res.rows;
}

export async function upsertEventLink(userId, source, sourceId, googleEventId, fingerprint) {
  await db.execute({
    sql: `INSERT INTO google_calendar_event_links (user_id, source, source_id, google_event_id, fingerprint)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (user_id, source, source_id) DO UPDATE SET
            google_event_id = EXCLUDED.google_event_id,
            fingerprint = EXCLUDED.fingerprint,
            synced_at = NOW()`,
    args: [userId, source, sourceId, googleEventId, fingerprint],
  });
}

export async function deleteEventLink(userId, source, sourceId) {
  await db.execute({
    sql: "DELETE FROM google_calendar_event_links WHERE user_id = ? AND source = ? AND source_id = ?",
    args: [userId, source, sourceId],
  });
}

// ── Google → dashboard (events added in the Future Studio calendar) ─────────

export async function upsertImportedEvent(userId, event) {
  await db.execute({
    sql: `INSERT INTO google_calendar_events
            (user_id, google_event_id, title, description, location,
             start_date, end_date, start_at, end_at, all_day, html_link)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id, google_event_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            location = EXCLUDED.location,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            start_at = EXCLUDED.start_at,
            end_at = EXCLUDED.end_at,
            all_day = EXCLUDED.all_day,
            html_link = EXCLUDED.html_link,
            updated_at = NOW()`,
    args: [
      userId,
      event.googleEventId,
      event.title,
      event.description,
      event.location,
      event.startDate,
      event.endDate,
      event.startAt,
      event.endAt,
      event.allDay,
      event.htmlLink,
    ],
  });
}

export async function deleteImportedEvent(userId, googleEventId) {
  await db.execute({
    sql: "DELETE FROM google_calendar_events WHERE user_id = ? AND google_event_id = ?",
    args: [userId, googleEventId],
  });
}

export async function deleteAllImportedEvents(userId) {
  await db.execute({ sql: "DELETE FROM google_calendar_events WHERE user_id = ?", args: [userId] });
}

export async function listImportedEvents(userId) {
  const res = await db.execute({
    sql: `SELECT google_event_id, title, description, location, all_day, html_link,
                 to_char(start_date, 'YYYY-MM-DD') AS start_day,
                 to_char(end_date, 'YYYY-MM-DD') AS end_day,
                 start_at, end_at
          FROM google_calendar_events
          WHERE user_id = ?
          ORDER BY start_date, start_at`,
    args: [userId],
  });
  return res.rows;
}
