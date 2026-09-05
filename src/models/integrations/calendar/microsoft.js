/**
 * Microsoft Graph Calendar Provider
 *
 * Uses the Microsoft Graph API to create/update/delete calendar events
 * via a daemon (client-credentials) app — no user OAuth required.
 *
 * Prerequisites (done by IT admin in Azure Portal):
 *   1. App Registration → "ImpactOS Calendar Sync"
 *   2. API Permissions → Microsoft Graph → Application → Calendars.ReadWrite
 *   3. Grant Admin Consent
 *   4. Note the Tenant ID, Client ID, generate a Client Secret
 *   5. Share the mailbox/calendar to write to (e.g. team@company.com)
 */

import { CalendarProvider } from "./provider";

export class MicrosoftCalendarProvider extends CalendarProvider {
  constructor() {
    super();
    this.tenantId = process.env.AZURE_TENANT_ID;
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;
    this.userEmail = process.env.CALENDAR_USER_EMAIL;
    this._accessToken = null;
    this._tokenExpires = 0;
  }

  /** Obtain a client-credentials token from Microsoft */
  async _getAccessToken() {
    if (this._accessToken && Date.now() < this._tokenExpires) {
      return this._accessToken;
    }

    if (!this.tenantId || !this.clientId || !this.clientSecret) {
      throw new Error(
        "Microsoft Graph not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.",
      );
    }

    const url = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Microsoft Graph auth failed: ${err}`);
    }

    const data = await res.json();
    this._accessToken = data.access_token;
    this._tokenExpires = Date.now() + data.expires_in * 1000 - 60000; // 1min buffer
    return this._accessToken;
  }

  /** Microsoft Graph API base URL */
  get _baseUrl() {
    const mailbox = this.userEmail
      ? `/users/${encodeURIComponent(this.userEmail)}`
      : "/me";
    return `https://graph.microsoft.com/v1.0${mailbox}`;
  }

  /** Build auth headers for Graph calls */
  async _headers() {
    const token = await this._getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a calendar event
   */
  async createEvent(event) {
    const body = {
      subject: event.title,
      body: {
        contentType: "text",
        content: event.description || "",
      },
      start: {
        dateTime: event.startTime,
        timeZone: "UTC",
      },
      end: {
        dateTime: event.endTime,
        timeZone: "UTC",
      },
      ...(event.location && {
        location: { displayName: event.location },
      }),
      ...(event.attendees?.length && {
        attendees: event.attendees.map((email) => ({
          emailAddress: { address: email },
          type: "required",
        })),
      }),
    };

    const res = await fetch(`${this._baseUrl}/calendar/events`, {
      method: "POST",
      headers: await this._headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Microsoft Graph createEvent failed: ${err}`);
    }

    const data = await res.json();
    return {
      success: true,
      externalId: data.id,
      url: data.webLink || "",
    };
  }

  /**
   * Update an existing event
   */
  async updateEvent(externalId, updates) {
    const body = {};
    if (updates.title) body.subject = updates.title;
    if (updates.description !== undefined)
      body.body = { contentType: "text", content: updates.description };
    if (updates.startTime)
      body.start = { dateTime: updates.startTime, timeZone: "UTC" };
    if (updates.endTime)
      body.end = { dateTime: updates.endTime, timeZone: "UTC" };
    if (updates.location !== undefined)
      body.location = { displayName: updates.location };
    if (updates.attendees)
      body.attendees = updates.attendees.map((email) => ({
        emailAddress: { address: email },
        type: "required",
      }));

    const res = await fetch(
      `${this._baseUrl}/calendar/events/${externalId}`,
      {
        method: "PATCH",
        headers: await this._headers(),
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Microsoft Graph updateEvent failed: ${err}`);
    }

    return { success: true };
  }

  /**
   * Delete an event
   */
  async deleteEvent(externalId) {
    const res = await fetch(
      `${this._baseUrl}/calendar/events/${externalId}`,
      {
        method: "DELETE",
        headers: await this._headers(),
      },
    );

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      throw new Error(`Microsoft Graph deleteEvent failed: ${err}`);
    }

    return { success: true };
  }

  /**
   * Verify the configuration is working
   */
  async healthCheck() {
    try {
      const token = await this._getAccessToken();
      const res = await fetch(`${this._baseUrl}/calendar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { healthy: res.ok, status: res.status };
    } catch (e) {
      return { healthy: false, error: e.message };
    }
  }
}
