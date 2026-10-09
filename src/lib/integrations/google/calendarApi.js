/**
 * Google Calendar REST v3 transport — the handful of calls the sync needs.
 *
 * Infrastructure only: every function takes an access token and returns
 * Google's JSON; an HTTP failure throws an Error carrying `status`, so the
 * service can react to 401 (refresh), 404/410 (gone) or 410 on a sync token
 * (full resync). No retries, no decisions here.
 */

const BASE = "https://www.googleapis.com/calendar/v3";

async function call(accessToken, method, path, { query, body } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(
      `Google Calendar ${method} ${path} failed: ${data?.error?.message || res.status}`,
    );
    error.status = res.status;
    throw error;
  }
  return data;
}

const calPath = (calendarId) => `/calendars/${encodeURIComponent(calendarId)}`;

/** Creates a secondary calendar owned by the user → { id, summary, … }. */
export function createCalendar(accessToken, { summary, description, timeZone }) {
  return call(accessToken, "POST", "/calendars", { body: { summary, description, timeZone } });
}

export function getCalendar(accessToken, calendarId) {
  return call(accessToken, "GET", calPath(calendarId));
}

export function insertEvent(accessToken, calendarId, event) {
  return call(accessToken, "POST", `${calPath(calendarId)}/events`, { body: event });
}

export function patchEvent(accessToken, calendarId, eventId, event) {
  return call(accessToken, "PATCH", `${calPath(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    body: event,
  });
}

export function deleteEvent(accessToken, calendarId, eventId) {
  return call(accessToken, "DELETE", `${calPath(calendarId)}/events/${encodeURIComponent(eventId)}`);
}

/**
 * One page of events. Pass `syncToken` for an incremental read (only what
 * changed, deletions included), or nothing for the initial full read.
 */
export function listEvents(accessToken, calendarId, { syncToken, pageToken } = {}) {
  return call(accessToken, "GET", `${calPath(calendarId)}/events`, {
    query: {
      maxResults: 250,
      showDeleted: "true",
      singleEvents: "true",
      syncToken,
      pageToken,
    },
  });
}

/** Opens a push-notification channel on a calendar's events → { resourceId, expiration }. */
export function watchEvents(accessToken, calendarId, { id, token, address, ttlSeconds }) {
  return call(accessToken, "POST", `${calPath(calendarId)}/events/watch`, {
    body: {
      id,
      type: "web_hook",
      address,
      token,
      ...(ttlSeconds ? { params: { ttl: String(ttlSeconds) } } : {}),
    },
  });
}

export function stopChannel(accessToken, { id, resourceId }) {
  return call(accessToken, "POST", "/channels/stop", { body: { id, resourceId } });
}
