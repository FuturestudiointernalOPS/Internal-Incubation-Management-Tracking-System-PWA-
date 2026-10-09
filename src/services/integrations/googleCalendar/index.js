import crypto from "crypto";
import { resolveAppUrl } from "@/lib/appUrl";
import { hashToken } from "@/lib/token-hashing";
import {
  buildGoogleAuthUrl,
  emailFromIdToken,
  exchangeGoogleCode,
  isGoogleOAuthConfigured,
  refreshGoogleAccessToken,
  revokeGoogleToken,
} from "@/lib/integrations/google/oauth";
import {
  createCalendar,
  deleteEvent,
  insertEvent,
  listEvents,
  patchEvent,
  stopChannel,
  watchEvents,
} from "@/lib/integrations/google/calendarApi";
import {
  decryptToken,
  encryptToken,
  isTokenEncryptionConfigured,
} from "@/lib/integrations/google/tokenCrypto";
import {
  deleteAllImportedEvents,
  deleteConnectionData,
  deleteEventLink,
  deleteImportedEvent,
  deleteTaskLink,
  ensureGoogleCalendarSchema,
  findConnectionByChannel,
  findConnectionByUser,
  listConnections,
  listEventLinks,
  listImportedEvents,
  listSyncableTasksForUser,
  listTaskLinks,
  updateConnection,
  upsertConnection,
  upsertEventLink,
  upsertImportedEvent,
  upsertTaskLink,
} from "@/models/integrations/googleCalendar";
import { getContactIdentityByCid } from "@/models/contacts/contactStore";
import {
  FUTURE_STUDIO_CALENDAR_NAME,
  isPlatformEvent,
  normalizeGoogleEvent,
  planEventSync,
  planTaskSync,
  toDashboardItem,
} from "./mapping";
import { listUserTimedEvents } from "./timedEvents";

/**
 * Google Calendar integration — use cases (SERVICE layer).
 *
 * Privacy by construction: the OAuth grant is `calendar.app.created`, so the
 * only calendar this code can ever reach is the "Future Studio" calendar it
 * created in the user's account. Personal events never leave Google.
 *
 *   platform → Google  the user's dated tasks are copied (create / update /
 *                      delete) into the Future Studio calendar.
 *   Google → platform  events the user adds to the Future Studio calendar are
 *                      read back (incremental sync token) and shown on the
 *                      dashboard. Our own task copies are recognised by their
 *                      private marker and skipped.
 *
 * Triggered by: the connect callback, the "sync now" button, the dashboard load
 * (when stale), the Google push webhook (pull only) and the scheduled cron.
 * No SQL here (models) and no HTTP responses (controllers).
 */

const CHANNEL_TTL_SECONDS = 7 * 24 * 3600; // Google's maximum for events
const CHANNEL_RENEW_BEFORE_MS = 24 * 3600 * 1000;
const ACCESS_TOKEN_MARGIN_MS = 60 * 1000;
const STALE_AFTER_MS = 5 * 60 * 1000;

const isGone = (error) => error?.status === 404 || error?.status === 410;

// One sync per user at a time inside this process (webhook + cron + button can
// land together; a second caller simply waits for the running one).
const running = new Map();
function exclusive(userId, task) {
  if (running.has(userId)) return running.get(userId);
  const promise = task().finally(() => running.delete(userId));
  running.set(userId, promise);
  return promise;
}

export function isGoogleCalendarConfigured() {
  return isGoogleOAuthConfigured() && isTokenEncryptionConfigured();
}

/** Names (never values) of the server settings still missing, for the UI. */
export function missingGoogleCalendarConfig() {
  const missing = [];
  if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!isTokenEncryptionConfigured()) missing.push("GOOGLE_TOKEN_ENCRYPTION_KEY");
  return missing;
}

// ── Connect ─────────────────────────────────────────────────────────────────

/** A fresh anti-CSRF state and the Google consent URL that carries it. */
export function beginConnect() {
  const state = crypto.randomBytes(24).toString("base64url");
  return { state, url: buildGoogleAuthUrl(state) };
}

/** True when the state echoed by Google is the one we set in the cookie. */
export function stateMatches(expected, received) {
  if (!expected || !received) return false;
  const first = Buffer.from(String(expected));
  const second = Buffer.from(String(received));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

/**
 * Callback step: code → tokens (stored encrypted) → dedicated calendar →
 * first sync. Returns { ok, error? }.
 */
export async function completeConnect({ userId, code }) {
  await ensureGoogleCalendarSchema();
  const tokens = await exchangeGoogleCode(code);
  if (!tokens.refresh_token) return { ok: false, error: "noRefreshToken" };
  if (!String(tokens.scope || "").includes("calendar.app.created")) {
    return { ok: false, error: "scopeDenied" };
  }

  // A re-connect while still connected replaces the tokens only: the calendar
  // and the task links are kept, so no task is copied twice.
  await upsertConnection({
    userId,
    googleEmail: emailFromIdToken(tokens.id_token),
    refreshTokenEnc: encryptToken(tokens.refresh_token),
    accessTokenEnc: encryptToken(tokens.access_token),
    accessTokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 0) * 1000).toISOString(),
    scope: tokens.scope || null,
  });

  const result = await syncUser(userId);
  return { ok: true, sync: result };
}

// ── Tokens & calendar ───────────────────────────────────────────────────────

async function getAccessToken(connection) {
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  if (connection.access_token_enc && expiresAt - ACCESS_TOKEN_MARGIN_MS > Date.now()) {
    return decryptToken(connection.access_token_enc);
  }
  const refreshed = await refreshGoogleAccessToken(decryptToken(connection.refresh_token_enc));
  const fields = {
    access_token_enc: encryptToken(refreshed.access_token),
    access_token_expires_at: new Date(Date.now() + (refreshed.expires_in || 0) * 1000).toISOString(),
  };
  await updateConnection(connection.user_id, fields);
  Object.assign(connection, fields);
  return refreshed.access_token;
}

async function ensureCalendar(connection, accessToken) {
  if (connection.calendar_id) return connection.calendar_id;
  const calendar = await createCalendar(accessToken, {
    summary: FUTURE_STUDIO_CALENDAR_NAME,
    description: "Future Studio tasks and events, synchronised with ImpactOS.",
    timeZone: process.env.GOOGLE_CALENDAR_TIMEZONE || "Africa/Porto-Novo",
  });
  await updateConnection(connection.user_id, { calendar_id: calendar.id, sync_token: null });
  connection.calendar_id = calendar.id;
  connection.sync_token = null;
  return calendar.id;
}

/** The user deleted the Future Studio calendar in Google: start over cleanly. */
async function resetCalendar(connection) {
  await deleteAllImportedEvents(connection.user_id);
  for (const link of await listTaskLinks(connection.user_id)) {
    await deleteTaskLink(connection.user_id, link.task_id);
  }
  for (const link of await listEventLinks(connection.user_id)) {
    await deleteEventLink(connection.user_id, link.source, link.source_id);
  }
  await updateConnection(connection.user_id, {
    calendar_id: null,
    sync_token: null,
    channel_id: null,
    channel_token_hash: null,
    channel_resource_id: null,
    channel_expires_at: null,
  });
  Object.assign(connection, { calendar_id: null, sync_token: null, channel_id: null });
}

// ── Platform → Google ───────────────────────────────────────────────────────

async function pushTasks(connection, accessToken) {
  const userId = connection.user_id;
  const calendarId = connection.calendar_id;
  const [tasks, links] = await Promise.all([
    listSyncableTasksForUser(userId),
    listTaskLinks(userId),
  ]);
  const plan = planTaskSync(tasks, links, { appUrl: resolveAppUrl() });
  const stats = { created: 0, updated: 0, deleted: 0 };

  for (const { task, body, fingerprint } of plan.creates) {
    const created = await insertEvent(accessToken, calendarId, body);
    await upsertTaskLink(userId, task.id, created.id, fingerprint);
    stats.created++;
  }
  for (const { task, eventId, body, fingerprint } of plan.updates) {
    try {
      await patchEvent(accessToken, calendarId, eventId, body);
      await upsertTaskLink(userId, task.id, eventId, fingerprint);
    } catch (error) {
      if (!isGone(error)) throw error;
      // Deleted by hand in Google: the platform is the source of truth for
      // tasks, so the copy is recreated.
      const created = await insertEvent(accessToken, calendarId, body);
      await upsertTaskLink(userId, task.id, created.id, fingerprint);
    }
    stats.updated++;
  }
  for (const { taskId, eventId } of plan.deletes) {
    try {
      await deleteEvent(accessToken, calendarId, eventId);
    } catch (error) {
      if (!isGone(error)) throw error;
    }
    await deleteTaskLink(userId, taskId);
    stats.deleted++;
  }
  return stats;
}

async function resolveUserRole(userId) {
  const res = await getContactIdentityByCid(userId).catch(() => ({ rows: [] }));
  return res.rows?.[0]?.role || null;
}

// ── Platform timed objects → Google (sessions, follow-ups) ───────────────────

async function pushTimedEvents(connection, accessToken, role) {
  const userId = connection.user_id;
  const calendarId = connection.calendar_id;
  const [events, links] = await Promise.all([
    listUserTimedEvents({ userId, role }),
    listEventLinks(userId),
  ]);
  const plan = planEventSync(events, links, { appUrl: resolveAppUrl() });
  const stats = { created: 0, updated: 0, deleted: 0 };

  for (const { event, body, fingerprint } of plan.creates) {
    const created = await insertEvent(accessToken, calendarId, body);
    await upsertEventLink(userId, event.source, event.sourceId, created.id, fingerprint);
    stats.created++;
  }
  for (const { event, eventId, body, fingerprint } of plan.updates) {
    try {
      await patchEvent(accessToken, calendarId, eventId, body);
      await upsertEventLink(userId, event.source, event.sourceId, eventId, fingerprint);
    } catch (error) {
      if (!isGone(error)) throw error;
      // Deleted by hand in Google: recreate it.
      const created = await insertEvent(accessToken, calendarId, body);
      await upsertEventLink(userId, event.source, event.sourceId, created.id, fingerprint);
    }
    stats.updated++;
  }
  for (const { source, sourceId, eventId } of plan.deletes) {
    try {
      await deleteEvent(accessToken, calendarId, eventId);
    } catch (error) {
      if (!isGone(error)) throw error;
    }
    await deleteEventLink(userId, source, sourceId);
    stats.deleted++;
  }
  return stats;
}

// ── Google → platform ───────────────────────────────────────────────────────

async function pullEvents(connection, accessToken) {
  const userId = connection.user_id;
  let syncToken = connection.sync_token || undefined;
  if (!syncToken) await deleteAllImportedEvents(userId);
  const stats = { imported: 0, removed: 0 };
  let pageToken;
  let nextSyncToken = null;

  do {
    let page;
    try {
      page = await listEvents(accessToken, connection.calendar_id, { syncToken, pageToken });
    } catch (error) {
      if (error.status === 410 && syncToken) {
        // Sync token expired: Google asks for a full re-read.
        await deleteAllImportedEvents(userId);
        syncToken = undefined;
        pageToken = undefined;
        continue;
      }
      throw error;
    }
    for (const event of page.items || []) {
      if (isPlatformEvent(event)) continue; // our own task copy
      if (event.status === "cancelled") {
        await deleteImportedEvent(userId, event.id);
        stats.removed++;
        continue;
      }
      const row = normalizeGoogleEvent(event);
      if (!row) continue;
      await upsertImportedEvent(userId, row);
      stats.imported++;
    }
    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken || nextSyncToken;
  } while (pageToken);

  if (nextSyncToken) {
    await updateConnection(userId, { sync_token: nextSyncToken });
    connection.sync_token = nextSyncToken;
  }
  return stats;
}

// ── Push notifications (webhook channel) ────────────────────────────────────

function webhookAddress() {
  if (process.env.GOOGLE_CALENDAR_WEBHOOKS === "off") return null;
  const base = resolveAppUrl();
  // Google only delivers to a public HTTPS endpoint; localhost relies on the
  // cron and the dashboard-load sync instead.
  if (!base.startsWith("https://")) return null;
  return `${base}/api/integrations/google-calendar/webhook`;
}

async function ensureWatch(connection, accessToken) {
  const address = webhookAddress();
  if (!address) return false;
  const expiresAt = connection.channel_expires_at
    ? new Date(connection.channel_expires_at).getTime()
    : 0;
  if (connection.channel_id && expiresAt - CHANNEL_RENEW_BEFORE_MS > Date.now()) return true;

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("base64url");
  const channel = await watchEvents(accessToken, connection.calendar_id, {
    id,
    token,
    address,
    ttlSeconds: CHANNEL_TTL_SECONDS,
  });
  if (connection.channel_id && connection.channel_resource_id) {
    await stopChannel(accessToken, {
      id: connection.channel_id,
      resourceId: connection.channel_resource_id,
    }).catch(() => {});
  }
  const fields = {
    channel_id: id,
    channel_token_hash: hashToken(token),
    channel_resource_id: channel.resourceId,
    channel_expires_at: new Date(Number(channel.expiration)).toISOString(),
  };
  await updateConnection(connection.user_id, fields);
  Object.assign(connection, fields);
  return true;
}

// ── Sync orchestration ──────────────────────────────────────────────────────

async function runSync(connection, { push = true, role = null } = {}) {
  const accessToken = await getAccessToken(connection);
  await ensureCalendar(connection, accessToken);
  const pushed = push ? await pushTasks(connection, accessToken) : null;
  const pushedEvents = push ? await pushTimedEvents(connection, accessToken, role) : null;
  const pulled = await pullEvents(connection, accessToken);
  let watching = false;
  try {
    watching = await ensureWatch(connection, accessToken);
  } catch (error) {
    console.warn("[Google Calendar] watch channel not opened:", error.message);
  }
  return { pushed, pushedEvents, pulled, watching };
}

/** Full two-way sync of one user. Returns { ok, ...stats } or { ok:false, error }. */
export function syncUser(userId, { push = true } = {}) {
  return exclusive(userId, async () => {
    await ensureGoogleCalendarSchema();
    const connection = await findConnectionByUser(userId);
    if (!connection) return { ok: false, error: "notConnected" };
    const role = await resolveUserRole(userId);
    try {
      let result;
      try {
        result = await runSync(connection, { push, role });
      } catch (error) {
        if (!isGone(error) || !connection.calendar_id) throw error;
        await resetCalendar(connection);
        result = await runSync(connection, { push, role });
      }
      await updateConnection(userId, { last_synced_at: new Date().toISOString(), last_error: null });
      return { ok: true, ...result };
    } catch (error) {
      const code = error.code === "invalid_grant" ? "revoked" : "syncFailed";
      console.error("[Google Calendar] sync failed for", userId, "—", error.message);
      await updateConnection(userId, { last_error: code }).catch(() => {});
      return { ok: false, error: code };
    }
  });
}

/** Dashboard-load sync: only when the last one is older than a few minutes. */
export async function syncUserIfStale(userId) {
  await ensureGoogleCalendarSchema();
  const connection = await findConnectionByUser(userId);
  if (!connection) return { ok: false, error: "notConnected" };
  const last = connection.last_synced_at ? new Date(connection.last_synced_at).getTime() : 0;
  if (Date.now() - last < STALE_AFTER_MS) return { ok: true, skipped: true };
  return syncUser(userId);
}

/** Scheduled run: every connection, one after the other. */
export async function syncAllConnections() {
  await ensureGoogleCalendarSchema();
  const connections = await listConnections();
  const results = [];
  for (const connection of connections) {
    const result = await syncUser(connection.user_id);
    results.push({ ok: result.ok, error: result.error });
  }
  return {
    total: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  };
}

/**
 * A Google push notification. Authenticated by the channel token we chose when
 * opening the channel (only its hash is stored). Returns { status }.
 */
export async function handleNotification({ channelId, channelToken, resourceState }) {
  if (!channelId || !channelToken) return { status: 400 };
  await ensureGoogleCalendarSchema();
  const connection = await findConnectionByChannel(channelId);
  if (!connection) return { status: 404 };
  if (!stateMatches(connection.channel_token_hash, hashToken(channelToken))) {
    return { status: 403 };
  }
  // "sync" is the handshake sent when the channel opens — nothing changed yet.
  if (resourceState !== "sync") await syncUser(connection.user_id, { push: false });
  return { status: 200 };
}

// ── Status, dashboard items, disconnect ─────────────────────────────────────

export async function getStatus(userId) {
  const configured = isGoogleCalendarConfigured();
  if (!configured) {
    return { configured: false, connected: false, missing: missingGoogleCalendarConfig() };
  }
  await ensureGoogleCalendarSchema();
  const connection = await findConnectionByUser(userId);
  if (!connection) return { configured: true, connected: false };
  return {
    configured: true,
    connected: true,
    email: connection.google_email,
    calendarName: FUTURE_STUDIO_CALENDAR_NAME,
    lastSyncedAt: connection.last_synced_at,
    lastError: connection.last_error,
    realtime: Boolean(connection.channel_id),
  };
}

export async function listDashboardItems(userId) {
  await ensureGoogleCalendarSchema();
  const rows = await listImportedEvents(userId);
  return rows.map(toDashboardItem);
}

/** Stops the channel, revokes the grant at Google and erases our copy of it. */
export async function disconnect(userId) {
  await ensureGoogleCalendarSchema();
  const connection = await findConnectionByUser(userId);
  if (!connection) return { ok: true };
  try {
    const refreshToken = decryptToken(connection.refresh_token_enc);
    if (connection.channel_id && connection.channel_resource_id) {
      const accessToken = await getAccessToken(connection).catch(() => null);
      if (accessToken) {
        await stopChannel(accessToken, {
          id: connection.channel_id,
          resourceId: connection.channel_resource_id,
        }).catch(() => {});
      }
    }
    await revokeGoogleToken(refreshToken);
  } catch (error) {
    console.warn("[Google Calendar] revoke step skipped:", error.message);
  }
  await deleteConnectionData(userId);
  return { ok: true };
}
