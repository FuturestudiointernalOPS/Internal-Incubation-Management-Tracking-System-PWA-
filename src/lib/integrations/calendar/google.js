/**
 * Google Calendar Provider (Stub)
 *
 * Ready for when you migrate calendars to Google Workspace.
 * Implements the same CalendarProvider interface.
 *
 * To activate:
 *   1. Create a Google Cloud Project → Enable Calendar API
 *   2. Create a Service Account → download JSON key
 *   3. Share your calendar with the service account email
 *   4. Set environment variables:
 *        CALENDAR_PROVIDER=google
 *        GOOGLE_SERVICE_ACCOUNT_EMAIL=...
 *        GOOGLE_PRIVATE_KEY=...
 *        GOOGLE_CALENDAR_ID=...
 */

import { CalendarProvider } from "./provider";

export class GoogleCalendarProvider extends CalendarProvider {
  constructor() {
    super();
  }

  async _getAuthToken() {
    // TODO: Implement JWT-based auth for Google service account
    // const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/calendar.events'] });
    // return jwt.getAccessToken();
    throw new Error(
      "Google Calendar provider not yet implemented. " +
        "Set CALENDAR_PROVIDER=microsoft to use Outlook/Teams calendars.",
    );
  }

  async createEvent(event) {
    const token = await this._getAuthToken();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const body = {
      summary: event.title,
      description: event.description || "",
      start: { dateTime: event.startTime, timeZone: "UTC" },
      end: { dateTime: event.endTime, timeZone: "UTC" },
      ...(event.location && { location: event.location }),
      ...(event.attendees?.length && {
        attendees: event.attendees.map((email) => ({ email })),
      }),
    };

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Calendar createEvent failed: ${err}`);
    }

    const data = await res.json();
    return {
      success: true,
      externalId: data.id,
      url: data.htmlLink || "",
    };
  }

  async updateEvent(externalId, updates) {
    const token = await this._getAuthToken();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const body = {};
    if (updates.title) body.summary = updates.title;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.startTime) body.start = { dateTime: updates.startTime, timeZone: "UTC" };
    if (updates.endTime) body.end = { dateTime: updates.endTime, timeZone: "UTC" };
    if (updates.location !== undefined) body.location = updates.location;
    if (updates.attendees) body.attendees = updates.attendees.map((email) => ({ email }));

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${externalId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Calendar updateEvent failed: ${err}`);
    }

    return { success: true };
  }

  async deleteEvent(externalId) {
    const token = await this._getAuthToken();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${externalId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Google Calendar deleteEvent failed: ${err}`);
    }

    return { success: true };
  }

  async healthCheck() {
    return { healthy: false, error: "Google Calendar provider not yet implemented" };
  }
}
